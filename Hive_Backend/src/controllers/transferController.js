// controllers/transferController.js
//
// The Transfers page - one form, seven transfer types, all driven through
// this one endpoint (POST /api/transfers, body: { type, student_id, ... }).
// Every type touches Student and/or StudentFeeReport in whatever
// combination keeps them from drifting apart (e.g. hostel status used to
// live in two places - Student.is_hosteler and
// StudentFeeReport.has_hostel_fee - edited from two different forms with
// nothing keeping them in sync; every type here moves both together).
//
// Types:
//   class          - move to a different Class within the same branch.
//                    Not a promotion (see promoteStudents in
//                    studentController.js for the grade/year-ordered
//                    version) - this is a same-year correction/regroup.
//   section        - move to a different section of the SAME class. The
//                    only type that deliberately leaves StudentFeeReport
//                    completely untouched: every class-driven fee bucket
//                    is keyed on branch+grade (see FeeStructure), and
//                    section is neither part of that key nor even a field
//                    on StudentFeeReport - so re-grouping a student within
//                    their own class cannot change what they owe.
//   transport_on   - opt in to transport: set route + fee.
//   route          - already on transport: change route (fee optional).
//   hostel_on      - opt in to hostel: set fee.
//   hostel_off     - opt out of hostel. Any unpaid hostel balance rolls
//                    into old_fee rather than being discarded.
//   transport_off  - opt out of transport, same balance-rollover rule.

import Student from "../models/Student.js";
import Class from "../models/Class.js";
import StudentFeeReport from "../models/StudentFeeReport.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { isAllowed } from "../rbac/permissions.js";
import { buildScopeFilter } from "../middleware/branchScope.js";
import FeeStructure from "../models/FeeStructure.js";

// Every type here is ultimately a Student update (a class/hostel/transport
// move), so it's gated the same way studentController.js gates
// updateStudent - only whichever role(s) rbac/permissions.js grants
// Student "update" to (accounts_manager today).
function assertAllowed(role) {
  if (!isAllowed("Student", "update", role)) {
    throw new ApiError(403, "Your role is not permitted to transfer students.");
  }
}

async function loadStudent(req) {
  const { student_id } = req.body;
  if (!student_id) throw new ApiError(400, "student_id is required.");
  const scope = buildScopeFilter("Student", req.user);
  const student = await Student.findOne({ _id: student_id, ...scope });
  if (!student) throw new ApiError(404, "Student not found.");
  return student;
}

// One active fee report per student is the assumption the rest of the app
// already makes (BPFees.jsx, pdfExport.js's resolveDueFees, etc.) - reused
// here rather than inventing a different lookup rule for this one feature.
async function loadActiveReport(studentId) {
  return StudentFeeReport.findOne({ student_id: studentId, status: "Active" });
}

function requireReport(report) {
  if (!report) {
    throw new ApiError(
      404,
      "No fee report found for this student - set one up on the Student Fee Report page first.",
    );
  }
  return report;
}

function requireAmount(amount) {
  const n = Number(amount);
  if (!(n >= 0)) throw new ApiError(400, "A valid fee amount is required.");
  return n;
}

function requireRoute(route) {
  const r = String(route || "").trim();
  if (!r) throw new ApiError(400, "A route is required.");
  return r;
}

// Recomputes a one-time fee bucket that's also defined per class/grade in
// FeeStructure (admission/registration/application) against the NEW
// class - only if it was already active on this report. Carries
// `paid_X_fee` and the concession forward instead of resetting them, so a
// class change adjusts what's still owed rather than discarding payment
// history (mirrors the term-fee treatment in transferClassFeeUpdate).
// If the new class's FeeStructure has no value for this bucket, it turns
// off and only its own still-outstanding balance rolls into old_fee -
// `paid_X_fee` is left as-is, since it's already-collected money and
// zeroing it would falsify the ledger. If it wasn't active before the
// change, it's left inactive - a class change must never newly conjure a
// fee obligation the student wasn't already being charged.
function applyClassDrivenBucket(report, hasKey, prefix, newGrossValue) {
  if (!report[hasKey]) return;

  const grossKey = `${prefix}_gross_fee`;
  const concessionKey = `${prefix}_concession`;
  const netKey = `net_${prefix}_fee`;
  const paidKey = `paid_${prefix}_fee`;
  const balanceKey = `balance_${prefix}_fee`;

  if (newGrossValue != null) {
    report[grossKey] = newGrossValue;
    report[netKey] = Math.max(newGrossValue - (report[concessionKey] || 0), 0);
    report[balanceKey] = Math.max(
      report[netKey] - (report[paidKey] || 0),
      0,
    );
  } else {
    report.old_fee = (report.old_fee || 0) + Math.max(report[balanceKey] || 0, 0);
    report[hasKey] = false;
    report[grossKey] = 0;
    report[netKey] = 0;
    report[balanceKey] = 0;
  }
}

