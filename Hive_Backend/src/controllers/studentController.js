// controllers/studentController.js
import mongoose from "mongoose";
import Student, { STUDENT_STATUSES } from "../models/Student.js";
import StudentFeeReport from "../models/StudentFeeReport.js";
import StudentAdditionRequest from "../models/StudentAdditionRequest.js";
import FeeStructure from "../models/FeeStructure.js";
// TEMP — bulk-upload migration helper, see utils/tempBulkFeeReport.js for
// removal instructions once the historical bulk upload is complete.
import { tempCreateBulkFeeReports } from "../utils/tempBulkFeeReport.js";
import { studentFeeReportFromStructure } from "../utils/studentFeeReportFromStructure.js";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { isAllowed } from "../rbac/permissions.js";
import {
  buildScopeFilter,
  sanitizeAndScopeBody,
} from "../middleware/branchScope.js";
import { ROLES } from "../config/constants.js";
import Class from "../models/Class.js";
import { generateAdmissionNo } from "../utils/admissionNumbering.js";
import {
  resolveSchoolNameForBranch,
  resolveSchoolNamesForBranches,
  DEFAULT_SCHOOL_NAME,
} from "../utils/schoolName.js";
import {
  getStudentOutstandingBalance,
  waiveStudentOutstandingBalance,
  softDeleteStudentFeeReports,
} from "../utils/studentFeeGuard.js";

const RESERVED_QUERY_KEYS = new Set([
  "sort",
  "limit",
  "page",
  "skip",
  "search",
  "academic_year",
  "status_tab",
  // Old/New student filter. Reserved (rather than passed straight through)
  // because student_type is not a field on Student at all - it lives on
  // StudentFeeReport - so letting parseListQuery drop it into the Student
  // filter would just get it stripped by strictQuery and the filter would
  // silently do nothing. Resolved in buildStudentListFilter instead.
  "student_type",
]);

function parseListQuery(query) {
  const filter = {};
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.has(key)) continue;
    if (typeof value === "string" && value.includes(",")) {
      filter[key] = { $in: value.split(",") };
    } else {
      filter[key] = value;
    }
  }
  const sort = query.sort || "-created_date";
  const limit = query.limit ? Math.min(parseInt(query.limit, 10), 5000) : 200;
  const page = query.page ? Math.max(parseInt(query.page, 10), 1) : 1;
  const skip = query.skip ? parseInt(query.skip, 10) : (page - 1) * limit;
  return { filter, sort, limit, skip };
}

function assertAllowed(action, role) {
  if (!isAllowed("Student", action, role)) {
    throw new ApiError(
      403,
      `Your role is not permitted to ${action} Student records.`,
    );
  }
}

