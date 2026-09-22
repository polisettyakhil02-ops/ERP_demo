// controllers/examScheduleController.js
//
// Role-aware exam-schedule endpoints, backing Hall Ticket generation.
// ExamSchedule.class/branch are real references (see models/ExamSchedule.js).
//
// Who can create/update/delete a class's exam schedule:
//   - "teacher": only if they're the Class Teacher (homeroom) of that class,
//     per Class.class_teacher_id (see utils/teacherScope.js).
//   - "accounts_manager": any class, as long as it belongs to their own
//     branch - they have no "class teacher" concept, so their check is
//     branch membership instead of ownership (see assertCanWriteClass).
// Every other role (principal) is read-only - Principal needs oversight,
// but doesn't create/edit schedules.
//
// No two subjects scheduled for the same class may overlap in time, even
// across different exam schedules for that class - enforced by
// findOverlap() below on every create/update.

import ExamSchedule from "../models/ExamSchedule.js";
import Class from "../models/Class.js";
import { ROLES } from "../config/constants.js";
import { getClassTeacherClassIds } from "../utils/teacherScope.js";

// Throws (with a `.status` the caller maps to an HTTP response) unless the
// requesting user may create/update/delete the exam schedule for `classId`.
async function assertCanWriteClass(req, classId) {
  if (req.user.role === ROLES.TEACHER) {
    const classTeacherClassIds = await getClassTeacherClassIds(req.user, {
      branch: req.user.branch,
    });
    if (!classTeacherClassIds.includes(String(classId))) {
      const err = new Error("You are not the Class Teacher of this class.");
      err.status = 403;
      throw err;
    }
    return;
  }
  if (req.user.role === ROLES.ACCOUNTS_MANAGER) {
    const cls = await Class.findOne({ _id: classId, is_deleted: { $ne: true } })
      .select("branch")
      .lean();
    if (!cls) {
      const err = new Error("Class not found.");
      err.status = 404;
      throw err;
    }
    if (String(cls.branch) !== String(req.user.branch)) {
      const err = new Error("That class does not belong to your branch.");
      err.status = 403;
      throw err;
    }
    return;
  }
  const err = new Error(
    "Your role is not permitted to create or edit exam schedules.",
  );
  err.status = 403;
  throw err;
}

const toMinutes = (startTime) => {
  const [h, m] = String(startTime).split(":").map(Number);
  return h * 60 + (m || 0);
};

const dateKey = (d) => new Date(d).toISOString().slice(0, 10);

const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

// Returns a human-readable conflict message, or null if `incomingSubjects`
// don't overlap each other or any subject already scheduled for `classId`
// (excluding the schedule at `excludeId`, when updating one in place).
async function findOverlap(classId, incomingSubjects, excludeId) {
  for (let i = 0; i < incomingSubjects.length; i++) {
    for (let j = i + 1; j < incomingSubjects.length; j++) {
      const a = incomingSubjects[i];
      const b = incomingSubjects[j];
      if (dateKey(a.date) !== dateKey(b.date)) continue;
      const aStart = toMinutes(a.start_time);
      const aEnd = aStart + Number(a.duration_minutes || 0);
      const bStart = toMinutes(b.start_time);
      const bEnd = bStart + Number(b.duration_minutes || 0);
      if (rangesOverlap(aStart, aEnd, bStart, bEnd)) {
        return `"${a.subject}" and "${b.subject}" on ${dateKey(a.date)} overlap in this schedule.`;
      }
    }
  }

  const filter = { class: classId, is_deleted: false };
  if (excludeId) filter._id = { $ne: excludeId };
  const existingSchedules = await ExamSchedule.find(filter)
    .select("exam_name subjects")
    .lean();

  for (const schedule of existingSchedules) {
    for (const existingSub of schedule.subjects || []) {
      for (const incomingSub of incomingSubjects) {
        if (dateKey(existingSub.date) !== dateKey(incomingSub.date)) continue;
        const eStart = toMinutes(existingSub.start_time);
        const eEnd = eStart + Number(existingSub.duration_minutes || 0);
        const iStart = toMinutes(incomingSub.start_time);
        const iEnd = iStart + Number(incomingSub.duration_minutes || 0);
        if (rangesOverlap(eStart, eEnd, iStart, iEnd)) {
          return `"${incomingSub.subject}" on ${dateKey(incomingSub.date)} clashes with "${existingSub.subject}" already scheduled for this class in "${schedule.exam_name}".`;
        }
      }
    }
  }
  return null;
}