// Persist only the fields this transfer actually changes, via updateOne
// rather than student.save() - matches the pattern updateStudent/
// promoteStudents already use in studentController.js. student.save()
// validates the ENTIRE document (every required field, not just the ones
// modified), and real Student records that predate a since-added required
// field (e.g. schoolName) fail that full-document validation even though
// the transfer never touches schoolName at all. updateOne's runValidators
// only validates the paths actually being $set, which is what we want -
// the class/branch relationship is already checked manually below where
// it matters (transferClass), so no schema hook is being relied on here.
async function persistStudent(req, student, fields) {
  Object.assign(student, fields);
  await Student.updateOne(
    { _id: student._id },
    { $set: { ...fields, updated_by: req.user._id } },
    { runValidators: true },
  );
}

// Response shape every type returns, so the frontend's "Current status" /
// before-after panel can refresh straight off the transfer response
// instead of re-fetching.
function summarize(student, report) {
  return {
    student: {
      _id: student._id,
      full_name: student.full_name,
      admission_no: student.admission_no,
      class: student.class,
      section: student.section,
      is_hosteler: student.is_hosteler,
      transport_route: student.transport_route,
    },
    report: report
      ? {
          _id: report._id,
          class: report.class,
          has_transport_fee: report.has_transport_fee,
          transport_gross_fee: report.transport_gross_fee,
          balance_transport_fee: report.balance_transport_fee,
          has_hostel_fee: report.has_hostel_fee,
          hostel_gross_fee: report.hostel_gross_fee,
          balance_hostel_fee: report.balance_hostel_fee,
          old_fee: report.old_fee,
        }
      : null,
  };
}

async function transferClassFeeUpdate(req, branchId, grade) {
  const { student_id, class_id } = req.body;

  // 1. Run database queries in parallel for maximum speed
  // Use .lean() on FeeStructure since we only need to read its plain values
  const [report, feeStructure] = await Promise.all([
    StudentFeeReport.findOne({
      student_id,
      status: "Active",
    }),
    FeeStructure.findOne({
      branch: branchId,
      grade: grade,
      is_deleted: { $ne: true },
    }).lean(),
  ]);

  if (!report) {
    throw new ApiError(404, "Active fee report not found for the student.");
  }
  if (!feeStructure) {
    throw new ApiError(
      404,
      "Fee structure not found for the new class and branch.",
    );
  }

  // 2. Aggregate pending balances into old_fee - term/admission/
  // registration/application are NOT included here: they're recomputed
  // against the new class's FeeStructure below (see applyClassDrivenBucket
  // and the term-fee block), which already produces the correct remaining
  // balance directly - also rolling their pre-change balance into old_fee
  // would double-count the same debt. Transport/hostel/kit/other aren't
  // class-driven, so they keep rolling their unpaid balance forward exactly
  // as before.
  const pendingFees =
    (report.old_fee || 0) +
    (report.balance_transport_fee || 0) +
    (report.balance_hostel_fee || 0) +
    (report.balance_kit_fee || 0) +
    (report.balance_other_fee || 0);

  // 3. Batch assign updated fields to the document
  Object.assign(report, {
    class: class_id || report.class,
    branch: branchId || report.branch,
    old_fee: pendingFees,

    // Reset one-time fee buckets not covered by FeeStructure (their prior
    // balances were rolled into old_fee above)
    has_kit_fee: false,
    kit_gross_fee: 0,
    kit_concession: 0,
    net_kit_fee: 0,
    paid_kit_fee: 0,
    balance_kit_fee: 0,

    has_other_fee: false,
    other_gross_fee: 0,
    other_concession: 0,
    net_other_fee: 0,
    paid_other_fee: 0,
    balance_other_fee: 0,
  });

  // Term/Tuition fee is always active (schema default) - adjust against the
  // new class's fee instead of resetting: carry the concession and
  // whatever's already been paid forward, then clamp the balance at 0 so an
  // overpayment (vs. the new, possibly lower, fee) never reads as a refund
  // owed.
  report.gross_term_fee = feeStructure.tuition_fee || 0;
  report.net_term_fee = Math.max(
    report.gross_term_fee - (report.term_concession || 0),
    0,
  );
  report.balance_term_fee = Math.max(
    report.net_term_fee - (report.paid_term_fee || 0),
    0,
  );

  // Admission/Registration/Application are one-time fees that are also
  // defined per class/grade in FeeStructure - same adjustment as term, but
  // only if the bucket was already active on this report (see
  // applyClassDrivenBucket above).
  applyClassDrivenBucket(report, "has_admission_fee", "adm", feeStructure.admission_fee);
  applyClassDrivenBucket(report, "has_registration_fee", "registration", feeStructure.registration_fee);
  applyClassDrivenBucket(report, "has_application_fee", "application", feeStructure.application_fee);

  // Transport Fee handling
  if (report.has_transport_fee) {
    report.transport_concession = 0;
    report.net_transport_fee = report.transport_gross_fee;
    report.paid_transport_fee = 0;
    report.balance_transport_fee = report.transport_gross_fee;
  } else {
    report.transport_gross_fee = 0;
    report.transport_concession = 0;
    report.net_transport_fee = 0;
    report.paid_transport_fee = 0;
    report.balance_transport_fee = 0;
  }

  // Hostel Fee handling
  if (report.has_hostel_fee) {
    report.hostel_concession = 0;
    report.net_hostel_fee = report.hostel_gross_fee;
    report.paid_hostel_fee = 0;
    report.balance_hostel_fee = report.hostel_gross_fee;
  } else {
    report.hostel_gross_fee = 0;
    report.hostel_concession = 0;
    report.net_hostel_fee = 0;
    report.paid_hostel_fee = 0;
    report.balance_hostel_fee = 0;
  }

  // Remove term, hostel and transport from concession_locked_buckets array
  report.concession_locked_buckets = report.concession_locked_buckets.filter(
    (bucket) => !["term", "hostel", "transport"].includes(bucket),
  );

  if (req.user?._id) {
    report.updated_by = req.user._id;
  }
  // Update time as well
  report.updated_date = new Date();

  await report.save();
  return report;
}