// Everything that turns a set of query params into "which students" -
// shared by listStudents and exportStudents below so the two can never
// drift apart. An export that quietly covered a different set of students
// than the table it was launched from would be worse than no export at
// all, and that drift is exactly what two hand-kept copies of this produce.
//
// Resolves to null when the caller should return an empty result (a
// teacher with no assigned classes), rather than to a filter that would
// match everything.
async function buildStudentListFilter(req, filter) {
  const scope = buildScopeFilter("Student", req.user);
  const finalFilter = { ...filter, ...scope };

  // BPStudents.jsx's Academic Year filter - Student has no academic_year
  // field of its own (only Class does), so resolve it down to a set of
  // class ids first, same technique listPendingFees uses against
  // StudentFeeReport. Skipped when a specific class is already picked
  // (filter.class) since that class id already pins the year unambiguously.
  const { search, academic_year, status_tab, student_type } = req.query;
  if (academic_year && academic_year !== "all" && !finalFilter.class) {
    const classQuery = { academic_year };
    if (finalFilter.branch) classQuery.branch = finalFilter.branch;
    const classIds = await Class.find(classQuery).distinct("_id");
    finalFilter.class = { $in: classIds };
  }

  // Active/Inactive tab - "Active" means anything other than literally
  // Inactive (Graduated/Transferred Out/Dropped Out/On Leave/Alumni all
  // still count as "not inactive" there), matching BPStudents.jsx's old
  // client-side byTab split.
  if (status_tab === "inactive") {
    finalFilter.status = "Inactive";
  } else if (status_tab === "active") {
    finalFilter.status = { $ne: "Inactive" };
  }

  // Search box - case-insensitive substring match on name or admission no,
  // same pattern as feeController.js's listPayments/listPendingFees search.
  if (search) {
    const re = new RegExp(
      String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    finalFilter.$or = [{ full_name: re }, { admission_no: re }];
  }

  // Teachers only ever see students in classes they're actually assigned to.
  if (req.user.role === ROLES.TEACHER) {
    const teacherId = new mongoose.Types.ObjectId(String(req.user._id));
    const assignedClasses = await Class.find({
      $or: [
        { class_teacher_id: teacherId },
        { "subject_teachers.teacher_id": teacherId },
      ],
    })
      .select("_id")
      .lean();
    const assigned = assignedClasses.map((c) => String(c._id));

    if (assigned.length === 0) return null;
    const requestedClass =
      typeof filter.class === "string" ? filter.class : null;
    finalFilter.class =
      requestedClass && assigned.includes(requestedClass)
        ? requestedClass
        : { $in: assigned };
  }

  // Old/New filter. "New" = a fresh admission, "Existing" = a continuing
  // (old) student - that distinction is only ever recorded on
  // StudentFeeReport.student_type, never on Student itself, so it has to be
  // resolved to a set of student ids first. Same technique the Academic
  // Year filter above uses against Class.
  //
  // Deliberately applied LAST so the lookup inherits whatever branch/class
  // narrowing the filters above already produced - on a ~18k-student
  // database an unscoped distinct() over every fee report is the difference
  // between a few hundred ids and all of them.
  //
  // A student with no fee report at all matches NEITHER value (they have no
  // recorded type), which is why this only runs when a specific type is
  // asked for and "all" still returns everyone.
  if (student_type === "New" || student_type === "Existing") {
    const reportQuery = {
      student_type,
      is_deleted: { $ne: true },
    };
    if (finalFilter.branch) reportQuery.branch = finalFilter.branch;
    if (finalFilter.class) reportQuery.class = finalFilter.class;
    const studentIds = await StudentFeeReport.find(reportQuery).distinct(
      "student_id",
    );
    finalFilter._id = { $in: studentIds };
  }

  return finalFilter;
}

// GET /api/students
export const listStudents = asyncHandler(async (req, res) => {
  assertAllowed("read", req.user.role);
  const { filter, sort, limit, skip } = parseListQuery(req.query);
  const finalFilter = await buildStudentListFilter(req, filter);
  if (!finalFilter) return res.json({ data: [], total: 0, page: 1, limit });

  const [data, total] = await Promise.all([
    Student.find(finalFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("delete_requested_by", "full_name")
      .populate("status_change_requested_by", "full_name")
      .lean(),
    Student.countDocuments(finalFilter),
  ]);

  res.json({
    data,
    total,
    page: Math.floor(skip / limit) + 1,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  });
});

// Only what the Students export sheet actually prints. listStudents returns
// whole Student documents, which is fine for one page of 25 - for a
// whole-school export it would mean shipping every address subdocument,
// photo URL and deletion-workflow field for thousands of students so the
// browser could throw all of it away.
const STUDENT_EXPORT_FIELDS = [
  "admission_no",
  "full_name",
  "class",
  "section",
  "roll_no",
  "parent_name",
  "parent_phone",
  "parent_email",
  "gender",
  "dob",
  "blood_group",
  "status",
  "joining_date",
  "is_hosteler",
  "transport_route",
  "address",
  "branch",
].join(" ");

// A whole-school export is a big but bounded query; this is a guard rail
// against a filter mistake turning into an unbounded one, not a page size.
const STUDENT_EXPORT_MAX = 20000;

// GET /api/students/export - every student matching the same filters
// listStudents understands, in one response, projected down to just the
// export columns. Deliberately NOT paginated: parseListQuery caps limit at
// 5000, so the client would otherwise have to stitch several pages
// together and could tear a class across a page boundary.
export const exportStudents = asyncHandler(async (req, res) => {
  assertAllowed("read", req.user.role);
  const { filter } = parseListQuery(req.query);
  const finalFilter = await buildStudentListFilter(req, filter);
  if (!finalFilter) return res.json({ data: [], total: 0 });

  const total = await Student.countDocuments(finalFilter);
  if (total > STUDENT_EXPORT_MAX) {
    throw new ApiError(
      400,
      `That export would cover ${total.toLocaleString("en-IN")} students, which is more than the ${STUDENT_EXPORT_MAX.toLocaleString("en-IN")} limit. Narrow it down by class, branch or academic year.`,
    );
  }

  // grade/section come back on the row itself - the sheet is grouped and
  // named by class, and resolving that client-side would make the export
  // silently wrong for any class missing from whatever list the page
  // happens to have loaded.
  const data = await Student.find(finalFilter)
    .select(STUDENT_EXPORT_FIELDS)
    .populate("class", "grade academic_year")
    .populate("branch", "name")
    .lean();

  res.json({ data, total });
});

// GET /api/students/:id
export const getStudentById = asyncHandler(async (req, res) => {
  assertAllowed("read", req.user.role);
  const scope = buildScopeFilter("Student", req.user);
  const doc = await Student.findOne({ _id: req.params.id, ...scope });
  if (!doc) throw new ApiError(404, "Student record not found.");
  res.json(doc);
});

// POST /api/students
// admission_no is always server-generated here, never taken from the
// client (see generateAdmissionNo in utils/admissionNumbering.js, which
// verifies the number against every existing Student before returning it) -
// this is the direct "Add Student" flow on the Students page, a separate,
// independently-reachable path from the Admission -> admit()/convert() flow
// in admissionController.js that mints numbers the same way for admissions.
// Bulk-uploaded historical students are the one deliberate exception
// (bulkCreateStudents below) - those keep whatever admission_no the upload
// sheet supplied, since that's real pre-existing data, not a new admission.
export const createStudent = asyncHandler(async (req, res) => {
  assertAllowed("create", req.user.role);
  const body = sanitizeAndScopeBody("Student", req.user, req.body);
  delete body.admission_no;

  // The student's own branch decides the school, not whoever is saving the
  // record - an Admin Officer spans several branches, so their personal
  // schoolName would file the student under the wrong school. See
  // utils/schoolName.js.
  const schoolName = await resolveSchoolNameForBranch(
    body.branch,
    req.user.schoolName,
  );

  // generateAdmissionNo() already re-verifies its candidate against every
  // Student before returning it, so a duplicate-key error here can only
  // mean a genuine concurrent race (two staff saving at the same instant) -
  // retry with a freshly generated number instead of surfacing an error.
  const MAX_CREATE_ATTEMPTS = 3;
  let doc;
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const admission_no = await generateAdmissionNo(body.branch);
    try {
      doc = await Student.create({
        ...body,
        admission_no,
        created_by: req.user._id,
        updated_by: req.user._id,
        schoolName,
      });
      break;
    } catch (err) {
      const isAdmissionNoCollision =
        err.code === 11000 && err.keyPattern?.admission_no;
      if (!isAdmissionNoCollision || attempt === MAX_CREATE_ATTEMPTS - 1) {
        throw err;
      }
      // else: fall through to the next attempt with a fresh admission_no
    }
  }

  res.status(201).json(doc);
});

// POST /api/students/bulk
export const bulkCreateStudents = asyncHandler(async (req, res) => {
  assertAllowed("create", req.user.role);
  if (!Array.isArray(req.body)) {
    throw new ApiError(
      400,
      "Bulk create expects an array of records in the request body.",
    );
  }

  const scoped = req.body.map((item) =>
    sanitizeAndScopeBody("Student", req.user, item),
  );

  // One lookup for the whole batch - an upload sheet handled by an Admin
  // Officer can legitimately cover several branches, and each row's school
  // has to come from its own branch rather than from the uploader.
  const schoolNameByBranch = await resolveSchoolNamesForBranches(
    scoped.map((d) => d.branch),
    req.user.schoolName,
  );

  const docs = scoped.map((item) => ({
    ...item,
    created_by: req.user._id,
    updated_by: req.user._id,
    schoolName:
      schoolNameByBranch.get(String(item.branch)) ||
      req.user.schoolName ||
      DEFAULT_SCHOOL_NAME,
  }));

  // TEMP — `old_fee` isn't a Student field, so Mongoose silently drops it
  // from `docs` on insert; capture it here (keyed by the unique
  // admission_no) before that happens so tempCreateBulkFeeReports can still
  // attach it to each student's StudentFeeReport below.
  const tempOldFeeByAdmissionNo = new Map(
    docs
      .filter((d) => d.admission_no && d.old_fee != null)
      .map((d) => [d.admission_no, Number(d.old_fee) || 0]),
  );

  try {
    const created = await Student.insertMany(docs, { ordered: false });

    // TEMP — remove once the bulk-upload migration period is over (see
    // utils/tempBulkFeeReport.js). Wrapped in its own try/catch so a
    // fee-report problem never undoes or fails the student creation above.
    let tempFeeReports = { created: 0, errors: [] };
    try {
      tempFeeReports = await tempCreateBulkFeeReports(
        created,
        req.user._id,
        tempOldFeeByAdmissionNo,
      );
    } catch (feeErr) {
      tempFeeReports = { created: 0, errors: [{ message: feeErr.message }] };
    }

    return res.status(201).json({
      created: created.length,
      failed: 0,
      data: created,
      errors: [],
      tempFeeReports, // TEMP
    });
  } catch (err) {
    const insertedDocs = err.insertedDocs || err.results?.insertedDocs || [];
    const writeErrors =
      err.writeErrors || err.result?.result?.writeErrors || [];

    if (insertedDocs.length === 0 && writeErrors.length === 0) {
      throw err;
    }

    // TEMP — remove once the bulk-upload migration period is over.
    let tempFeeReports = { created: 0, errors: [] };
    try {
      tempFeeReports = await tempCreateBulkFeeReports(
        insertedDocs,
        req.user._id,
        tempOldFeeByAdmissionNo,
      );
    } catch (feeErr) {
      tempFeeReports = { created: 0, errors: [{ message: feeErr.message }] };
    }

    return res.status(207).json({
      created: insertedDocs.length,
      failed: docs.length - insertedDocs.length,
      data: insertedDocs,
      errors: writeErrors.map((e) => ({
        index: e.index,
        message: e.errmsg || e.err?.errmsg || "Validation failed.",
      })),
      tempFeeReports, // TEMP
    });
  }
});

// PUT /api/students/:id
export const updateStudent = asyncHandler(async (req, res) => {
  assertAllowed("update", req.user.role);
  const scope = buildScopeFilter("Student", req.user);

  const existing = await Student.findOne({ _id: req.params.id, ...scope });
  if (!existing) throw new ApiError(404, "Student record not found.");
  if (existing.delete_requested) {
    throw new ApiError(
      409,
      "This student has a pending deletion request - resolve it before editing.",
    );
  }
  if (existing.status_change_requested) {
    throw new ApiError(
      409,
      "This student has a pending status change request - resolve it before editing.",
    );
  }

  const clean = sanitizeAndScopeBody("Student", req.user, req.body);
  delete clean.branch;
  // `status` only ever changes through the request/approve/reject flow
  // below (see requestStatusChangeStudent) - never directly through this
  // generic update endpoint, Principal approval included.
  delete clean.status;

  const doc = await Student.findOneAndUpdate(
    { _id: req.params.id, ...scope },
    { ...clean, updated_by: req.user._id },
    { new: true, runValidators: true },
  );
  if (!doc) throw new ApiError(404, "Student record not found.");
  res.json(doc);
});

// POST /api/students/promote
// body: { student_ids: [...], class: <target Class _id> }
// Moves a batch of students to a higher class in a later academic year.
// Every selected student must currently be in the same class as the
// target's branch, in a strictly lower grade, and in a strictly earlier
// academic year - otherwise nothing is written (all-or-nothing). Their
// linked StudentFeeReport(s), if any, follow the class change and flip to
// student_type "Existing" since a promoted student is a continuing
// student, not a fresh admission.
export const promoteStudents = asyncHandler(async (req, res) => {
  assertAllowed("update", req.user.role);

  const { student_ids, class: newClassId } = req.body;
  if (!Array.isArray(student_ids) || student_ids.length === 0 || !newClassId) {
    throw new ApiError(
      400,
      "student_ids (a non-empty array) and class are required.",
    );
  }

  const targetClass = await Class.findOne({
    _id: newClassId,
    is_deleted: { $ne: true },
  }).lean();
  if (!targetClass) throw new ApiError(404, "Target class not found.");

  const scope = buildScopeFilter("Student", req.user);
  const students = await Student.find({
    _id: { $in: student_ids },
    ...scope,
  }).lean();
  if (students.length !== student_ids.length) {
    throw new ApiError(404, "One or more selected students were not found.");
  }

  const currentClassIds = [...new Set(students.map((s) => String(s.class)))];
  const currentClasses = await Class.find({
    _id: { $in: currentClassIds },
  }).lean();
  const currentClassMap = Object.fromEntries(
    currentClasses.map((c) => [String(c._id), c]),
  );

  const errors = [];
  for (const s of students) {
    if (String(s.branch) !== String(targetClass.branch)) {
      errors.push(
        `${s.full_name}: target class belongs to a different branch.`,
      );
      continue;
    }
    const current = currentClassMap[String(s.class)];
    if (!current) {
      errors.push(`${s.full_name}: current class could not be resolved.`);
      continue;
    }
    if (targetClass.grade_order <= current.grade_order) {
      errors.push(
        `${s.full_name}: can only be promoted to a higher class than their current one.`,
      );
      continue;
    }
    if (!(targetClass.academic_year > current.academic_year)) {
      errors.push(
        `${s.full_name}: target class must be from a later academic year.`,
      );
    }
  }
  if (errors.length > 0) {
    throw new ApiError(400, errors.join(" "));
  }

  const studentIds = students.map((s) => s._id);
  await Student.updateMany(
    { _id: { $in: studentIds } },
    { class: targetClass._id, updated_by: req.user._id },
  );
  await StudentFeeReport.updateMany(
    { student_id: { $in: studentIds } },
    { class: targetClass._id, student_type: "Existing" },
  );

  res.json({
    success: true,
    promoted: studentIds.length,
    class: targetClass._id,
  });
});

// DELETE /api/students/:id — direct soft delete. No role currently holds
// Student.delete (see rbac/permissions.js): an Accounts Manager can only
// *request* a deletion below, which a Principal must approve before this
// actually happens - this endpoint only remains reachable for super_admin,
// who bypasses isAllowed entirely.
export const deleteStudent = asyncHandler(async (req, res) => {
  assertAllowed("delete", req.user.role);
  const scope = buildScopeFilter("Student", req.user);
  const doc = await Student.findOne({ _id: req.params.id, ...scope });
  if (!doc) throw new ApiError(404, "Student record not found.");

  const outstanding = await getStudentOutstandingBalance(doc._id);
  if (outstanding > 0) {
    throw new ApiError(
      409,
      `Cannot delete this student — outstanding fee balance of ₹${outstanding} must be cleared first.`,
    );
  }

  doc.is_deleted = true;
  doc.deleted_at = new Date();
  doc.updated_by = req.user._id;
  // validateModifiedOnly: only touches is_deleted/deleted_at - a legacy
  // record missing an unrelated required field must not block deletion.
  await doc.save({ validateModifiedOnly: true });
  await softDeleteStudentFeeReports(doc._id, req.user._id);
  res.json({ success: true, id: doc._id });
});

// Deletion-approval workflow (Accounts Manager -> Admin Officer), mirroring
// the Expenditure deletion-approval flow in expenditureController.js. An
// Accounts Manager can no longer delete a student directly; instead they
// request it, an Admin Officer assigned to that student's branch approves
// or rejects, and the requester can withdraw a still-pending request.

// POST /api/students/:id/request-delete — Accounts Manager only (route-gated).
// body: { isDropout?: boolean } — a dropout request bypasses the
// outstanding-fee-balance guard below; the balance itself isn't touched
// until an Admin Officer actually approves it (see
// approveDeleteRequestStudent), so a request that's later rejected or
// withdrawn never mutates fee data.
export const requestDeleteStudent = asyncHandler(async (req, res) => {
  const isDropout = req.body?.isDropout === true;

  const scope = buildScopeFilter("Student", req.user);
  const existing = await Student.findOne({ _id: req.params.id, ...scope });
  if (!existing) throw new ApiError(404, "Student record not found.");

  if (existing.delete_requested) {
    throw new ApiError(
      409,
      "A deletion request is already pending for this student.",
    );
  }
  if (existing.status_change_requested) {
    throw new ApiError(
      409,
      "This student has a pending status change request - resolve it before requesting deletion.",
    );
  }

  let outstanding = 0;
  if (!isDropout) {
    outstanding = await getStudentOutstandingBalance(existing._id);
    if (outstanding > 0) {
      throw new ApiError(
        409,
        `Cannot request deletion — outstanding fee balance of ₹${outstanding} must be cleared first.`,
      );
    }
  }

  existing.delete_requested = true;
  existing.delete_requested_by = req.user._id;
  existing.delete_requested_at = new Date();
  existing.delete_requested_reason = isDropout ? "dropout" : "other";
  existing.updated_by = req.user._id;
  // validateModifiedOnly: this only touches delete_requested* / is_deleted
  // fields - a legacy record missing an unrelated required field (e.g. an
  // old row saved before schoolName was mandatory) must not block the
  // deletion-request workflow from running.
  await existing.save({ validateModifiedOnly: true });

  if (isDropout) {
    outstanding = await getStudentOutstandingBalance(existing._id);
  }

  await Notification.create({
    recipient_role: ROLES.ADMIN_OFFICER,
    branch: existing.branch,
    type: "student_delete_request",
    related_student_id: existing._id,
    initiated_by: req.user._id,
    status: "Open",
    title: `Deletion requested: ${existing.full_name}`,
    message: isDropout
      ? `${req.user.full_name} has requested to delete student ${existing.full_name} (Adm. No ${existing.admission_no}) — dropping out. Approving will waive their remaining fee balance${outstanding > 0 ? ` of ₹${outstanding}` : ""}. Review it on the Students page.`
      : `${req.user.full_name} has requested to delete student ${existing.full_name} (Adm. No ${existing.admission_no}). Review it on the Students page.`,
  });

  res.json({ success: true, data: existing });
});

// POST /api/students/:id/withdraw-delete-request — Accounts Manager only,
// and only the Accounts Manager who submitted the request.
export const withdrawDeleteRequestStudent = asyncHandler(async (req, res) => {
  const scope = buildScopeFilter("Student", req.user);
  const existing = await Student.findOne({ _id: req.params.id, ...scope });
  if (!existing) throw new ApiError(404, "Student record not found.");

  if (!existing.delete_requested) {
    throw new ApiError(409, "This student has no pending deletion request.");
  }
  if (String(existing.delete_requested_by) !== String(req.user._id)) {
    throw new ApiError(403, "You can only withdraw a request you submitted.");
  }

  existing.delete_requested = false;
  existing.delete_requested_by = null;
  existing.delete_requested_at = null;
  existing.delete_requested_reason = null;
  existing.updated_by = req.user._id;
  // validateModifiedOnly: this only touches delete_requested* / is_deleted
  // fields - a legacy record missing an unrelated required field (e.g. an
  // old row saved before schoolName was mandatory) must not block the
  // deletion-request workflow from running.
  await existing.save({ validateModifiedOnly: true });

  await Notification.updateMany(
    {
      related_student_id: existing._id,
      type: "student_delete_request",
      status: "Open",
    },
    { status: "Resolved", updated_by: req.user._id },
  );

  res.json({ success: true, data: existing });
});

// Admin Officers only manage student deletion requests for branches
// assigned to them via User.branches - mirrors isBranchAdminOfficer in
// expenditureController.js. This is separate from the general "delete" RBAC
// permission, which only governs who can *request* a deletion.
const isBranchAdminOfficer = (user, branchId) =>
  user.role === ROLES.ADMIN_OFFICER &&
  (user.branches || []).some((b) => b.toString() === branchId.toString());

// POST /api/students/:id/approve-delete — Admin Officer only, assigned
// branches only.
export const approveDeleteRequestStudent = asyncHandler(async (req, res) => {
  const existing = await Student.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Student record not found.");

  if (!isBranchAdminOfficer(req.user, existing.branch)) {
    throw new ApiError(
      403,
      "You do not have permission to approve deletion of this student.",
    );
  }

  if (!existing.delete_requested) {
    throw new ApiError(409, "This student has no pending deletion request.");
  }

  const isDropout = existing.delete_requested_reason === "dropout";
  const outstanding = await getStudentOutstandingBalance(existing._id);
  if (outstanding > 0) {
    if (!isDropout) {
      throw new ApiError(
        409,
        `Cannot approve deletion — outstanding fee balance of ₹${outstanding} must be cleared first. Reject or wait for the requester to withdraw.`,
      );
    }
    // Dropout request: write off the remaining balance instead of
    // collecting it - only happens here, at approval, never at request
    // time, so a rejected/withdrawn request never touches fee data.
    await waiveStudentOutstandingBalance(existing._id, req.user._id);
  }

  const requestedBy = existing.delete_requested_by;

  existing.is_deleted = true;
  existing.deleted_at = new Date();
  existing.delete_requested = false;
  existing.delete_requested_by = null;
  existing.delete_requested_at = null;
  existing.delete_requested_reason = null;
  existing.updated_by = req.user._id;
  // validateModifiedOnly: this only touches delete_requested* / is_deleted
  // fields - a legacy record missing an unrelated required field (e.g. an
  // old row saved before schoolName was mandatory) must not block the
  // deletion-request workflow from running.
  await existing.save({ validateModifiedOnly: true });
  await softDeleteStudentFeeReports(existing._id, req.user._id);

  await Notification.updateMany(
    {
      related_student_id: existing._id,
      type: "student_delete_request",
      status: "Open",
    },
    { status: "Resolved", updated_by: req.user._id },
  );

  if (requestedBy) {
    await Notification.create({
      recipient_role: ROLES.ACCOUNTS_MANAGER,
      recipient_user_id: requestedBy,
      branch: existing.branch,
      type: "student_delete_approved",
      related_student_id: existing._id,
      status: "Open",
      title: `Deletion approved: ${existing.full_name}`,
      message:
        isDropout && outstanding > 0
          ? `Your request to delete ${existing.full_name} was approved by the Admin Officer. Their remaining fee balance of ₹${outstanding} was waived as part of the dropout deletion.`
          : `Your request to delete ${existing.full_name} was approved by the Admin Officer.`,
    });
  }

  res.json({ success: true, id: existing._id });
});

// POST /api/students/:id/reject-delete — Admin Officer only, assigned
// branches only.
export const rejectDeleteRequestStudent = asyncHandler(async (req, res) => {
  const existing = await Student.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Student record not found.");

  if (!isBranchAdminOfficer(req.user, existing.branch)) {
    throw new ApiError(
      403,
      "You do not have permission to reject deletion of this student.",
    );
  }

  if (!existing.delete_requested) {
    throw new ApiError(409, "This student has no pending deletion request.");
  }

  const requestedBy = existing.delete_requested_by;

  existing.delete_requested = false;
  existing.delete_requested_by = null;
  existing.delete_requested_at = null;
  existing.delete_requested_reason = null;
  existing.updated_by = req.user._id;
  // validateModifiedOnly: this only touches delete_requested* / is_deleted
  // fields - a legacy record missing an unrelated required field (e.g. an
  // old row saved before schoolName was mandatory) must not block the
  // deletion-request workflow from running.
  await existing.save({ validateModifiedOnly: true });

  await Notification.updateMany(
    {
      related_student_id: existing._id,
      type: "student_delete_request",
      status: "Open",
    },
    { status: "Resolved", updated_by: req.user._id },
  );

  if (requestedBy) {
    await Notification.create({
      recipient_role: ROLES.ACCOUNTS_MANAGER,
      recipient_user_id: requestedBy,
      branch: existing.branch,
      type: "student_delete_declined",
      related_student_id: existing._id,
      status: "Open",
      title: `Deletion declined: ${existing.full_name}`,
      message: `Your request to delete ${existing.full_name} was declined by the Admin Officer.`,
    });
  }

  res.json({ success: true, data: existing });
});

// Status-change-approval workflow (Accounts Manager -> Principal), mirroring
// the deletion-approval flow above. An Accounts Manager can no longer flip
// a student's status directly (see updateStudent, which strips `status`
// from every generic PUT body); instead they request a target status, the
// Principal (own branch only) approves or rejects it, and the requester can
// withdraw a still-pending request.

// POST /api/students/:id/request-status-change — Accounts Manager only
// (route-gated). body: { status: <target Student status> }
export const requestStatusChangeStudent = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status || !STUDENT_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `status must be one of: ${STUDENT_STATUSES.join(", ")}.`,
    );
  }

  const scope = buildScopeFilter("Student", req.user);
  const existing = await Student.findOne({ _id: req.params.id, ...scope });
  if (!existing) throw new ApiError(404, "Student record not found.");

  if (existing.delete_requested) {
    throw new ApiError(
      409,
      "This student has a pending deletion request - resolve it before requesting a status change.",
    );
  }
  if (existing.status_change_requested) {
    throw new ApiError(
      409,
      "A status change request is already pending for this student.",
    );
  }
  if (status === existing.status) {
    throw new ApiError(400, `${existing.full_name} is already ${status}.`);
  }

  const fromStatus = existing.status;
  existing.status_change_requested = true;
  existing.status_change_requested_by = req.user._id;
  existing.status_change_requested_at = new Date();
  existing.status_change_to = status;
  existing.updated_by = req.user._id;
  // validateModifiedOnly: this only touches status_change_requested* fields
  // (not `status` itself yet) - a legacy record missing an unrelated
  // required field must not block the request workflow from running.
  await existing.save({ validateModifiedOnly: true });

  await Notification.create({
    recipient_role: ROLES.PRINCIPAL,
    branch: existing.branch,
    type: "student_status_change_request",
    related_student_id: existing._id,
    initiated_by: req.user._id,
    status: "Open",
    title: `Status change requested: ${existing.full_name}`,
    message: `${req.user.full_name} has requested to change ${existing.full_name}'s status from ${fromStatus} to ${status}. Review it on the Students page.`,
  });

  res.json({ success: true, data: existing });
});