// GET /api/exam-schedules
// Query params (all optional): class, academic_year, sort, limit
export const list = async (req, res) => {
  try {
    const { class: classId, academic_year, sort, limit } = req.query;
    const filter = { branch: req.user.branch, is_deleted: false };
    if (classId) filter.class = classId;
    if (academic_year) filter.academic_year = academic_year;

    let query = ExamSchedule.find(filter).populate("class", "grade section");
    query = query.sort(sort || "-created_date");
    if (limit) query = query.limit(Number(limit));

    const records = await query.lean();
    return res.json({ success: true, data: records });
  } catch (err) {
    console.error("examSchedule.list error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch exam schedules." });
  }
};

// POST /api/exam-schedules
export const create = async (req, res) => {
  try {
    if (![ROLES.TEACHER, ROLES.ACCOUNTS_MANAGER].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Your role is not permitted to create exam schedules.",
      });
    }

    const { class: classId, subjects = [] } = req.body;
    if (!classId) {
      return res
        .status(400)
        .json({ success: false, message: "Class is required." });
    }
    if (subjects.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one subject is required." });
    }

    try {
      await assertCanWriteClass(req, classId);
    } catch (err) {
      return res
        .status(err.status || 403)
        .json({ success: false, message: err.message });
    }

    const conflict = await findOverlap(classId, subjects, null);
    if (conflict) {
      return res.status(400).json({ success: false, message: conflict });
    }

    const record = await ExamSchedule.create({
      ...req.body,
      class: classId,
      branch: req.user.branch,
      created_by: req.user.id,
    });
    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    console.error("examSchedule.create error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create exam schedule." });
  }
};

// PUT /api/exam-schedules/:id
export const update = async (req, res) => {
  try {
    const existing = await ExamSchedule.findOne({
      _id: req.params.id,
      branch: req.user.branch,
      is_deleted: false,
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Exam schedule not found." });
    }
    const nextClassId = req.body.class || existing.class;
    try {
      await assertCanWriteClass(req, existing.class);
      if (String(nextClassId) !== String(existing.class)) {
        await assertCanWriteClass(req, nextClassId);
      }
    } catch (err) {
      return res
        .status(err.status || 403)
        .json({ success: false, message: err.message });
    }

    const nextSubjects = req.body.subjects || existing.subjects;
    const conflict = await findOverlap(nextClassId, nextSubjects, existing._id);
    if (conflict) {
      return res.status(400).json({ success: false, message: conflict });
    }

    Object.assign(existing, req.body, { updated_by: req.user.id });
    await existing.save();
    return res.json({ success: true, data: existing });
  } catch (err) {
    console.error("examSchedule.update error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update exam schedule." });
  }
};

// DELETE /api/exam-schedules/:id
export const remove = async (req, res) => {
  try {
    const existing = await ExamSchedule.findOne({
      _id: req.params.id,
      branch: req.user.branch,
      is_deleted: false,
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Exam schedule not found." });
    }
    try {
      await assertCanWriteClass(req, existing.class);
    } catch (err) {
      return res
        .status(err.status || 403)
        .json({ success: false, message: err.message });
    }

    existing.is_deleted = true;
    existing.deleted_at = new Date();
    existing.updated_by = req.user.id;
    await existing.save();
    return res.json({ success: true, data: existing });
  } catch (err) {
    console.error("examSchedule.remove error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete exam schedule." });
  }
};