async function transferClass(req, student) {
  const { class_id } = req.body;
  if (!class_id) throw new ApiError(400, "class_id is required.");

  const targetClass = await Class.findOne({
    _id: class_id,
    is_deleted: { $ne: true },
  }).lean();
  if (!targetClass) throw new ApiError(404, "Target class not found.");
  if (String(targetClass.branch) !== String(student.branch)) {
    throw new ApiError(400, "Target class belongs to a different branch.");
  }

  // Section is scoped to a class, not the student - the new class's own
  // section list (if it has one) is the only thing that decides whether a
  // section is required/valid here, same rule BPStudents.jsx's Add/Edit
  // form already applies on create/edit. A sectionless class always clears
  // it, regardless of what the old class's section was.
  const targetSections = targetClass.section || [];
  let section = null;
  if (targetSections.length > 0) {
    section = String(req.body.section || "").trim();
    if (!section || !targetSections.includes(section)) {
      throw new ApiError(
        400,
        `section must be one of: ${targetSections.join(", ")}.`,
      );
    }
  }

  await persistStudent(req, student, { class: targetClass._id, section });

  // transferClassFeeUpdate reads class_id/student_id straight off req.body,
  // does its own fetch-modify-save of the active report, and returns the
  // saved (post-update) document - use that directly rather than a
  // separately-fetched, pre-update copy, so the response the frontend
  // renders actually reflects the recalculated fees.
  const report = await transferClassFeeUpdate(
    req,
    targetClass.branch,
    targetClass.grade,
  );
  return summarize(student, report);
}