// POST /api/students/:id/withdraw-status-change-request — Accounts Manager
// only, and only the Accounts Manager who submitted the request.
export const withdrawStatusChangeRequestStudent = asyncHandler(
  async (req, res) => {
    const scope = buildScopeFilter("Student", req.user);
    const existing = await Student.findOne({ _id: req.params.id, ...scope });
    if (!existing) throw new ApiError(404, "Student record not found.");

    if (!existing.status_change_requested) {
      throw new ApiError(
        409,
        "This student has no pending status change request.",
      );
    }
    if (String(existing.status_change_requested_by) !== String(req.user._id)) {
      throw new ApiError(403, "You can only withdraw a request you submitted.");
    }

    existing.status_change_requested = false;
    existing.status_change_requested_by = null;
    existing.status_change_requested_at = null;
    existing.status_change_to = null;
    existing.updated_by = req.user._id;
    await existing.save({ validateModifiedOnly: true });

    await Notification.updateMany(
      {
        related_student_id: existing._id,
        type: "student_status_change_request",
        status: "Open",
      },
      { status: "Resolved", updated_by: req.user._id },
    );

    res.json({ success: true, data: existing });
  },
);

// POST /api/students/:id/approve-status-change — Principal only, own
// branch only.
export const approveStatusChangeRequestStudent = asyncHandler(
  async (req, res) => {
    const scope = buildScopeFilter("Student", req.user);
    const existing = await Student.findOne({ _id: req.params.id, ...scope });
    if (!existing) throw new ApiError(404, "Student record not found.");

    if (!existing.status_change_requested) {
      throw new ApiError(
        409,
        "This student has no pending status change request.",
      );
    }

    const requestedBy = existing.status_change_requested_by;
    const fromStatus = existing.status;
    const toStatus = existing.status_change_to;

    existing.status = toStatus;
    existing.status_change_requested = false;
    existing.status_change_requested_by = null;
    existing.status_change_requested_at = null;
    existing.status_change_to = null;
    existing.updated_by = req.user._id;
    await existing.save({ validateModifiedOnly: true });

    await Notification.updateMany(
      {
        related_student_id: existing._id,
        type: "student_status_change_request",
        status: "Open",
      },
      { status: "Resolved", updated_by: req.user._id },
    );

    if (requestedBy) {
      await Notification.create({
        recipient_role: ROLES.ACCOUNTS_MANAGER,
        recipient_user_id: requestedBy,
        branch: existing.branch,
        type: "student_status_change_approved",
        related_student_id: existing._id,
        status: "Open",
        title: `Status change approved: ${existing.full_name}`,
        message: `Your request to change ${existing.full_name}'s status from ${fromStatus} to ${toStatus} was approved by the Principal.`,
      });
    }

    res.json({ success: true, data: existing });
  },
);

