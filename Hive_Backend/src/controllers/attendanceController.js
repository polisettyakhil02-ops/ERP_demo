import Attendance from "../models/Attendance.js";
import Class from "../models/Class.js";
import Student from "../models/Student.js";
import {
  buildScopeFilter,
  resolveBranchQueryFilter,
} from "../middleware/branchScope.js";
import { isAllowed } from "../rbac/permissions.js";
import { ROLES } from "../config/constants.js";
import {
  getClassTeacherClassIds,
  getTeacherSubjectAssignments,
  isAssignedToClassSubject,
} from "../utils/teacherScope.js";

const forbidden = (res, message) =>
  res.status(403).json({
    success: false,
    message: message || "You do not have permission to mark attendance.",
  });

// Attendance has no `branch` field of its own, and strictQuery silently
// drops the `branch` key buildScopeFilter adds - so branch isolation goes
// through the record's class instead. Returns the _ids (as strings) of
// every class in the caller's branch(es), or null for super_admin (no
// restriction).
async function branchClassIds(user) {
  if (user.role === ROLES.SUPER_ADMIN) return null;
  const { filter } = resolveBranchQueryFilter(user);
  const classes = await Class.find(filter).select("_id").lean();
  return classes.map((c) => String(c._id));
}

const inBranch = (classIds, classId) =>
  classIds === null || classIds.includes(String(classId));

// True when every student_id belongs to `classId`.
async function studentsInClass(classId, studentIds) {
  const unique = [...new Set(studentIds.map(String))];
  if (unique.length === 0) return true;
  const count = await Student.countDocuments({
    _id: { $in: unique },
    class: classId,
  });
  return count === unique.length;
}

// GET /api/attendance
export const list = async (req, res) => {
  try {
    if (!isAllowed("Attendance", "read", req.user.role)) {
      return forbidden(res, "You do not have permission to view attendance.");
    }

    const { date, subject, sort, limit } = req.query;
    const classId = req.query.class_id || req.query.class;
    const branchFilter = buildScopeFilter("Attendance", req.user);

    const filter = { ...branchFilter };
    if (date) filter.date = date;
    if (classId) filter.class = classId;
    if (subject) filter.subject = subject;

    if (req.user.role === ROLES.TEACHER) {
      if (classId && subject) {
        // Daily marking view: exact (class, subject) must be their own.
        const assignments = await getTeacherSubjectAssignments(req.user);
        if (!isAssignedToClassSubject(assignments, classId, subject)) {
          return res.status(403).json({
            success: false,
            message: "You are not assigned to teach this class/subject.",
          });
        }
      } else {
        // Broader / analytics view: everything this teacher is allowed to
        // see - every subject for classes they're Class Teacher of, plus
        // their own subject in any other class they teach. Mirrors
        // marksController's list() so a subject-only teacher (never a
        // homeroom Class Teacher) still sees their own attendance data
        // instead of an always-empty result.
        const classTeacherClassIds = await getClassTeacherClassIds(req.user);
        const myAssignments = await getTeacherSubjectAssignments(req.user);

        if (classId) {
          const isClassTeacher = classTeacherClassIds.includes(
            String(classId),
          );
          const myAssignmentsHere = myAssignments.filter(
            (a) => String(a.class_id) === String(classId),
          );
          if (!isClassTeacher && myAssignmentsHere.length === 0) {
            return res.status(403).json({
              success: false,
              message: "You do not have access to attendance for this class.",
            });
          }
          filter.class = classId;
          // A subject-only teacher (not Class Teacher here) only ever
          // sees their own subject's records for this class.
          if (!isClassTeacher) {
            filter.subject = { $in: myAssignmentsHere.map((a) => a.subject) };
          }
        } else {
          if (classTeacherClassIds.length === 0 && myAssignments.length === 0) {
            return res.json({ success: true, data: [] });
          }
          filter.$or = [
            { class: { $in: classTeacherClassIds } },
            ...myAssignments.map((a) => ({
              class: a.class_id,
              subject: a.subject,
            })),
          ];
        }
      }
    }

    const allowedClassIds = await branchClassIds(req.user);
    if (allowedClassIds !== null) {
      filter.$and = [{ class: { $in: allowedClassIds } }];
    }

    let query = Attendance.find(filter);
    if (sort) query = query.sort(sort);
    if (limit) query = query.limit(Number(limit));

    const records = await query.lean();
    return res.json({ success: true, data: records });
  } catch (err) {
    console.error("attendance.list error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch attendance." });
  }
};