// A pure regroup within the student's current class - no class change, so
// no fee recalculation (see the `section` note in the header comment).
// Deliberately does NOT route through transferClass: that path drags
// transferClassFeeUpdate along with it, rolling balances into old_fee and
// resetting paid_* buckets - wrong for a move that changes nothing the
// student is charged for.
async function transferSection(req, student) {
  const currentClassId =
    typeof student.class === "object" ? student.class?._id : student.class;
  if (!currentClassId) {
    throw new ApiError(400, "Student is not assigned to a class.");
  }

  const currentClass = await Class.findOne({
    _id: currentClassId,
    is_deleted: { $ne: true },
  }).lean();
  if (!currentClass) throw new ApiError(404, "Current class not found.");

  // Same rule transferClass applies, just against the class the student is
  // already in: the class's own section list is the only source of truth
  // for what's valid.
  const sections = currentClass.section || [];
  if (sections.length === 0) {
    throw new ApiError(
      400,
      "This class has no sections configured - add them on the Classes page first.",
    );
  }

  const section = String(req.body.section || "").trim();
  if (!section || !sections.includes(section)) {
    throw new ApiError(400, `section must be one of: ${sections.join(", ")}.`);
  }
  if (section === (student.section || "")) {
    throw new ApiError(400, "Student is already in that section.");
  }

  await persistStudent(req, student, { section });

  // The report is read back only so this type's response has the same
  // shape as every other one - it is never written to here.
  return summarize(student, await loadActiveReport(student._id));
}

async function transferTransportOn(req, student) {
  const route = requireRoute(req.body.route);
  const amount = requireAmount(req.body.amount);
  const report = requireReport(await loadActiveReport(student._id));

  report.has_transport_fee = true;
  report.transport_gross_fee = amount;
  report.transport_concession = 0;
  await report.save();

  await persistStudent(req, student, { transport_route: route });

  return summarize(student, report);
}

async function transferRoute(req, student) {
  const route = requireRoute(req.body.route);
  const report = requireReport(await loadActiveReport(student._id));
  if (!report.has_transport_fee) {
    throw new ApiError(
      400,
      "Student is not currently on transport - use Transfer to Transport instead.",
    );
  }
  // Validate the (optional) amount before writing anything - otherwise an
  // invalid amount would throw after the route was already saved, leaving
  // the student's route updated but the request reported as failed.
  const amountProvided =
    req.body.amount !== undefined &&
    req.body.amount !== null &&
    req.body.amount !== "";
  const amount = amountProvided ? requireAmount(req.body.amount) : null;

  await persistStudent(req, student, { transport_route: route });

  if (amountProvided) {
    report.transport_gross_fee = amount;
    await report.save();
  }

  return summarize(student, report);
}

async function transferHostelOn(req, student) {
  const amount = requireAmount(req.body.amount);
  const report = requireReport(await loadActiveReport(student._id));

  report.has_hostel_fee = true;
  report.hostel_gross_fee = amount;
  report.hostel_concession = 0;
  await report.save();

  await persistStudent(req, student, { is_hosteler: true });

  return summarize(student, report);
}

// hostel_off / transport_off share the same "don't lose money" rule: any
// balance still outstanding on the bucket being turned off is rolled into
// old_fee (the schema's own catch-all for "owed, but not a structured
// bucket") rather than zeroed - the gross/paid history on the bucket
// itself is left untouched, it just stops being surfaced in the focused
// Hostel/Transport Fee Report once the flag flips off.
async function transferHostelOff(req, student) {
  const report = requireReport(await loadActiveReport(student._id));
  if (!report.has_hostel_fee) {
    throw new ApiError(
      400,
      "Student is not currently marked as a hostel student.",
    );
  }

  const outstanding = Math.max(0, report.balance_hostel_fee || 0);
  report.old_fee = (report.old_fee || 0) + outstanding;
  report.has_hostel_fee = false;
  await report.save();

  await persistStudent(req, student, { is_hosteler: false });

  return summarize(student, report);
}

async function transferTransportOff(req, student) {
  const report = requireReport(await loadActiveReport(student._id));
  if (!report.has_transport_fee) {
    throw new ApiError(400, "Student is not currently on transport.");
  }

  const outstanding = Math.max(0, report.balance_transport_fee || 0);
  report.old_fee = (report.old_fee || 0) + outstanding;
  report.has_transport_fee = false;
  await report.save();

  await persistStudent(req, student, { transport_route: "" });

  return summarize(student, report);
}

const HANDLERS = {
  class: transferClass,
  section: transferSection,
  transport_on: transferTransportOn,
  route: transferRoute,
  hostel_on: transferHostelOn,
  hostel_off: transferHostelOff,
  transport_off: transferTransportOff,
};

// POST /api/transfers
// body: { type, student_id, ...type-specific fields (see HANDLERS above) }
export const transferStudent = asyncHandler(async (req, res) => {
  assertAllowed(req.user.role);

  const { type } = req.body;
  const handler = HANDLERS[type];
  if (!handler) {
    throw new ApiError(400, `Unknown transfer type "${type}".`);
  }

  const student = await loadStudent(req);
  const data = await handler(req, student);
  res.json({ success: true, data });
});