// POST /api/students/:id/reject-status-change — Principal only, own
// branch only.
export const rejectStatusChangeRequestStudent = asyncHandler(
  async (req, res) => {
    const scope = buildScopeFilter("Student", req.user);
    const existing = await Student.findOne({ _id: req.params.id, ...scope });
    if (!existing) throw new ApiError(404, "Student record not found.");

    if (!existing.status_change_requested) {
      throw new ApiError(
        409,
        "This student has no pending status change request.",
      );
    }

    const requestedBy = existing.status_change_requested_by;
    const fromStatus = existing.status;
    const toStatus = existing.status_change_to;

    existing.status_change_requested = false;
    existing.status_change_requested_by = null;
    existing.status_change_requested_at = null;
    existing.status_change_to = null;
    existing.updated_by = req.user._id;
    await existing.save({ validateModifiedOnly: true });

    await Notification.updateMany(
      {
        related_student_id: existing._id,
        type: "student_status_change_request",
        status: "Open",
      },
      { status: "Resolved", updated_by: req.user._id },
    );

    if (requestedBy) {
      await Notification.create({
        recipient_role: ROLES.ACCOUNTS_MANAGER,
        recipient_user_id: requestedBy,
        branch: existing.branch,
        type: "student_status_change_declined",
        related_student_id: existing._id,
        status: "Open",
        title: `Status change declined: ${existing.full_name}`,
        message: `Your request to change ${existing.full_name}'s status from ${fromStatus} to ${toStatus} was declined by the Principal.`,
      });
    }

    res.json({ success: true, data: existing });
  },
);