// POST /api/attendance/bulk-mark
export const bulkMark = async (req, res) => {
  try {
    const { class_id, subject, date, records } = req.body;

    if (!class_id || !subject || !date || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: "class, subject, date and records[] are required.",
      });
    }

    if (!isAllowed("Attendance", "create", req.user.role)) {
      return forbidden(res);
    }

    const branchFilter = buildScopeFilter("Attendance", req.user);
    const classId = class_id;
    if (!inBranch(await branchClassIds(req.user), classId)) {
      return forbidden(res, "That class does not belong to your branch.");
    }
    if (
      !(await studentsInClass(
        classId,
        records.map((r) => r.student_id),
      ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Every student must belong to the selected class.",
      });
    }
    if (req.user.role === ROLES.TEACHER) {
      const assignments = await getTeacherSubjectAssignments(req.user);
      if (!isAssignedToClassSubject(assignments, classId, subject)) {
        console.log("You are not assigned to teach this class/subject.");
        return res.status(403).json({
          success: false,
          message: "You are not assigned to teach this class/subject.",
        });
      }
    }

    const ops = records.map((r) => ({
      updateOne: {
        filter: {
          class: classId,
          subject,
          date,
          student_id: r.student_id,
        },
        update: {
          $set: {
            student_id: r.student_id,
            student_name: r.student_name,
            class: classId,
            subject,
            date,
            status: r.status || "Present",
            marked_by: req.user.id,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await Attendance.bulkWrite(ops);
    }

    const updated = await Attendance.find({
      ...branchFilter,
      class: classId,
      subject,
      date,
    }).lean();
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("attendance.bulkMark error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to save attendance." });
  }
};

// POST /api/attendance - single-record create, kept for other callers
export const create = async (req, res) => {
  try {
    if (!isAllowed("Attendance", "create", req.user.role)) {
      return forbidden(res);
    }

    const { class: classId, subject, student_id, student_name, date, status } =
      req.body;
    if (!inBranch(await branchClassIds(req.user), classId)) {
      return forbidden(res, "That class does not belong to your branch.");
    }
    if (!student_id || !(await studentsInClass(classId, [student_id]))) {
      return res.status(400).json({
        success: false,
        message: "The student must belong to the selected class.",
      });
    }

    if (req.user.role === ROLES.TEACHER) {
      const assignments = await getTeacherSubjectAssignments(req.user);
      if (!isAssignedToClassSubject(assignments, classId, subject)) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to teach this class/subject.",
        });
      }
    }

    const record = await Attendance.create({
      student_id,
      student_name,
      class: classId,
      subject,
      date,
      status,
      marked_by: req.user.id,
    });
    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    console.error("attendance.create error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create attendance record." });
  }
};

// PUT /api/attendance/:id
export const update = async (req, res) => {
  try {
    if (!isAllowed("Attendance", "update", req.user.role)) {
      return forbidden(res);
    }

    const branchFilter = buildScopeFilter("Attendance", req.user);
    const existing = await Attendance.findOne({
      _id: req.params.id,
      ...branchFilter,
    });
    if (!existing || !inBranch(await branchClassIds(req.user), existing.class)) {
      return res
        .status(404)
        .json({ success: false, message: "Attendance record not found." });
    }

    if (req.user.role === ROLES.TEACHER) {
      const assignments = await getTeacherSubjectAssignments(req.user);
      if (
        !isAssignedToClassSubject(assignments, existing.class, existing.subject)
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to teach this class/subject.",
        });
      }
    }

    // Only the mark itself may change - never which student, class, subject
    // or date the record is about, since the checks above ran against those.
    if (req.body.status !== undefined) existing.status = req.body.status;
    existing.marked_by = req.user.id;
    await existing.save();
    return res.json({ success: true, data: existing });
  } catch (err) {
    console.error("attendance.update error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update attendance record." });
  }
};
