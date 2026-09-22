import Homework from "../models/Homework.js";
import Student from "../models/Student.js";
import Class from "../models/Class.js";
import HomeworkNotification from "../models/HomeworkNotification.js";
import { isAllowed } from "../rbac/permissions.js";
import { resolveBranchQueryFilter } from "../middleware/branchScope.js";
import { ROLES } from "../config/constants.js";
import {
  getTeacherClassIds,
  getTeacherSubjectAssignments,
  isAssignedToClassSubject,
} from "../utils/teacherScope.js";

const ENTITY = "Homework";

const forbidden = (res) =>
  res.status(403).json({
    success: false,
    message: "You do not have permission to manage homework.",
  });

// Branch filter for every Homework query - single-branch roles are pinned
// to their own branch, super_admin is unrestricted.
const homeworkScope = (user) => resolveBranchQueryFilter(user).filter;

// GET /api/homework
// Query params (all optional): class_id, status, sort, limit
export const list = async (req, res) => {
  try {
    if (!isAllowed(ENTITY, "read", req.user.role)) return forbidden(res);

    const { class_id, status, sort, limit } = req.query;
    const branchFilter = homeworkScope(req.user);

    const filter = { ...branchFilter };
    if (status) filter.status = status;

    if (req.user.role === ROLES.TEACHER) {
      // teacherScope helpers compare against userId._id, so they need the
      // user document, not req.user.id (a string).
      const teacherClassIds = await getTeacherClassIds(req.user, branchFilter);

      if (class_id && !teacherClassIds.includes(String(class_id))) {
        return res.status(403).json({
          success: false,
          message: "You can only view homework for classes you teach.",
        });
      }

      if (teacherClassIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      filter.class = class_id || { $in: teacherClassIds };
    } else if (req.user.role === ROLES.STUDENT) {
      // A student only ever sees their own class's homework.
      const student = req.user.linked_student_id
        ? await Student.findOne({
            _id: req.user.linked_student_id,
            ...branchFilter,
          })
            .select("class")
            .lean()
        : null;
      if (!student) return res.json({ success: true, data: [] });
      filter.class = student.class;
    } else if (class_id) {
      filter.class = class_id;
    }

    let query = Homework.find(filter)
      .populate("class", "grade")
      .populate("assigned_by", "full_name");

    if (sort) query = query.sort(sort);
    if (limit) query = query.limit(Number(limit));

    const records = await query.lean();
    return res.json({ success: true, data: records });
  } catch (err) {
    console.error("homework.list error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch homework." });
  }
};

// POST /api/homework
export const create = async (req, res) => {
  try {
    if (!isAllowed(ENTITY, "create", req.user.role)) return forbidden(res);

    const { class: classId, subject, title, description, due_date, status } =
      req.body;
    const branchFilter = homeworkScope(req.user);

    if (req.user.role === ROLES.TEACHER) {
      const assignments = await getTeacherSubjectAssignments(
        req.user,
        branchFilter,
      );

      if (!isAssignedToClassSubject(assignments, classId, subject)) {
        return res.status(403).json({
          success: false,
          message:
            "You can only assign homework for a class/subject you teach.",
        });
      }
    }

    // Fetch the class to get its branch - only a class in the caller's own
    // branch counts.
    const classDoc = await Class.findOne({
      _id: classId,
      ...branchFilter,
    }).select("branch");

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found.",
      });
    }

    const record = await Homework.create({
      title,
      subject,
      description,
      due_date,
      status,
      class: classId,
      branch: classDoc.branch,
      assigned_by: req.user.id,
    });

    const populated = await record.populate([
      { path: "class", select: "class section" },
      { path: "branch", select: "name" },
      { path: "assigned_by", select: "full_name" },
    ]);

    return res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (err) {
    console.error("homework.create error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create homework.",
    });
  }
};

// DELETE /api/homework/:id
export const remove = async (req, res) => {
  try {
    if (!isAllowed(ENTITY, "delete", req.user.role)) return forbidden(res);

    const branchFilter = homeworkScope(req.user);
    const existing = await Homework.findOne({
      _id: req.params.id,
      ...branchFilter,
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Homework not found." });
    }

    if (req.user.role === ROLES.TEACHER) {
      const assignments = await getTeacherSubjectAssignments(
        req.user,
        branchFilter,
      );
      if (
        !isAssignedToClassSubject(assignments, existing.class, existing.subject)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only delete homework for a class/subject you teach.",
        });
      }
    }

    await existing.deleteOne();
    // Clean up any notifications tied to this homework so students don't
    // keep a dangling reference to a deleted assignment.
    await HomeworkNotification.deleteMany({ homework_id: existing._id });

    return res.json({ success: true, data: { _id: existing._id } });
  } catch (err) {
    console.error("homework.remove error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete homework." });
  }
};

// POST /api/homework/:id/notify
// Creates a notification for every active student in the homework's
// class, in one server-side batch instead of one create call per student
// from the client.
export const notify = async (req, res) => {
  try {
    if (!isAllowed("HomeworkNotification", "create", req.user.role))
      return forbidden(res);

    const branchFilter = homeworkScope(req.user);
    const hw = await Homework.findOne({ _id: req.params.id, ...branchFilter });
    if (!hw) {
      return res
        .status(404)
        .json({ success: false, message: "Homework not found." });
    }

    if (req.user.role === ROLES.TEACHER) {
      const assignments = await getTeacherSubjectAssignments(
        req.user,
        branchFilter,
      );
      if (!isAssignedToClassSubject(assignments, hw.class, hw.subject)) {
        return res.status(403).json({
          success: false,
          message:
            "You can only notify students for a class/subject you teach.",
        });
      }
    }

    // Student's field is `class`. This used to filter on `class_id`, which
    // strictQuery silently dropped, so every active student got notified.
    const classStudents = await Student.find({
      branch: hw.branch,
      class: hw.class,
      status: "Active",
    }).select("_id full_name");

    if (classStudents.length === 0) {
      return res.json({ success: true, data: { notified: 0 } });
    }

    const notifications = classStudents.map((s) => ({
      homework_id: hw._id,
      title: hw.title,
      subject: hw.subject,
      description: hw.description,
      class: hw.class,
      due_date: hw.due_date,
      assigned_by: hw.assigned_by,
      student_id: s._id,
      student_name: s.full_name,
      status: "Unread",
    }));

    await HomeworkNotification.insertMany(notifications);

    return res.json({
      success: true,
      data: { notified: notifications.length },
    });
  } catch (err) {
    console.error("homework.notify error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to notify students." });
  }
};