// Addition-approval workflow (Accounts Manager -> Admin Officer). Unlike
// the delete/status-change requests above, there's no Student document yet
// to hang request fields on - the request lives in its own collection (see
// models/StudentAdditionRequest.js), and only turns into a real Student
// (+ a StudentFeeReport seeded from the class's FeeStructure) once an
// Admin Officer assigned to the request's branch approves it.

// POST /api/students/addition-requests — Accounts Manager only
// (route-gated). body: { reason, ...same fields as createStudent's body }
export const requestAdditionStudent = asyncHandler(async (req, res) => {
  if (!isAllowed("StudentAdditionRequest", "create", req.user.role)) {
    throw new ApiError(
      403,
      "Your role is not permitted to request a student addition.",
    );
  }

  const { reason, ...rest } = req.body;
  if (!reason || !String(reason).trim()) {
    throw new ApiError(
      400,
      "A reason is required so the Admin Officer has something to review.",
    );
  }

  const body = sanitizeAndScopeBody("Student", req.user, rest);
  delete body.admission_no;

  const cls = await Class.findOne({
    _id: body.class,
    is_deleted: { $ne: true },
  }).lean();
  if (!cls) throw new ApiError(404, "Selected class not found.");
  if (String(cls.branch) !== String(body.branch)) {
    throw new ApiError(400, "Selected class must belong to your branch.");
  }
  if ((cls.section || []).length > 0 && !body.section) {
    throw new ApiError(400, "Section is required for this class.");
  }

  // Duplicate advisory (non-blocking) - a legitimate second sibling can
  // share a phone number, so this only flags it for the Admin Officer
  // rather than refusing the request outright.
  let duplicateWarning = "";
  if (body.parent_phone) {
    const dup = await Student.findOne({
      branch: body.branch,
      full_name: body.full_name,
      parent_phone: body.parent_phone,
      is_deleted: { $ne: true },
    }).lean();
    if (dup) {
      duplicateWarning = ` Note: a student named ${body.full_name} with the same parent phone number already exists (Adm. No ${dup.admission_no}) — please verify this isn't a duplicate.`;
    }
  }

  const request = await StudentAdditionRequest.create({
    branch: body.branch,
    payload: {
      full_name: body.full_name,
      dob: body.dob,
      gender: body.gender,
      blood_group: body.blood_group,
      class: body.class,
      section: body.section,
      roll_no: body.roll_no,
      parent_name: body.parent_name,
      parent_phone: body.parent_phone,
      parent_email: body.parent_email,
      address: body.address,
      joining_date: body.joining_date,
      is_hosteler: body.is_hosteler,
    },
    reason: reason.trim(),
    requested_by: req.user._id,
    created_by: req.user._id,
    updated_by: req.user._id,
  });

  const notification = await Notification.create({
    recipient_role: ROLES.ADMIN_OFFICER,
    branch: body.branch,
    type: "student_addition_request",
    related_record_id: request._id,
    initiated_by: req.user._id,
    status: "Open",
    title: `Student addition requested: ${body.full_name}`,
    message: `${req.user.full_name} wants to add ${body.full_name} directly instead of through Admissions. Reason: ${reason.trim()}.${duplicateWarning} Review it on the Students page.`,
  });

  res.status(201).json({ success: true, data: { request, notification } });
});

// GET /api/students/addition-requests?status=Pending — an Accounts
// Manager only sees requests they submitted themselves (there's no
// per-student row to hang a "pending" badge off of, unlike delete/
// status-change requests); an Admin Officer sees every pending request
// across the branches assigned to them.
export const listAdditionRequestsStudent = asyncHandler(async (req, res) => {
  if (!isAllowed("StudentAdditionRequest", "read", req.user.role)) {
    throw new ApiError(
      403,
      "Your role is not permitted to view student addition requests.",
    );
  }

  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  if (req.user.role === ROLES.ADMIN_OFFICER) {
    filter.branch = { $in: req.user.branches || [] };
  } else if (req.user.branch) {
    filter.branch = req.user.branch;
    filter.requested_by = req.user._id;
  }

  const requests = await StudentAdditionRequest.find(filter)
    .sort("-created_date")
    .populate("requested_by", "full_name")
    .lean();
  res.json({ success: true, data: requests });
});

// PUT /api/students/addition-requests/:id/approve — Admin Officer only,
// assigned branches only.
export const approveAdditionRequestStudent = asyncHandler(async (req, res) => {
  const request = await StudentAdditionRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, "Student addition request not found.");

  if (!isBranchAdminOfficer(req.user, request.branch)) {
    throw new ApiError(
      403,
      "You do not have permission to approve this student addition request.",
    );
  }
  if (request.status !== "Pending") {
    throw new ApiError(
      409,
      `This request was already ${request.status.toLowerCase()}.`,
    );
  }

  const cls = await Class.findOne({
    _id: request.payload.class,
    is_deleted: { $ne: true },
  }).lean();
  if (!cls) throw new ApiError(404, "The requested class no longer exists.");

  const feeStructure = await FeeStructure.findOne({
    branch: request.branch,
    academic_year: cls.academic_year,
    grade: cls.grade,
    is_deleted: { $ne: true },
  }).lean();
  if (!feeStructure) {
    throw new ApiError(
      409,
      `No fee structure configured for ${cls.grade} (${cls.academic_year}) — configure one before approving.`,
    );
  }

  const payload = request.payload.toObject();

  // The school comes from the branch the request was raised for - i.e. the
  // requesting Accounts Manager's school - NOT from the Admin Officer
  // approving it. An Admin Officer is assigned to several branches and
  // carries a schoolName of their own, so stamping req.user.schoolName here
  // filed the student under the approver's school instead of the school the
  // request actually came from.
  const schoolName = await resolveSchoolNameForBranch(
    request.branch,
    req.user.schoolName,
  );

  // Same collision-retry loop createStudent uses - generateAdmissionNo()
  // already re-verifies its candidate against every Student, so a
  // duplicate-key error here can only mean a genuine concurrent race.
  const MAX_CREATE_ATTEMPTS = 3;
  let student;
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const admission_no = await generateAdmissionNo(request.branch);
    try {
      student = await Student.create({
        ...payload,
        admission_no,
        branch: request.branch,
        status: "Active",
        created_by: req.user._id,
        updated_by: req.user._id,
        schoolName,
      });
      break;
    } catch (err) {
      const isAdmissionNoCollision =
        err.code === 11000 && err.keyPattern?.admission_no;
      if (!isAdmissionNoCollision || attempt === MAX_CREATE_ATTEMPTS - 1) {
        throw err;
      }
    }
  }

  await StudentFeeReport.create(
    studentFeeReportFromStructure(student, feeStructure, req.user._id),
  );

  request.status = "Approved";
  request.reviewed_by = req.user._id;
  request.reviewed_at = new Date();
  request.created_student_id = student._id;
  request.updated_by = req.user._id;
  await request.save({ validateModifiedOnly: true });

  await Notification.updateMany(
    {
      related_record_id: request._id,
      type: "student_addition_request",
      status: "Open",
    },
    { status: "Resolved", updated_by: req.user._id },
  );

  await Notification.create({
    recipient_role: ROLES.ACCOUNTS_MANAGER,
    recipient_user_id: request.requested_by,
    branch: request.branch,
    type: "student_addition_result",
    related_record_id: request._id,
    related_student_id: student._id,
    status: "Open",
    title: `Student addition approved: ${student.full_name}`,
    message: `Your request to add ${student.full_name} was approved by the Admin Officer. Admission No: ${student.admission_no}.`,
  });

  res.json({ success: true, data: { request, student } });
});

// PUT /api/students/addition-requests/:id/reject — Admin Officer only,
// assigned branches only. body: { rejection_reason }
export const rejectAdditionRequestStudent = asyncHandler(async (req, res) => {
  const request = await StudentAdditionRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, "Student addition request not found.");

  if (!isBranchAdminOfficer(req.user, request.branch)) {
    throw new ApiError(
      403,
      "You do not have permission to reject this student addition request.",
    );
  }
  if (request.status !== "Pending") {
    throw new ApiError(
      409,
      `This request was already ${request.status.toLowerCase()}.`,
    );
  }

  request.status = "Rejected";
  request.reviewed_by = req.user._id;
  request.reviewed_at = new Date();
  request.rejection_reason = req.body?.rejection_reason || null;
  request.updated_by = req.user._id;
  await request.save({ validateModifiedOnly: true });

  await Notification.updateMany(
    {
      related_record_id: request._id,
      type: "student_addition_request",
      status: "Open",
    },
    { status: "Resolved", updated_by: req.user._id },
  );

  await Notification.create({
    recipient_role: ROLES.ACCOUNTS_MANAGER,
    recipient_user_id: request.requested_by,
    branch: request.branch,
    type: "student_addition_result",
    related_record_id: request._id,
    status: "Open",
    title: `Student addition rejected: ${request.payload.full_name}`,
    message: request.rejection_reason
      ? `Your request to add ${request.payload.full_name} was rejected by the Admin Officer. Reason: ${request.rejection_reason}`
      : `Your request to add ${request.payload.full_name} was rejected by the Admin Officer.`,
  });

  res.json({ success: true, data: request });
});

// PUT /api/students/addition-requests/:id/withdraw — the Accounts
// Manager who submitted it, only while still Pending.
export const withdrawAdditionRequestStudent = asyncHandler(async (req, res) => {
  const request = await StudentAdditionRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, "Student addition request not found.");

  if (String(request.requested_by) !== String(req.user._id)) {
    throw new ApiError(403, "You can only withdraw a request you submitted.");
  }
  if (request.status !== "Pending") {
    throw new ApiError(
      409,
      `This request was already ${request.status.toLowerCase()}.`,
    );
  }

  request.status = "Withdrawn";
  request.updated_by = req.user._id;
  await request.save({ validateModifiedOnly: true });

  await Notification.updateMany(
    {
      related_record_id: request._id,
      type: "student_addition_request",
      status: "Open",
    },
    { status: "Resolved", updated_by: req.user._id },
  );

  res.json({ success: true, data: request });
});
