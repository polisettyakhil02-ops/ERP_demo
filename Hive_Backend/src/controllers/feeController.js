// controllers/feeController.js
//
// FeePayment (individual payment transactions) and StudentFeeReport (a
// student's fee STRUCTURE - what they owe, what's paid, what's left)
// merged into one file - collectPayment() already has to touch both
// models in a single call, so keeping them apart across two files never
// really reflected the actual coupling between them.
//
// Payment-related exports: listPayments, pendingSummary, createPayment,
//   collectPayment, updatePayment, removePayment
// Report-related exports:  listReports, createReport, updateReport,
//   removeReport, listEligibleStudents
//
// isAllowed(entityName, action, role) - rbac/permissions.js has separate
// entries for "FeePayment" and "StudentFeeReport" (both grant
// ADMIN_OFFICER/ACCOUNTS_MANAGER create/update, PRINCIPAL read-only,
// PRINCIPAL added to FeePayment's delete too) - the merge is a file-
// organization change only, not a permissions change; each function
// below still checks the correct entity name for what it's touching.

import mongoose from "mongoose";
import FeePayment from "../models/FeePayment.js";
import Student from "../models/Student.js";
import StudentFeeReport from "../models/StudentFeeReport.js";
import BackDateRequest from "../models/BackDateRequest.js";
import FeeReceiptCancellationRequest from "../models/FeeReceiptCancellationRequest.js";
import Notification from "../models/Notification.js";
import Class from "../models/Class.js";
import { isAllowed } from "../rbac/permissions.js";
import {
  generateReceiptNo,
  generateVoucherNo,
} from "../utils/admissionNumbering.js";
import { resolveBranchQueryFilter } from "../middleware/branchScope.js";
import { todayDateString } from "../utils/dateUtils.js";
import { ApiError } from "../utils/ApiError.js";
import { ROLES } from "../config/constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const PAYMENT_ENTITY = "FeePayment";
const REPORT_ENTITY = "StudentFeeReport";

const ROW_TO_FEE_TYPE = {
  school_fee: "School Fee",
  // "School Fee" and "Term Fee" are the same real-world fee and share one
  // report bucket (gross_term_fee/paid_term_fee/balance_term_fee) - both
  // row keys below increment the same balance in collectPayment(). The
  // "Term Fee" label is kept only so payments already tagged that way
  // stay valid; the Fee Payments form no longer has a separate input for it.
  term_fee: "Term Fee",
  admission_fee: "Admission Fee",
  previous_due: "Previous Due",
  application_fee: "Application Fee",
  transport_fee: "Transport Fee",
  registration_fee: "Registration Fee",
  hostel_fee: "Hostel Fee",
  // Kit Fee / Other Income have a StudentFeeReport bucket (kit_gross_fee/
  // kit_concession/paid_kit_fee, same for other_*) but unlike the other 6
  // buckets it has no fixed target - families buy different item
  // combinations each year, so there's nothing to cap a single row against.
  // These two rows are intentionally absent from ROW_TO_BALANCE_FIELD below
  // (the capping loop in collectPayment() skips them), but the report-
  // update loop further down DOES accumulate onto kit_gross_fee/
  // kit_concession/paid_kit_fee as a running ledger - see that loop's
  // kit_fee/other_income branches.
  kit_fee: "Kit Fee",
  other_income: "Other",
};

// Which StudentFeeReport field caps each row's amount in collectPayment() -
// "previous_due" is handled separately (it caps against `old_fee`, a flat
// number, not a balance_*_fee bucket field).
const ROW_TO_BALANCE_FIELD = {
  school_fee: "balance_term_fee",
  term_fee: "balance_term_fee",
  admission_fee: "balance_adm_fee",
  application_fee: "balance_application_fee",
  transport_fee: "balance_transport_fee",
  registration_fee: "balance_registration_fee",
  hostel_fee: "balance_hostel_fee",
};

// Caps every row at the report's remaining balance for that bucket - a row
// can't collect more than is actually owed. Returns an ApiError to throw, or
// null when every row fits. Tracked as a running "remaining" total per bucket
// in case more than one row targets the same bucket in a single call.
//
// collectPayment() runs this twice: once before the receipt number is drawn,
// so an over-entered amount fails fast without burning a number out of the
// branch's receipt sequence (generateReceiptNo advances a counter), and again
// inside the transaction, where it's the authoritative check - there the
// figures it caps against are the same ones the save writes to, rather than a
// snapshot a concurrent collection may already have moved past.
function checkRowBalances(report, rows) {
  const remaining = {};
  for (const row of rows) {
    const amount = Number(row.amount);
    if (row.key === "previous_due") {
      if (remaining.old_fee === undefined)
        remaining.old_fee = report.old_fee || 0;
      if (amount > remaining.old_fee) {
        return new ApiError(
          400,
          `Previous Due amount (₹${amount}) exceeds the outstanding balance (₹${remaining.old_fee}).`,
        );
      }
      remaining.old_fee -= amount;
      continue;
    }
    // kit_fee/other_income have no ROW_TO_BALANCE_FIELD entry - there's
    // nothing "owed" to cap them against (they're one-off collections, not a
    // StudentFeeReport bucket), so nothing to check here.
    const balanceField = ROW_TO_BALANCE_FIELD[row.key];
    if (!balanceField) continue;
    if (remaining[balanceField] === undefined)
      remaining[balanceField] = report[balanceField] || 0;
    if (amount > remaining[balanceField]) {
      return new ApiError(
        400,
        `${ROW_TO_FEE_TYPE[row.key]} amount (₹${amount}) exceeds the outstanding balance (₹${remaining[balanceField]}).`,
      );
    }
    remaining[balanceField] -= amount;
  }
  return null;
}

// Which has_*_fee flag and gross/concession/paid fields belong to each
// bucket - used to zero out a bucket's numbers whenever it's turned off,
// so stale data from a previously-enabled bucket never lingers.
const FEE_BUCKETS = {
  admission: {
    flag: "has_admission_fee",
    fields: ["adm_gross_fee", "adm_concession", "paid_adm_fee"],
  },
  term: {
    flag: "has_term_fee",
    fields: ["gross_term_fee", "term_concession", "paid_term_fee"],
  },
  transport: {
    flag: "has_transport_fee",
    fields: [
      "transport_gross_fee",
      "transport_concession",
      "paid_transport_fee",
    ],
  },
  hostel: {
    flag: "has_hostel_fee",
    fields: ["hostel_gross_fee", "hostel_concession", "paid_hostel_fee"],
  },
  application: {
    flag: "has_application_fee",
    fields: [
      "application_gross_fee",
      "application_concession",
      "paid_application_fee",
    ],
  },
  registration: {
    flag: "has_registration_fee",
    fields: [
      "registration_gross_fee",
      "registration_concession",
      "paid_registration_fee",
    ],
  },
  kit: {
    flag: "has_kit_fee",
    fields: ["kit_gross_fee", "kit_concession", "paid_kit_fee"],
  },
  other: {
    flag: "has_other_fee",
    fields: ["other_gross_fee", "other_concession", "paid_other_fee"],
  },
};

// The 6 fixed-value concession buckets the lock/request-change workflow
// applies to (see StudentFeeReport.concession_locked_buckets and
// concessionController.js). Kit/Other are deliberately excluded - their
// concession is a running ledger built up by collectPayment() above, not a
// value an Accounts Manager sets once, so there's nothing to "lock."
const LOCKABLE_CONCESSION_BUCKETS = {
  adm: { field: "adm_concession", label: "Admission Fee" },
  term: { field: "term_concession", label: "Term Fee" },
  transport: { field: "transport_concession", label: "Transport Fee" },
  hostel: { field: "hostel_concession", label: "Hostel Fee" },
  application: { field: "application_concession", label: "Application Fee" },
  registration: { field: "registration_concession", label: "Registration Fee" },
};

// Applied by both createReport and updateReport below. `existing` is a
// StudentFeeReport document/plain object (already-persisted fields, or {}
// for a brand-new one); `updates` is the incoming request body. Throws an
// ApiError if the caller is an Accounts Manager trying to change a bucket
// that's already locked; otherwise returns the list of bucket keys that
// should newly lock as a result of this save (any bucket whose concession
// field is present in `updates` and wasn't already locked - only relevant
// for the Accounts Manager, since Admin Officer/super_admin edits never
// lock or get blocked by a lock).
function applyConcessionLockRules(existing, updates, role) {
  const alreadyLocked = new Set(existing.concession_locked_buckets || []);
  const toLock = [];

  for (const [bucket, { field, label }] of Object.entries(
    LOCKABLE_CONCESSION_BUCKETS,
  )) {
    if (!(field in updates)) continue;

    if (role === ROLES.ACCOUNTS_MANAGER) {
      if (alreadyLocked.has(bucket)) {
        if (Number(updates[field]) !== Number(existing[field] || 0)) {
          throw new ApiError(
            403,
            `${label} concession is locked - submit a Request Change instead of editing it directly.`,
          );
        }
        // Same value re-submitted as part of a full-form save - fine, not
        // an actual edit attempt, and it's already locked so no-op.
        continue;
      }
      toLock.push(bucket);
    }
  }
  return toLock;
}

function sanitizeFeeBuckets(target) {
  for (const { flag, fields } of Object.values(FEE_BUCKETS)) {
    if (!target[flag]) {
      for (const field of fields) target[field] = 0;
    }
  }
}

// Kit/Other are a running ledger built up over many small item payments
// across the year (see collectPayment's kit_fee/other_income branches) -
// unlike the other 6 buckets, unticking one of these after money has
// actually been collected against it and letting sanitizeFeeBuckets zero
// it out would silently discard real collection history from the
// student's record (the underlying FeePayment receipts are untouched, but
// the report's own total would read 0). updateReport calls this before
// sanitizeFeeBuckets runs and rejects the request instead.
function findBlockedBucketUncheck(existing, updates) {
  for (const { flag, fields } of [FEE_BUCKETS.kit, FEE_BUCKETS.other]) {
    if (flag in updates && !updates[flag] && existing[flag]) {
      const paidField = fields[2];
      if ((existing[paidField] || 0) > 0) {
        return { flag, paidField };
      }
    }
  }
  return null;
}

// paid_*_fee only ever moves through collectPayment() - createReport/
// updateReport must never let a client set it directly, or the number
// drifts from the actual FeePayment history with no receipt behind it.
const PAID_FIELDS = [
  "paid_adm_fee",
  "paid_term_fee",
  "paid_transport_fee",
  "paid_hostel_fee",
  "paid_application_fee",
  "paid_registration_fee",
  "paid_kit_fee",
  "paid_other_fee",
];

function stripPaidFields(body) {
  for (const field of PAID_FIELDS) delete body[field];
}

const forbidden = (res, entity, action) =>
  res.status(403).json({
    success: false,
    message: `You do not have permission to ${action} ${entity === PAYMENT_ENTITY ? "fee payments" : "fee reports"}.`,
  });

// ---------------------------------------------------------------------
// FeePayment - individual payment transactions
// ---------------------------------------------------------------------

// GET /api/fee-payments
// params (all optional): student_id, academic_year, status, sort, limit, from, to,
// branch, search (matches student_name), class, payment_mode, fee_type, and
// page - when page is present the response also carries a `meta` block
// ({ total, page, limit, totalPages }); when it's omitted (existing
// callers), the endpoint behaves as before (limit alone is still a plain cap).
export const listPayments = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "read", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "view");

    const {
      student_id,
      academic_year,
      status,
      sort,
      limit,
      page,
      from,
      to,
      search,
      branch,
      class: cls,
      payment_mode,
      fee_type,
    } = req.query;
    const { allowed, filter } = resolveBranchQueryFilter(req.user, branch);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    if (student_id) filter.student_id = student_id;
    if (academic_year) filter.academic_year = academic_year;
    if (status) filter.status = status;
    if (payment_mode) filter.payment_mode = payment_mode;
    if (fee_type) filter.fee_type = fee_type;
    if (from || to) {
      filter.payment_date = {};
      if (from) filter.payment_date.$gte = new Date(from);
      if (to) filter.payment_date.$lte = new Date(to);
    }
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.student_name = re;
    }
    // FeePayment has no `class` field of its own (only student_id) - resolve
    // the class down to its Student ids first, same as listPendingFees does
    // against StudentFeeReport (which DOES carry `class` directly).
    if (cls) {
      const studentIds = await Student.find({ class: cls }).distinct("_id");
      filter.student_id = { $in: studentIds };
    }

    let query = FeePayment.find(filter);
    if (sort) query = query.sort(sort);

    let meta;
    if (page) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const pageSize = Math.max(parseInt(limit, 10) || 25, 1);
      const total = await FeePayment.countDocuments(filter);
      query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
      meta = {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      };
    } else if (limit) {
      query = query.limit(Number(limit));
    }

    const payments = await query.lean();

    // FeePayment has no `class`/`admission_no` fields of its own - resolve
    // them from each row's student_id so BPFees.jsx's Payments table (and
    // the Today's Fee Report export) can show them without a separate
    // round trip per row.
    const studentIds = [
      ...new Set(payments.map((p) => String(p.student_id))),
    ];
    const students = await Student.find({ _id: { $in: studentIds } })
      .select("class admission_no")
      .lean();
    const studentById = Object.fromEntries(
      students.map((s) => [String(s._id), s]),
    );
    for (const p of payments) {
      const student = studentById[String(p.student_id)];
      p.class = student?.class || null;
      p.admission_no = student?.admission_no || "";
    }

    return res.json({ success: true, data: payments, ...(meta && { meta }) });
  } catch (err) {
    console.error("fee.listPayments error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch fee payments." });
  }
};

// GET /api/fee-payments/payments-summary  (same filters as listPayments,
// minus page/limit) - total collected via a Mongo aggregation, so
// BPFees.jsx's "Total Collected" card never requires fetching every
// FeePayment row into the browser.
export const paymentsSummary = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "read", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "view");

    const { student_id, academic_year, status, from, to, search, branch } =
      req.query;
    const { allowed, filter } = resolveBranchQueryFilter(req.user, branch);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    if (student_id) filter.student_id = student_id;
    if (academic_year) filter.academic_year = academic_year;
    if (status) filter.status = status;
    if (from || to) {
      filter.payment_date = {};
      if (from) filter.payment_date.$gte = new Date(from);
      if (to) filter.payment_date.$lte = new Date(to);
    }
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.student_name = re;
    }

    const [result] = await FeePayment.aggregate([
      { $match: { ...filter, status: "Paid" } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total_collected: { $sum: "$amount" },
        },
      },
    ]);

    return res.json({
      success: true,
      data: {
        count: result?.count || 0,
        total_collected: result?.total_collected || 0,
      },
    });
  } catch (err) {
    console.error("fee.paymentsSummary error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch payments summary." });
  }
};

// GET /api/fee-payments/pending-summary
// Powers the pending-fee cards/list folded into the Fee Payments page -
// total collected, total pending, and a list of students with pending fees.
export const pendingSummary = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "read", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "view");

    const { allowed, filter } = resolveBranchQueryFilter(
      req.user,
      req.query.branch,
    );
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    if (req.query.academic_year) filter.academic_year = req.query.academic_year;

    const all = await FeePayment.find(filter).lean();
    const totalCollected = all
      .filter((f) => f.status === "Paid")
      .reduce((sum, f) => sum + (f.amount || 0), 0);
    const totalPending = all
      .filter((f) => f.status === "Pending")
      .reduce((sum, f) => sum + (f.amount || 0), 0);
    const pendingRecords = all.filter((f) => f.status === "Pending");

    return res.json({
      success: true,
      data: {
        total_collected: totalCollected,
        total_pending: totalPending,
        pending: pendingRecords,
      },
    });
  } catch (err) {
    console.error("fee.pendingSummary error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending fee summary.",
    });
  }
};

// POST /api/fee-payments - single ad-hoc record, not tied to a fee report
// row. Prefer collectPayment() for the Fee Payments page's actual flow.
export const createPayment = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "create", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "create");

    const branch = req.user.branch || req.body.branch;
    if (!branch) {
      return res
        .status(400)
        .json({ success: false, message: "A branch is required." });
    }

    const receipt_no = req.body.receipt_no || (await generateReceiptNo(branch));
    const record = await FeePayment.create({ ...req.body, branch, receipt_no });

    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A payment with that receipt number already exists.",
        details: err.keyValue,
      });
    }
    console.error("fee.createPayment error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to record fee payment." });
  }
};

export const collectPayment = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "create", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "create");

    const {
      student_fee_report_id,
      student_id,
      student_name,
      academic_year,
      payment_date,
      voucher_type,
      voucher_no,
      payment_mode,
      cheque_date,
      transaction_no,
      bank_name,
      bank_branch,
      old_fee,
      rows,
    } = req.body;

    if (!student_id || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "student_id and at least one fee row with an amount are required.",
      });
    }
    for (const row of rows) {
      if (!ROW_TO_FEE_TYPE[row.key] || !(Number(row.amount) > 0)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid row: each row needs a valid key and a positive amount.",
        });
      }
    }

    // Backdating is blocked unless there's a matching Approved (and not
    // yet used) BackDateRequest for this exact user + date. The Add Fee
    // Payment form already disables past dates in the picker, but that's
    // only ever a UX nicety - this is the real gate, since nothing stops
    // a direct API call from sending an earlier date. Not consumed yet -
    // only once the payment actually finishes saving below, so a request
    // that fails a later check (e.g. exceeds balance) doesn't burn the
    // Principal's approval for nothing.

    let backDateRequestToConsume = true; // Change to null when turning on backdate approval
    // if (payment_date && payment_date < todayDateString()) {
    //   backDateRequestToConsume = await BackDateRequest.findOne({
    //     requested_by: req.user._id,
    //     requested_date: payment_date,
    //     status: "Approved",
    //   });
    //   if (!backDateRequestToConsume) {
    //     return res.status(403).json({
    //       success: false,
    //       message: `Collecting a payment dated ${payment_date} needs Principal approval first - request a back date for this date on the Add Fee Payment form.`,
    //     });
    //   }
    // }

    // req.user.branch wins whenever it's present - same hardening as
    // createPayment() above, so a single-branch accounts manager can't
    // submit a payment against a different branch than their own.
    const branch = req.user.branch || req.body.branch;
    if (!branch) {
      return res
        .status(400)
        .json({ success: false, message: "A branch is required." });
    }

    const { allowed: reportAllowed, filter: reportFilter } =
      resolveBranchQueryFilter(req.user);
    if (!reportAllowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    reportFilter._id = student_fee_report_id;
    // Fail fast, before a receipt number is drawn and before a session is
    // opened. This read is for validation only - the transaction below
    // re-reads the report and re-runs these same checks authoritatively.
    const preCheckReport = await StudentFeeReport.findOne(reportFilter);
    if (!preCheckReport) {
      return res.status(404).json({
        success: false,
        message:
          "No fee report found for this student - set one up before recording a payment.",
      });
    }

    // Editing the Previous Due row's Actual Amount (see AddPaymentDialog.jsx)
    // corrects old_fee itself, applied before the previous_due row's own cap
    // check so that check runs against the corrected figure.
    const hasOldFeeOverride =
      old_fee !== undefined && old_fee !== null && old_fee !== "";
    if (hasOldFeeOverride && !(Number(old_fee) >= 0)) {
      return res.status(400).json({
        success: false,
        message: "Previous Due amount must be a non-negative number.",
      });
    }
    if (hasOldFeeOverride) preCheckReport.old_fee = Number(old_fee);

    const preCheckError = checkRowBalances(preCheckReport, rows);
    if (preCheckError) {
      return res
        .status(preCheckError.statusCode)
        .json({ success: false, message: preCheckError.message });
    }

    // Receipt and voucher numbers come from their own counter documents, so
    // they're drawn once out here rather than inside the transaction -
    // withTransaction re-runs its callback on a transient error, and
    // re-drawing would burn a fresh number on every retry.
    const receipt_no = req.body.receipt_no || (await generateReceiptNo(branch));
    // CV No. is always system-generated, regardless of whatever the client
    // sent - MV No. is exactly what was typed in (optional, left blank if
    // the person didn't fill it in).
    const resolvedVoucherNo =
      voucher_type === "CvNo"
        ? await generateVoucherNo(branch)
        : voucher_no || undefined;

    const sharedFields = {
      branch,
      student_id,
      student_name,
      academic_year,
      payment_date,
      payment_mode,
      voucher_type,
      voucher_no: resolvedVoucherNo,
      receipt_no,
      status: "Paid",
      cheque_date: cheque_date || undefined,
      transaction_no: transaction_no || undefined,
      bank_name: bank_name || undefined,
      bank_branch: bank_branch || undefined,
    };

    // The receipts and the report's paid_*/old_fee totals are written in ONE
    // transaction. Before this, FeePayment.create() ran first and
    // report.save() only afterwards with nothing tying the two together, so
    // anything that interrupted the request in between (a dropped
    // connection, a restart, a failed save) committed the receipt and left
    // the report's running total short. Because that total is incremented
    // rather than recomputed from the receipts, every later payment then
    // built on the wrong base and the gap never closed - the student's
    // balance stayed permanently overstated with no error anywhere to show
    // for it. Now either both writes land or neither does.
    let payments = [];
    let report;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Everything below is re-read and re-derived on each attempt:
        // withTransaction can re-run this callback after a transient error,
        // and a `report` carried over from a rolled-back attempt would still
        // be holding that attempt's in-memory increments and double-apply
        // them. Same reason admissionController.js re-fetches its admission.
        payments = [];
        report = await StudentFeeReport.findOne(reportFilter).session(session);
        if (!report) {
          throw new ApiError(
            404,
            "No fee report found for this student - set one up before recording a payment.",
          );
        }

        if (hasOldFeeOverride) report.old_fee = Number(old_fee);

        // Authoritative run of the same cap check the fail-fast pass above
        // already did - repeated here against the transaction's own read so
        // a concurrent collection that consumed part of the balance in
        // between can't slip a row through over the real remaining amount.
        const balanceError = checkRowBalances(report, rows);
        if (balanceError) throw balanceError;

        const prepared = rows.map((row) => {
          const amount = Number(row.amount);
          // Only meaningful for kit_fee/other_income rows - the DELTA this
          // payment contributes to the item's running Actual Fee/Concession
          // (not the item's cumulative total - see AddPaymentDialog.jsx, which
          // computes this before sending). Negative deltas are allowed (e.g.
          // correcting a price down) but the running bucket total is clamped
          // at 0 below so it can never go negative from a single row.
          const isKitOrOther =
            row.key === "kit_fee" || row.key === "other_income";
          return {
            row,
            amount,
            isKitOrOther,
            actualDelta: isKitOrOther ? Number(row.actual) || 0 : 0,
            concessionDelta: isKitOrOther ? Number(row.concession) || 0 : 0,
          };
        });

        // One create() for the whole receipt instead of one per row inside a
        // loop - Mongoose 8 requires `ordered: true` whenever create() is
        // given a session and more than one document (the same constraint
        // admissionController.js documents), and a single call means a
        // multi-row receipt can't half-write even before the transaction
        // wraps it.
        payments = await FeePayment.create(
          prepared.map(
            ({ row, amount, isKitOrOther, actualDelta, concessionDelta }) => ({
              ...sharedFields,
              fee_type: ROW_TO_FEE_TYPE[row.key],
              amount,
              // Only meaningful for kit_fee/other_income rows - which item
              // (e.g. "Text Books") this row is for, since neither has a
              // StudentFeeReport bucket to track per-item history against.
              item_name:
                typeof row.item_name === "string" && row.item_name.trim()
                  ? row.item_name.trim()
                  : undefined,
              item_actual_fee: isKitOrOther ? actualDelta : undefined,
              item_concession_fee: isKitOrOther ? concessionDelta : undefined,
            }),
          ),
          { session, ordered: true },
        );

        for (const { row, amount, actualDelta, concessionDelta } of prepared) {
          if (row.key === "school_fee" || row.key === "term_fee") {
            report.paid_term_fee = (report.paid_term_fee || 0) + amount;
          } else if (row.key === "admission_fee") {
            report.paid_adm_fee = (report.paid_adm_fee || 0) + amount;
          } else if (row.key === "previous_due") {
            report.old_fee = Math.max(0, (report.old_fee || 0) - amount);
          } else if (row.key === "transport_fee") {
            report.paid_transport_fee =
              (report.paid_transport_fee || 0) + amount;
          } else if (row.key === "hostel_fee") {
            report.paid_hostel_fee = (report.paid_hostel_fee || 0) + amount;
          } else if (row.key === "application_fee") {
            report.paid_application_fee =
              (report.paid_application_fee || 0) + amount;
          } else if (row.key === "registration_fee") {
            report.paid_registration_fee =
              (report.paid_registration_fee || 0) + amount;
          } else if (row.key === "kit_fee") {
            report.has_kit_fee = true;
            report.paid_kit_fee = (report.paid_kit_fee || 0) + amount;
            report.kit_gross_fee = Math.max(
              0,
              (report.kit_gross_fee || 0) + actualDelta,
            );
            report.kit_concession = Math.max(
              0,
              (report.kit_concession || 0) + concessionDelta,
            );
          } else if (row.key === "other_income") {
            report.has_other_fee = true;
            report.paid_other_fee = (report.paid_other_fee || 0) + amount;
            report.other_gross_fee = Math.max(
              0,
              (report.other_gross_fee || 0) + actualDelta,
            );
            report.other_concession = Math.max(
              0,
              (report.other_concession || 0) + concessionDelta,
            );
          }
        }

        // triggers pre-validate recompute of net/balance fields
        await report.save({ session });

        // Only burned once the payment this grant was for actually went
        // through - a single approval is single-use, not a standing "this
        // person can always backdate" flag. Inside the transaction too, so a
        // rollback hands the approval back unused.

        // if (backDateRequestToConsume) {
        //   backDateRequestToConsume.status = "Used";
        //   backDateRequestToConsume.used_at = new Date();
        //   await backDateRequestToConsume.save({ session });
        // }
      });
    } finally {
      await session.endSession();
    }

    return res.status(201).json({ success: true, data: { payments, report } });
  } catch (err) {
    // The balance/validation checks above run inside the transaction (so they
    // see the same figures the save writes to), which means they surface here
    // as an ApiError rather than as an early return.
    if (err instanceof ApiError) {
      return res
        .status(err.statusCode)
        .json({ success: false, message: err.message });
    }
    console.log("fee.collectPayment error:", err);
    console.error("fee.collectPayment error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to record payment." });
  }
};

// PUT /api/fee-payments/:id
// Used both for general edits and for cancelling a voucher
// (body: { status: "Cancelled" }).
export const updatePayment = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "update", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "update");

    const { allowed, filter } = resolveBranchQueryFilter(req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    filter._id = req.params.id;

    // Editing a payment has to move the student's report with it. This used
    // to be a bare Object.assign + save: changing an amount, flipping a row
    // between Paid and Cancelled, or retyping its fee_type left the report's
    // paid_* totals sitting on the old figures, with nothing anywhere to
    // flag the drift. Reversing the pre-edit row out and applying the
    // post-edit one back in keeps the two in step, and the transaction means
    // a failure can't land one without the other.
    let updated;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const payment = await FeePayment.findOne(filter).session(session);
        if (!payment) throw new ApiError(404, "Fee payment not found.");

        // Snapshot of the row as it stands now, as a plain object so it
        // keeps these values once `payment` itself is mutated below.
        const before = {
          student_id: payment.student_id,
          branch: payment.branch,
          fee_type: payment.fee_type,
          amount: payment.amount,
          status: payment.status,
          item_actual_fee: payment.item_actual_fee,
          item_concession_fee: payment.item_concession_fee,
        };

        const reports = new Map();
        applyPaymentToReport(
          await loadActiveReportFor(before, session, reports),
          before,
          -1,
        );

        Object.assign(payment, req.body);
        await payment.save({ session });

        applyPaymentToReport(
          await loadActiveReportFor(payment, session, reports),
          payment,
          +1,
        );

        for (const report of reports.values()) {
          // save() (not updateOne) so the schema's pre-validate hook
          // recomputes net_*/balance_* from the new paid_* figures.
          if (report) await report.save({ session });
        }
        updated = payment;
      });
    } finally {
      await session.endSession();
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof ApiError) {
      return res
        .status(err.statusCode)
        .json({ success: false, message: err.message });
    }
    console.error("fee.updatePayment error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update fee payment." });
  }
};

// DELETE /api/fee-payments/:id
export const removePayment = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "delete", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "delete");

    const { allowed, filter } = resolveBranchQueryFilter(req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    filter._id = req.params.id;

    // Deleting a payment reverses it out of the student's report in the same
    // transaction. Previously the row simply disappeared and the report kept
    // counting money that no longer had a receipt behind it, overstating
    // what the student had paid with no way to notice. A row that is already
    // Cancelled contributes nothing (applyPaymentToReport skips it), so
    // deleting one of those stays a plain delete rather than a second,
    // double-counted reversal.
    let removedId;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const payment = await FeePayment.findOne(filter).session(session);
        if (!payment) throw new ApiError(404, "Fee payment not found.");

        const reports = new Map();
        applyPaymentToReport(
          await loadActiveReportFor(payment, session, reports),
          payment,
          -1,
        );
        for (const report of reports.values()) {
          if (report) await report.save({ session });
        }

        await payment.deleteOne({ session });
        removedId = payment._id;
      });
    } finally {
      await session.endSession();
    }

    return res.json({ success: true, data: { _id: removedId } });
  } catch (err) {
    if (err instanceof ApiError) {
      return res
        .status(err.statusCode)
        .json({ success: false, message: err.message });
    }
    console.error("fee.removePayment error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete fee payment." });
  }
};

// Fee types that were originally collected against a StudentFeeReport
// bucket via collectPayment() above - cancelling one of these has to
// reverse the matching paid_*/old_fee field, or the report's balance
// would permanently understate what's actually still owed. Anything not
// listed here (Kit Fee, Other, Tuition, Annual, Exam, ...) was recorded as
// a standalone entry via createPayment() and never touched a report, so
// cancelling it is just a status flip.
const FEE_TYPE_TO_PAID_FIELD = {
  "School Fee": "paid_term_fee",
  "Term Fee": "paid_term_fee",
  "Admission Fee": "paid_adm_fee",
  "Transport Fee": "paid_transport_fee",
  "Hostel Fee": "paid_hostel_fee",
  "Application Fee": "paid_application_fee",
  "Registration Fee": "paid_registration_fee",
};

// Kit Fee/Other are a running ledger (see collectPayment's kit_fee/
// other_income branches) rather than a single paid_*_fee field, so
// cancelling one of these has to reverse all three fields by the exact
// delta that payment contributed - not just `amount` - or the report
// permanently overstates gross/concession after a cancellation.
const FEE_TYPE_TO_LEDGER_FIELDS = {
  "Kit Fee": {
    paid: "paid_kit_fee",
    gross: "kit_gross_fee",
    concession: "kit_concession",
  },
  Other: {
    paid: "paid_other_fee",
    gross: "other_gross_fee",
    concession: "other_concession",
  },
};

// The report-side effect of one payment, applied with sign +1 (count this
// payment) or -1 (reverse it back out). This is the single place that knows
// how a FeePayment maps onto a StudentFeeReport, so cancelling, editing or
// deleting a payment undoes exactly what collectPayment() did rather than
// approximating it.
//
// A Cancelled payment contributes nothing: its amount was already reversed
// out when it was cancelled, so it must not be reversed a second time when
// that row is later edited or deleted.
function applyPaymentToReport(report, payment, sign) {
  if (!report || !payment || payment.status === "Cancelled") return;
  const amount = (Number(payment.amount) || 0) * sign;

  if (payment.fee_type === "Previous Due") {
    // collectPayment() pays old_fee DOWN by the amount collected, so
    // counting a Previous Due payment subtracts from it and reversing one
    // adds it back.
    report.old_fee = Math.max(0, (report.old_fee || 0) - amount);
    return;
  }

  const ledger = FEE_TYPE_TO_LEDGER_FIELDS[payment.fee_type];
  if (ledger) {
    report[ledger.paid] = Math.max(0, (report[ledger.paid] || 0) + amount);
    report[ledger.gross] = Math.max(
      0,
      (report[ledger.gross] || 0) +
        (Number(payment.item_actual_fee) || 0) * sign,
    );
    report[ledger.concession] = Math.max(
      0,
      (report[ledger.concession] || 0) +
        (Number(payment.item_concession_fee) || 0) * sign,
    );
    return;
  }

  const field = FEE_TYPE_TO_PAID_FIELD[payment.fee_type];
  if (field) report[field] = Math.max(0, (report[field] || 0) + amount);
}

// The Active report a payment belongs to, memoised per student+branch for
// the life of one request. Editing a payment can touch two different reports
// (when the row is moved to another student), and one receipt can span
// several payment rows that all land on the same report - either way this
// keeps it to a single load and a single save per report.
async function loadActiveReportFor(payment, session, cache) {
  const key = `${payment.student_id}|${payment.branch}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      await StudentFeeReport.findOne({
        student_id: payment.student_id,
        branch: payment.branch,
        status: "Active",
      }).session(session || null),
    );
  }
  return cache.get(key);
}

// Shared by cancelReceipt (Admin Officer, direct) and
// approveFeeReceiptCancellationRequest (the Accounts-Manager-requested
// path) below - exactly one place reverses a receipt's payments out of
// their student's StudentFeeReport and marks them Cancelled, so the two
// entry points can never drift apart on what "cancelling a receipt"
// actually does. `payments` must already be filtered to non-Cancelled rows.
async function applyReceiptCancellation(payments) {
  // One report lookup per distinct student (a single receipt is always
  // for one student in this app, but this stays correct even if that
  // ever changes) - reverse every payment's amount into its report
  // before saving, so one save per report instead of one per payment.
  const reportsByStudent = new Map();
  for (const payment of payments) {
    applyPaymentToReport(
      await loadActiveReportFor(payment, undefined, reportsByStudent),
      payment,
      -1,
    );
  }

  for (const report of reportsByStudent.values()) {
    if (report) await report.save();
  }
  for (const payment of payments) {
    payment.status = "Cancelled";
    await payment.save();
  }
}

// POST /api/fee/cancelReceipt
// body: { receipt_no } - one receipt_no can span several FeePayment docs
// (collectPayment() creates one per fee-type row), so this cancels all of
// them together and reverses each amount out of the paying student's
// StudentFeeReport in the same call, the same way collectPayment() adds
// them in on the way in. Admin Officer only now (see FeePayment.delete in
// rbac/permissions.js) - Accounts Manager must go through
// request-cancel-receipt -> an Admin Officer's approval instead, so this
// is never reachable as a silent bypass of that review.
export const cancelReceipt = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "delete", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "delete");

    const { receipt_no } = req.body;
    if (!receipt_no) {
      return res
        .status(400)
        .json({ success: false, message: "receipt_no is required." });
    }

    const { allowed, filter } = resolveBranchQueryFilter(req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    filter.receipt_no = receipt_no;
    filter.status = { $ne: "Cancelled" };

    const payments = await FeePayment.find(filter);
    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active payments found for that receipt number.",
      });
    }

    await applyReceiptCancellation(payments);

    return res.json({
      success: true,
      data: { cancelled: payments.map((p) => p._id) },
    });
  } catch (err) {
    console.error("fee.cancelReceipt error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to cancel receipt." });
  }
};

// ---------------------------------------------------------------------
// FeeReceiptCancellationRequest - Accounts Manager requests a receipt be
// cancelled, an Admin Officer for that branch approves or rejects it.
// Mirrors concessionController.js's shape exactly (same Notification
// integration, same isBranchAdminOfficer scoping as
// studentController.js/incomeController.js/expenditureController.js).
// ---------------------------------------------------------------------

const CANCELLATION_ENTITY = "FeeReceiptCancellationRequest";

const isBranchAdminOfficer = (user, branchId) =>
  user.role === ROLES.ADMIN_OFFICER &&
  (user.branches || []).some((b) => b.toString() === branchId.toString());

// POST /api/fee-receipt-cancellation-requests
// body: { receipt_no, reason } - Accounts Manager only (route-gated).
export const requestCancelReceipt = asyncHandler(async (req, res) => {
  if (!isAllowed(CANCELLATION_ENTITY, "create", req.user.role)) {
    throw new ApiError(
      403,
      "Your role is not permitted to request a fee receipt cancellation.",
    );
  }

  const { receipt_no, reason } = req.body;
  if (!receipt_no) {
    throw new ApiError(400, "receipt_no is required.");
  }
  if (!reason || !reason.trim()) {
    throw new ApiError(
      400,
      "A reason is required so the Admin Officer has something to review.",
    );
  }

  const { allowed, filter } = resolveBranchQueryFilter(req.user);
  if (!allowed) throw new ApiError(403, "You do not have access to that branch.");
  filter.receipt_no = receipt_no;
  filter.status = { $ne: "Cancelled" };

  const payments = await FeePayment.find(filter);
  if (payments.length === 0) {
    throw new ApiError(
      404,
      "No active payments found for that receipt number.",
    );
  }

  const existing = await FeeReceiptCancellationRequest.findOne({
    receipt_no,
    status: "Pending",
  }).lean();
  if (existing) {
    throw new ApiError(
      409,
      "A cancellation request is already pending for this receipt.",
    );
  }

  const branch = payments[0].branch;
  const studentId = payments[0].student_id;
  const studentName = payments[0].student_name;
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const request = await FeeReceiptCancellationRequest.create({
    branch,
    receipt_no,
    student_id: studentId,
    student_name: studentName,
    amount: totalAmount,
    reason: reason.trim(),
    status: "Pending",
    requested_by: req.user._id,
  });

  const notification = await Notification.create({
    recipient_role: ROLES.ADMIN_OFFICER,
    branch,
    type: "fee_receipt_cancellation_request",
    related_record_id: request._id,
    related_student_id: studentId,
    initiated_by: req.user._id,
    status: "Open",
    title: `Fee receipt cancellation requested: ${studentName}`,
    message: `${req.user.full_name || "An Accounts Manager"} wants to cancel receipt ${receipt_no} (₹${totalAmount.toLocaleString("en-IN")}) for ${studentName}. Reason: ${reason.trim()}`,
  });

  return res.status(201).json({ success: true, data: { request, notification } });
});

// GET /api/fee-receipt-cancellation-requests
// params (all optional): status ("Pending"|"Approved"|"Rejected"), branch
export const listFeeReceiptCancellationRequests = asyncHandler(async (req, res) => {
  if (!isAllowed(CANCELLATION_ENTITY, "read", req.user.role)) {
    throw new ApiError(
      403,
      "Your role is not permitted to view fee receipt cancellation requests.",
    );
  }

  const { allowed, filter } = resolveBranchQueryFilter(req.user, req.query.branch);
  if (!allowed) throw new ApiError(403, "You do not have access to that branch.");
  if (req.query.status) filter.status = req.query.status;

  const requests = await FeeReceiptCancellationRequest.find(filter)
    .sort("-created_date")
    .lean();
  return res.json({ success: true, data: requests });
});

async function reviewCancelReceiptRequest(req, res, decision) {
  if (!isAllowed(CANCELLATION_ENTITY, "update", req.user.role)) {
    throw new ApiError(
      403,
      "Only an Admin Officer can approve or reject a fee receipt cancellation request.",
    );
  }

  const request = await FeeReceiptCancellationRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, "Cancellation request not found.");
  if (!isBranchAdminOfficer(req.user, request.branch)) {
    throw new ApiError(
      403,
      "You do not have permission to review this branch's requests.",
    );
  }
  if (request.status !== "Pending") {
    throw new ApiError(400, `This request was already ${request.status.toLowerCase()}.`);
  }

  if (decision === "Approved") {
    const payments = await FeePayment.find({
      receipt_no: request.receipt_no,
      status: { $ne: "Cancelled" },
    });
    await applyReceiptCancellation(payments);
  }

  request.status = decision;
  request.reviewed_by = req.user._id;
  request.reviewed_at = new Date();
  await request.save();

  await Notification.updateMany(
    {
      related_record_id: request._id,
      type: "fee_receipt_cancellation_request",
      status: "Open",
    },
    { $set: { status: "Resolved", updated_by: req.user._id } },
  );

  await Notification.create({
    recipient_role: ROLES.ACCOUNTS_MANAGER,
    recipient_user_id: request.requested_by,
    branch: request.branch,
    type: "fee_receipt_cancellation_result",
    related_record_id: request._id,
    related_student_id: request.student_id,
    status: "Open",
    title:
      decision === "Approved"
        ? `Fee receipt cancellation approved: ${request.student_name}`
        : `Fee receipt cancellation rejected: ${request.student_name}`,
    message:
      decision === "Approved"
        ? `Receipt ${request.receipt_no} for ${request.student_name} (₹${request.amount.toLocaleString("en-IN")}) has been cancelled - it's reversed out of their fee report and total collected.`
        : `Your request to cancel receipt ${request.receipt_no} for ${request.student_name} was rejected.`,
  });

  return res.json({ success: true, data: request });
}

// PUT /api/fee-receipt-cancellation-requests/:id/approve
export const approveCancelReceiptRequest = asyncHandler((req, res) =>
  reviewCancelReceiptRequest(req, res, "Approved"),
);

// PUT /api/fee-receipt-cancellation-requests/:id/reject
export const rejectCancelReceiptRequest = asyncHandler((req, res) =>
  reviewCancelReceiptRequest(req, res, "Rejected"),
);

// ---------------------------------------------------------------------
// StudentFeeReport - a student's fee structure (owed / paid / balance)
// ---------------------------------------------------------------------

// Every field that adds up to "what this student still owes": all 8 fee
// buckets plus old_fee. A previous-year due is outstanding money like any
// other, which is why reportSummary() and classConsolidatedReport() already
// fold old_fee into balance_fee - this keeps the "Pending" filter agreeing
// with the totals those show.
const OUTSTANDING_FIELDS = [
  "balance_adm_fee",
  "balance_term_fee",
  "balance_transport_fee",
  "balance_hostel_fee",
  "balance_application_fee",
  "balance_registration_fee",
  "balance_kit_fee",
  "balance_other_fee",
  "old_fee",
];

// The sum of those as an aggregation expression. Valid in an aggregate
// $match and, via $expr, in a plain .find() - buildReportFilter below feeds
// both.
const OUTSTANDING_SUM_EXPR = OUTSTANDING_FIELDS.reduce(
  (acc, f) => ({ $add: [acc, { $ifNull: [`$${f}`, 0] }] }),
  0,
);

// Shared by listReports/reportSummary so the two endpoints can never drift
// apart on what "the current filter set" means. Returns { allowed, filter }
// same shape as resolveBranchQueryFilter; `filter` is ready to hand straight
// to StudentFeeReport.find()/countDocuments()/aggregate($match).
async function buildReportFilter(req) {
  const {
    student_id,
    class: cls,
    status,
    student_type,
    has_old_fee,
    has_balance,
    search,
    branch,
    from,
    to,
  } = req.query;
  const { allowed, filter } = resolveBranchQueryFilter(req.user, branch);
  if (!allowed) return { allowed, filter };

  // resolveBranchQueryFilter only scopes by branch - unlike
  // buildScopeFilter (used for Student and most other entities), it never
  // excludes soft-deleted rows, so a deleted student's report would
  // otherwise keep showing up here indefinitely.
  filter.is_deleted = { $ne: true };

  if (student_id) filter.student_id = student_id;
  // Date range is applied against created_date (withCommonFields' timestamp
  // for when the report record itself was created) - StudentFeeReport has
  // no other per-row date (it's a running structure/balance, not a
  // transaction log), so this is the only meaningful "date" to filter by.
  if (from || to) {
    filter.created_date = {};
    if (from) filter.created_date.$gte = new Date(from);
    if (to) {
      // Make `to` inclusive of the whole day when only a date (no time) is
      // supplied, matching how the frontend's <input type="date"> sends it.
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filter.created_date.$lte = toDate;
    }
  }
  // StudentFeeReport.class is an ObjectId ref - reportSummary() below (and
  // any other aggregate()-backed caller of this filter) hands it straight
  // to a raw Mongo $match with no schema casting, unlike .find(), so a bare
  // string here would silently match zero documents. Same pitfall already
  // fixed for `branch` in resolveBranchQueryFilter (branchScope.js).
  if (cls && mongoose.isValidObjectId(cls)) {
    filter.class = new mongoose.Types.ObjectId(cls);
  }
  if (status) filter.status = status;
  if (student_type) filter.student_type = student_type;
  if (has_old_fee === "true") filter.old_fee = { $gt: 0 };
  else if (has_old_fee === "false")
    filter.$or = [{ old_fee: { $lte: 0 } }, { old_fee: { $exists: false } }];
  // "Pending" means the student owes something across ANY fee type, not
  // just term fee. This used to test balance_term_fee alone, so a student
  // who owed nothing on term fee but was behind on transport, hostel or a
  // previous-year due was reported as fully paid - the one student a dues
  // filter most needs to surface. $expr because the condition is a sum of
  // fields rather than a single one; it cannot use an index on its own, but
  // it is always ANDed with the branch scope, which can.
  if (has_balance === "true") filter.$expr = { $gt: [OUTSTANDING_SUM_EXPR, 0] };
  else if (has_balance === "false")
    filter.$expr = { $lte: [OUTSTANDING_SUM_EXPR, 0] };
  if (search) {
    // Escape regex metacharacters - this is user-typed search text, not a
    // pattern the caller controls intentionally.
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    // admission_no lives on Student, not StudentFeeReport, so it can't join
    // the $or below directly - resolve any matching students to their ids
    // first and fold those in as an extra $or branch.
    const matchingStudents = await Student.find({ admission_no: re })
      .select("_id")
      .lean();
    const studentIds = matchingStudents.map((s) => s._id);
    // Kept as $and (not overwriting $or above) so has_old_fee=false and a
    // search term can both apply at once without one clobbering the other.
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { student_name: re },
          { mob_number: re },
          ...(studentIds.length ? [{ student_id: { $in: studentIds } }] : []),
        ],
      },
    ];
  }
  return { allowed: true, filter };
}

// GET /api/student-fee-reports  (list, branch-scoped)
// params (all optional): student_id, class, status, student_type, has_old_fee,
// has_balance, search (matches student_name/mob_number/admission_no), from/to (filters on
// created_date), sort, branch, and page/limit - when page is present the
// response also carries a `meta` block ({ total, page, limit, totalPages });
// when it's omitted (existing callers), the endpoint behaves as before
// (limit alone is still a plain cap).
export const listReports = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { sort, limit, page } = req.query;
    const { allowed, filter } = await buildReportFilter(req);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }

    let query = StudentFeeReport.find(filter).populate(
      "student_id",
      "admission_no full_name",
    );
    if (sort) query = query.sort(sort);

    let meta;
    if (page) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const pageSize = Math.max(parseInt(limit, 10) || 25, 1);
      const total = await StudentFeeReport.countDocuments(filter);
      query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
      meta = {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      };
    } else if (limit) {
      query = query.limit(Number(limit));
    }

    const records = await query.lean();
    // .lean() skips Mongoose's own default-application on hydration, so
    // reports created before the has_*_fee flags existed come back with
    // those keys simply absent - backfill them here (Admission/Term always
    // applied historically; Transport/Application/Registration never did).
    const normalized = records.map((r) => ({
      ...r,
      has_admission_fee: r.has_admission_fee ?? true,
      has_term_fee: r.has_term_fee ?? true,
      has_transport_fee: r.has_transport_fee ?? false,
      has_hostel_fee: r.has_hostel_fee ?? false,
      has_application_fee: r.has_application_fee ?? false,
      has_registration_fee: r.has_registration_fee ?? false,
      has_kit_fee: r.has_kit_fee ?? false,
      has_other_fee: r.has_other_fee ?? false,
    }));
    return res.json({ success: true, data: normalized, ...(meta && { meta }) });
  } catch (err) {
    console.error("fee.listReports error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch fee reports." });
  }
};

// GET /api/student-fee-reports/report-summary  (same filters as listReports,
// minus page/limit/sort) - returns aggregate totals across every MATCHING
// report, not just the current page, without ever pulling the rows into
// Node. Mirrors StudentFeeReport.jsx's old client-side summaryTotals/totals
// useMemo (net_fee/paid_fee/balance_fee summed across all 6 FEE_BUCKETS).
export const reportSummary = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { allowed, filter } = await buildReportFilter(req);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }

    const netFeeFields = [
      "net_adm_fee",
      "net_term_fee",
      "net_transport_fee",
      "net_hostel_fee",
      "net_application_fee",
      "net_registration_fee",
      "net_kit_fee",
      "net_other_fee",
    ];
    const paidFeeFields = [
      "paid_adm_fee",
      "paid_term_fee",
      "paid_transport_fee",
      "paid_hostel_fee",
      "paid_application_fee",
      "paid_registration_fee",
      "paid_kit_fee",
      "paid_other_fee",
    ];
    const balanceFeeFields = [
      "balance_adm_fee",
      "balance_term_fee",
      "balance_transport_fee",
      "balance_hostel_fee",
      "balance_application_fee",
      "balance_registration_fee",
      "balance_kit_fee",
      "balance_other_fee",
    ];
    const sumOf = (fields) => ({
      $sum: fields.reduce(
        (acc, f) => ({ $add: [acc, { $ifNull: [`$${f}`, 0] }] }),
        0,
      ),
    });

    // Per-bucket breakdown (gross/concession/net/paid/balance for each of
    // the 6 FEE_BUCKETS) - powers StudentFeeReport.jsx's table footer TOTALS
    // row, which used to sum the full (unpaginated) `filtered` array
    // in-browser. Keyed to match the frontend's FEE_BUCKETS `key`s exactly.
    const bucketFieldMap = {
      adm: [
        "adm_gross_fee",
        "adm_concession",
        "net_adm_fee",
        "paid_adm_fee",
        "balance_adm_fee",
      ],
      term: [
        "gross_term_fee",
        "term_concession",
        "net_term_fee",
        "paid_term_fee",
        "balance_term_fee",
      ],
      transport: [
        "transport_gross_fee",
        "transport_concession",
        "net_transport_fee",
        "paid_transport_fee",
        "balance_transport_fee",
      ],
      hostel: [
        "hostel_gross_fee",
        "hostel_concession",
        "net_hostel_fee",
        "paid_hostel_fee",
        "balance_hostel_fee",
      ],
      application: [
        "application_gross_fee",
        "application_concession",
        "net_application_fee",
        "paid_application_fee",
        "balance_application_fee",
      ],
      registration: [
        "registration_gross_fee",
        "registration_concession",
        "net_registration_fee",
        "paid_registration_fee",
        "balance_registration_fee",
      ],
      kit: [
        "kit_gross_fee",
        "kit_concession",
        "net_kit_fee",
        "paid_kit_fee",
        "balance_kit_fee",
      ],
      other: [
        "other_gross_fee",
        "other_concession",
        "net_other_fee",
        "paid_other_fee",
        "balance_other_fee",
      ],
    };
    const bucketGroup = {};
    for (const [key, [gross, concession, net, paid, balance]] of Object.entries(
      bucketFieldMap,
    )) {
      bucketGroup[`${key}_gross`] = { $sum: { $ifNull: [`$${gross}`, 0] } };
      bucketGroup[`${key}_concession`] = {
        $sum: { $ifNull: [`$${concession}`, 0] },
      };
      bucketGroup[`${key}_net`] = { $sum: { $ifNull: [`$${net}`, 0] } };
      bucketGroup[`${key}_paid`] = { $sum: { $ifNull: [`$${paid}`, 0] } };
      bucketGroup[`${key}_balance`] = { $sum: { $ifNull: [`$${balance}`, 0] } };
    }

    const [result] = await StudentFeeReport.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          old_fee: { $sum: { $ifNull: ["$old_fee", 0] } },
          net_fee: sumOf(netFeeFields),
          paid_fee: sumOf(paidFeeFields),
          balance_fee: sumOf(balanceFeeFields),
          ...bucketGroup,
        },
      },
    ]);

    const buckets = {};
    for (const key of Object.keys(bucketFieldMap)) {
      buckets[key] = {
        gross: result?.[`${key}_gross`] || 0,
        concession: result?.[`${key}_concession`] || 0,
        net: result?.[`${key}_net`] || 0,
        paid: result?.[`${key}_paid`] || 0,
        balance: result?.[`${key}_balance`] || 0,
      };
    }

    const summary = {
      count: result?.count || 0,
      old_fee: result?.old_fee || 0,
      net_fee: result?.net_fee || 0,
      paid_fee: result?.paid_fee || 0,
      // Matches the client's old computation: old_fee (previous due) is
      // itself an outstanding balance, so it's folded into balance_fee.
      balance_fee: (result?.old_fee || 0) + (result?.balance_fee || 0),
      buckets,
    };

    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error("fee.reportSummary error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch fee report summary." });
  }
};

// POST /api/student-fee-reports
export const createReport = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "create", req.user.role))
      return forbidden(res, REPORT_ENTITY, "create");

    // Branch is always server-derived - never trust req.body.branch.
    const branch = req.user.branch;

    if (!branch) {
      return res
        .status(400)
        .json({ success: false, message: "A branch is required." });
    }

    const payload = { ...req.body, branch };
    stripPaidFields(payload);
    sanitizeFeeBuckets(payload);
    // A brand-new report has nothing locked yet - this only ever produces
    // buckets to newly lock (for an Accounts Manager), never a blocked-edit
    // error, since `existing` here is empty.
    const toLock = applyConcessionLockRules({}, payload, req.user.role);
    if (toLock.length > 0) payload.concession_locked_buckets = toLock;
    const record = await StudentFeeReport.create(payload);
    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    console.error("fee.createReport error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create fee report." });
  }
};

// PUT /api/student-fee-reports/:id
export const updateReport = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "update", req.user.role))
      return forbidden(res, REPORT_ENTITY, "update");

    const { allowed, filter } = resolveBranchQueryFilter(req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    filter._id = req.params.id;

    const existing = await StudentFeeReport.findOne(filter);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Fee report not found." });
    }

    const updates = { ...req.body };
    if (req.user.role !== "super_admin") delete updates.branch;
    stripPaidFields(updates);

    const blocked = findBlockedBucketUncheck(existing, updates);
    if (blocked) {
      const label = blocked.flag === "has_kit_fee" ? "Kit Fee" : "Other Fee";
      return res.status(400).json({
        success: false,
        message: `Can't turn off ${label} - ₹${existing[blocked.paidField]} has already been collected against it. The collected total would be lost from this record.`,
      });
    }

    // Throws if this is an Accounts Manager trying to change an
    // already-locked bucket's concession; otherwise returns which buckets
    // (if any) should newly lock as a result of this save.
    const toLock = applyConcessionLockRules(existing, updates, req.user.role);

    Object.assign(existing, updates);
    if (toLock.length > 0) {
      const locked = new Set(existing.concession_locked_buckets || []);
      toLock.forEach((b) => locked.add(b));
      existing.concession_locked_buckets = [...locked];
    }
    sanitizeFeeBuckets(existing);
    await existing.save(); // triggers pre-validate recompute of net/balance fields
    return res.json({ success: true, data: existing });
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    console.error("fee.updateReport error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update fee report." });
  }
};

// DELETE /api/student-fee-reports/:id
export const removeReport = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "delete", req.user.role))
      return forbidden(res, REPORT_ENTITY, "delete");

    const { allowed, filter } = resolveBranchQueryFilter(req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    filter._id = req.params.id;

    const existing = await StudentFeeReport.findOne(filter);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Fee report not found." });
    }

    await existing.deleteOne();
    return res.json({ success: true, data: { _id: existing._id } });
  } catch (err) {
    console.error("fee.removeReport error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete fee report." });
  }
};

// Same shape as BPFees.jsx's PENDING_BUCKETS - kept in sync manually since
// bucket field names are schema, not config (see FEE_BUCKETS above).
const PENDING_BUCKETS = [
  {
    key: "application",
    hasFlag: "has_application_fee",
    balanceField: "balance_application_fee",
    label: "Application Fee",
  },
  {
    key: "registration",
    hasFlag: "has_registration_fee",
    balanceField: "balance_registration_fee",
    label: "Registration Fee",
  },
  {
    key: "adm",
    hasFlag: "has_admission_fee",
    balanceField: "balance_adm_fee",
    label: "Admission Fee",
  },
  {
    key: "term",
    hasFlag: "has_term_fee",
    balanceField: "balance_term_fee",
    label: "Term Fee",
  },
  {
    key: "transport",
    hasFlag: "has_transport_fee",
    balanceField: "balance_transport_fee",
    label: "Transport Fee",
  },
  {
    key: "hostel",
    hasFlag: "has_hostel_fee",
    balanceField: "balance_hostel_fee",
    label: "Hostel Fee",
  },
];

// GET /api/student-fee-reports/pending  (paginated, branch-scoped)
// Replaces BPFees.jsx's client-side pendingRows useMemo, which used to
// flatten EVERY fetched Active report into up to 7 rows (old_fee "Previous
// Due" + 6 buckets, only where has_*_fee is true and its balance > 0) in the
// browser. Same flattening, done as a Mongo aggregation instead, so only the
// current page's rows ever leave the database. params (all optional):
// class, search (student_name), branch, page/limit.
export const listPendingFees = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { class: cls, search, branch, page, limit } = req.query;
    const { allowed, filter } = resolveBranchQueryFilter(req.user, branch);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }
    filter.status = "Active";
    // Same gap as buildReportFilter above - resolveBranchQueryFilter never
    // excludes soft-deleted rows, so a deleted student's balance would
    // otherwise keep showing up as still pending.
    filter.is_deleted = { $ne: true };
    // Cast to ObjectId - this filter feeds a raw aggregate() $match below
    // (StudentFeeReport.aggregate(pipeline)), which does no schema casting,
    // so a bare string here would silently match zero documents.
    if (cls && mongoose.isValidObjectId(cls)) {
      filter.class = new mongoose.Types.ObjectId(cls);
    }
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.student_name = re;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 25, 1);

    // Build one candidate row per bucket (plus a synthetic "Previous Due"
    // row for old_fee) via $concatArrays, then $filter out the ones that
    // don't actually qualify (flag off, or nothing owed) before $unwind -
    // this keeps $unwind from ever seeing (and having to drop) null entries.
    const bucketRowExprs = PENDING_BUCKETS.map((b) => ({
      $cond: [
        {
          $and: [
            { $ifNull: [`$${b.hasFlag}`, false] },
            { $gt: [{ $ifNull: [`$${b.balanceField}`, 0] }, 0] },
          ],
        },
        { key: b.key, fee_type: b.label, amount: `$${b.balanceField}` },
        null,
      ],
    }));

    const pipeline = [
      { $match: filter },
      // Sort here, on the raw (pre-$unwind) documents, while a { status: 1,
      // student_name: 1, _id: 1 } index (see StudentFeeReport.js) can still
      // serve it as an indexed scan instead of a blocking in-memory sort.
      // Every row $unwind produces from one document shares that document's
      // student_name/_id, so sorting before vs. after $unwind yields the
      // same final order - moving it earlier just sorts far fewer, smaller
      // documents (one per student instead of one per pending-fee bucket).
      { $sort: { student_name: 1, _id: 1 } },
      {
        $addFields: {
          _pendingRows: {
            $filter: {
              input: {
                $concatArrays: [
                  [
                    {
                      $cond: [
                        { $gt: [{ $ifNull: ["$old_fee", 0] }, 0] },
                        {
                          key: "old_fee",
                          fee_type: "Previous Due",
                          amount: "$old_fee",
                        },
                        null,
                      ],
                    },
                  ],
                  bucketRowExprs,
                ],
              },
              as: "row",
              cond: { $ne: ["$$row", null] },
            },
          },
        },
      },
      { $unwind: "$_pendingRows" },
      {
        $project: {
          report: "$$ROOT",
          student_id: 1,
          student_name: 1,
          class: 1,
          fee_type: "$_pendingRows.fee_type",
          key: "$_pendingRows.key",
          amount: "$_pendingRows.amount",
        },
      },
      {
        $facet: {
          data: [{ $skip: (pageNum - 1) * pageSize }, { $limit: pageSize }],
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                totalAmount: { $sum: "$amount" },
              },
            },
          ],
        },
      },
    ];

    // allowDiskUse as a fallback in case the index above (or a future
    // change to this pipeline) still can't avoid an in-memory sort on some
    // deployment - a no-op wherever the indexed sort already applies.
    // Model.aggregate()'s 2nd positional arg is a legacy callback slot, not
    // options - .option() is the actual way to set allowDiskUse.
    const [result] = await StudentFeeReport.aggregate(pipeline).option({
      allowDiskUse: true,
    });
    const rows = result?.data || [];
    const total = result?.totals?.[0]?.total || 0;
    const totalAmount = result?.totals?.[0]?.totalAmount || 0;

    const data = rows.map((r) => ({
      id: `${r.report._id}_${r.key}`,
      report: r.report,
      student_id: r.student_id,
      student_name: r.student_name,
      class: r.class,
      fee_type: r.fee_type,
      amount: r.amount,
    }));

    return res.json({
      success: true,
      data,
      meta: {
        total,
        totalAmount,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (err) {
    console.error("fee.listPendingFees error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending fees." });
  }
};

// GET /api/student-fee-reports/eligible-students?class=<classId>&search=<name>
export const listEligibleStudents = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { class: classId, search, search_by } = req.query;
    if (!classId) {
      return res
        .status(400)
        .json({ success: false, message: "A class is required." });
    }

    const branch = req.user.branch;
    if (!branch) {
      return res
        .status(400)
        .json({ success: false, message: "A branch is required." });
    }

    const studentFilter = { class: classId, branch, status: "Active" };
    // Trimmed once, reused for both the emptiness check and the query -
    // " " alone shouldn't count as a search term.
    const trimmedSearch = typeof search === "string" ? search.trim() : "";
    if (trimmedSearch) {
      if (search_by === "roll_no") {
        // Exact (case-insensitive) match, not prefix - a Roll No lookup is
        // meant to find one specific student, not search-as-you-type.
        studentFilter.roll_no = {
          $regex: `^${escapeRegex(trimmedSearch)}$`,
          $options: "i",
        };
      } else if (search_by === "admission_no") {
        studentFilter.admission_no = {
          $regex: `^${escapeRegex(trimmedSearch)}$`,
          $options: "i",
        };
      } else {
        // Unanchored - "contains anywhere" so a mid-name or last-name
        // fragment (e.g. "abc" in "Apple ABC") matches too, not just a
        // "starts with" prefix. This is only scanned within the
        // { class, branch, status } - filtered roster above (one
        // classroom's worth of students), not the full collection, so the
        // lack of an index-backed anchor is cheap here. escapeRegex keeps a
        // search term containing regex metacharacters from being
        // interpreted as a pattern instead of literal text.
        studentFilter.full_name = {
          $regex: escapeRegex(trimmedSearch),
          $options: "i",
        };
      }
    }

    let studentsQuery = Student.find(studentFilter)
      .select(
        "full_name parent_name parent_phone admission_no roll_no class branch",
      )
      .collation({ locale: "en", strength: 2 })
      .sort({ full_name: 1 });

    // Only capped when actually searching - StudentFeeReportForm.jsx calls
    // this same endpoint with no `search` at all and expects the complete
    // class roster back for its own client-side filtering, so an
    // unconditional limit here would silently truncate that page's list.
    if (trimmedSearch) studentsQuery = studentsQuery.limit(15);

    const students = await studentsQuery.lean();

    if (students.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const studentIds = students.map((s) => s._id);
    const existingReports = await StudentFeeReport.find({
      student_id: { $in: studentIds },
      branch,
    }).lean();
    const reportByStudentId = Object.fromEntries(
      existingReports.map((r) => [String(r.student_id), r]),
    );

    // Response keys stay father_name/mobile (matching StudentFeeReport's own
    // field names) even though the source Student fields are named
    // differently - keeps the frontend/payload contract simple.
    const data = students.map((s) => {
      const existing = reportByStudentId[String(s._id)];
      return {
        student_id: s._id,
        name: s.full_name,
        father_name: s.parent_name,
        mobile: s.parent_phone,
        admission_no: s.admission_no,
        roll_no: s.roll_no,
        class: s.class,
        has_report: !!existing,
        existing_report: existing || null,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("fee.listEligibleStudents error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch eligible students." });
  }
};

// GET /api/fee/item-payments?student_id=<id>&fee_type=Kit Fee|Other
// Kit Fee/Other Income have no StudentFeeReport bucket to read a running
// "paid till date" off (see ROW_TO_FEE_TYPE above), so this reconstructs it
// from the FeePayment ledger instead, grouped by item_name.
export const itemPaymentTotals = async (req, res) => {
  try {
    if (!isAllowed(PAYMENT_ENTITY, "read", req.user.role))
      return forbidden(res, PAYMENT_ENTITY, "view");

    const { student_id, fee_type } = req.query;
    if (!student_id || !fee_type) {
      return res.status(400).json({
        success: false,
        message: "student_id and fee_type are required.",
      });
    }

    const { allowed, filter: branchFilter } = resolveBranchQueryFilter(
      req.user,
      req.query.branch,
    );
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }

    const rows = await FeePayment.aggregate([
      {
        $match: {
          ...branchFilter,
          student_id: new mongoose.Types.ObjectId(student_id),
          fee_type,
          status: { $ne: "Cancelled" },
        },
      },
      {
        $group: {
          _id: "$item_name",
          total: { $sum: "$amount" },
          // $ifNull fallback: payments made before item_actual_fee/
          // item_concession_fee existed had actual always equal to what
          // was paid and concession always 0 (that was the only behavior
          // the old UI had) - treating them that way keeps old history
          // consistent with what was actually shown at the time.
          actual: { $sum: { $ifNull: ["$item_actual_fee", "$amount"] } },
          concession: { $sum: { $ifNull: ["$item_concession_fee", 0] } },
        },
      },
    ]);

    const data = Object.fromEntries(
      rows
        .filter((r) => r._id)
        .map((r) => [
          r._id,
          { total: r.total, actual: r.actual, concession: r.concession },
        ]),
    );

    return res.json({ success: true, data });
  } catch (err) {
    console.error("fee.itemPaymentTotals error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch item payment totals.",
    });
  }
};

// ---------------------------------------------------------------------
// Category reports - 10 focused reports spun off StudentFeeReport/
// FeePayment (Old/Admission/Term/Transport/Hostel/Application/
// Registration/Kit Amount/Other Income/Inactive Students). Each one is a
// *scope*, not just a filter: the query itself only ever returns rows
// that belong in that report (has_hostel_fee: true for Hostel, fee_type:
// "Kit Fee" for Kit Amount, etc.), so a report can never end up showing
// another category's data - see listCategoryReport/categoryReportSummary
// at the bottom, which is all the frontend calls.
// ---------------------------------------------------------------------

// Same six-bucket field lists as PAID_FIELDS above, for the other four
// columns - shared by categoryReportSummary's inactive-students branch so
// "total across every bucket" is computed the same way reportSummary()
// already does above.
const GROSS_FEE_FIELDS = [
  "adm_gross_fee",
  "gross_term_fee",
  "transport_gross_fee",
  "hostel_gross_fee",
  "application_gross_fee",
  "registration_gross_fee",
];
const CONCESSION_FEE_FIELDS = [
  "adm_concession",
  "term_concession",
  "transport_concession",
  "hostel_concession",
  "application_concession",
  "registration_concession",
];
const NET_FEE_FIELDS = [
  "net_adm_fee",
  "net_term_fee",
  "net_transport_fee",
  "net_hostel_fee",
  "net_application_fee",
  "net_registration_fee",
];
const BALANCE_FEE_FIELDS = [
  "balance_adm_fee",
  "balance_term_fee",
  "balance_transport_fee",
  "balance_hostel_fee",
  "balance_application_fee",
  "balance_registration_fee",
];

const sumFields = (obj, fields) =>
  fields.reduce((acc, f) => acc + (Number(obj[f]) || 0), 0);

// One bucket = one focused report (Admission/Term/Transport/Hostel/
// Application/Registration Fee Report) - the field names a report's
// Gross/Concession/Net/Paid/Balance columns read from on a
// StudentFeeReport document, and the has_*_fee flag that scopes which
// students belong in it at all (see listBucketCategoryReport below - this
// is what guarantees a Hostel Fee Report can only ever contain students
// who actually have hostel fees).
const REPORT_CATEGORIES = {
  admission: {
    flag: "has_admission_fee",
    gross: "adm_gross_fee",
    concession: "adm_concession",
    net: "net_adm_fee",
    paid: "paid_adm_fee",
    balance: "balance_adm_fee",
  },
  term: {
    flag: "has_term_fee",
    gross: "gross_term_fee",
    concession: "term_concession",
    net: "net_term_fee",
    paid: "paid_term_fee",
    balance: "balance_term_fee",
  },
  transport: {
    flag: "has_transport_fee",
    gross: "transport_gross_fee",
    concession: "transport_concession",
    net: "net_transport_fee",
    paid: "paid_transport_fee",
    balance: "balance_transport_fee",
  },
  hostel: {
    flag: "has_hostel_fee",
    gross: "hostel_gross_fee",
    concession: "hostel_concession",
    net: "net_hostel_fee",
    paid: "paid_hostel_fee",
    balance: "balance_hostel_fee",
  },
  application: {
    flag: "has_application_fee",
    gross: "application_gross_fee",
    concession: "application_concession",
    net: "net_application_fee",
    paid: "paid_application_fee",
    balance: "balance_application_fee",
  },
  registration: {
    flag: "has_registration_fee",
    gross: "registration_gross_fee",
    concession: "registration_concession",
    net: "net_registration_fee",
    paid: "paid_registration_fee",
    balance: "balance_registration_fee",
  },
};

// Kit/Other Income aren't part of the StudentFeeReport bucket structure at
// all - they're one-off FeePayment records created directly via
// createPayment()/collectPayment(), never touching a report. Their report
// is therefore sourced from FeePayment, not StudentFeeReport - see
// listPaymentCategoryReport below.
const PAYMENT_CATEGORIES = {
  kit: { feeType: "Kit Fee" },
  other_income: { feeType: "Other" },
};

// Escapes user-typed search text before it goes into a RegExp - shared by
// every category-report search path below (mirrors the identical escape
// already used in buildReportFilter above).
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function shapeCategoryRow(source, amounts) {
  return {
    _id: source._id,
    student_id: String(source.student_id?._id || source.student_id || ""),
    admission_no: source.student_id?.admission_no || "",
    student_name: source.student_name,
    father_name: source.father_name,
    mob_number: source.mob_number,
    class: source.class,
    student_type: source.student_type ?? null,
    status: source.status ?? null,
    gross: amounts.gross || 0,
    concession: amounts.concession || 0,
    net: amounts.net || 0,
    paid: amounts.paid || 0,
    balance: amounts.balance || 0,
  };
}

function buildCategoryBranchFilter(req) {
  const { allowed, filter } = resolveBranchQueryFilter(
    req.user,
    req.query.branch,
  );
  return { allowed, filter };
}

// Admission/Term/Transport/Hostel/Application/Registration - straight off
// StudentFeeReport, scoped to students who actually have that bucket
// enabled.
async function listBucketCategoryReport(req, res, bucket) {
  const { allowed, filter } = buildCategoryBranchFilter(req);
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that branch.",
    });
  }
  filter[bucket.flag] = true;
  if (req.query.class && mongoose.isValidObjectId(req.query.class)) {
    filter.class = new mongoose.Types.ObjectId(req.query.class);
  }
  if (req.query.search) {
    filter.$or = [
      { student_name: new RegExp(escapeRegex(req.query.search), "i") },
      { mob_number: new RegExp(escapeRegex(req.query.search), "i") },
    ];
  }

  const { sort, limit, page } = req.query;
  let query = StudentFeeReport.find(filter).populate(
    "student_id",
    "admission_no full_name",
  );
  if (sort) query = query.sort(sort);

  let meta;
  if (page) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 25, 1);
    const total = await StudentFeeReport.countDocuments(filter);
    query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
    meta = {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  } else if (limit) {
    query = query.limit(Number(limit));
  }

  const records = await query.lean();
  const data = records.map((r) =>
    shapeCategoryRow(r, {
      gross: r[bucket.gross],
      concession: r[bucket.concession],
      net: r[bucket.net],
      paid: r[bucket.paid],
      balance: r[bucket.balance],
    }),
  );
  return res.json({ success: true, data, ...(meta && { meta }) });
}

async function bucketCategorySummary(req, res, bucket) {
  const { allowed, filter } = buildCategoryBranchFilter(req);
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that branch.",
    });
  }
  filter[bucket.flag] = true;
  // Cast, unlike the .find()-based listBucketCategoryReport above - this
  // filter feeds an aggregate() $match below, which (unlike .find()) never
  // auto-casts a raw string against an ObjectId field, so an uncast class
  // id here would silently match zero documents instead of filtering.
  if (req.query.class && mongoose.isValidObjectId(req.query.class)) {
    filter.class = new mongoose.Types.ObjectId(req.query.class);
  }
  if (req.query.search) {
    filter.$or = [
      { student_name: new RegExp(escapeRegex(req.query.search), "i") },
      { mob_number: new RegExp(escapeRegex(req.query.search), "i") },
    ];
  }

  const [result] = await StudentFeeReport.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        net: { $sum: { $ifNull: [`$${bucket.net}`, 0] } },
        paid: { $sum: { $ifNull: [`$${bucket.paid}`, 0] } },
        balance: { $sum: { $ifNull: [`$${bucket.balance}`, 0] } },
      },
    },
  ]);
  return res.json({
    success: true,
    data: {
      count: result?.count || 0,
      net: result?.net || 0,
      paid: result?.paid || 0,
      balance: result?.balance || 0,
    },
  });
}

// Old Fee - scoped to students who still have an outstanding old_fee
// balance right now. Unlike the other 6 buckets, StudentFeeReport never
// kept a running "paid so far" total for old_fee (collectPayment() only
// ever decrements the balance directly - see the "previous_due" branch
// there), so "Paid" here is reconstructed from the FeePayment ledger
// itself (every payment against it is recorded with fee_type
// "Previous Due"), not read off the report.
async function oldFeePaidByStudent(studentIds) {
  if (studentIds.length === 0) return new Map();
  const rows = await FeePayment.aggregate([
    {
      $match: {
        student_id: {
          $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        fee_type: "Previous Due",
        status: { $ne: "Cancelled" },
      },
    },
    { $group: { _id: "$student_id", paid: { $sum: "$amount" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.paid]));
}

function buildOldFeeFilter(req, filter) {
  filter.old_fee = { $gt: 0 };
  delete filter.$or;
  // Cast (safe for both callers - listOldFeeReport's .find() accepts a real
  // ObjectId just as well as a string, and oldFeeSummary's aggregate()
  // $match needs the cast or it silently matches nothing).
  if (req.query.class && mongoose.isValidObjectId(req.query.class)) {
    filter.class = new mongoose.Types.ObjectId(req.query.class);
  }
  if (req.query.search) {
    filter.$or = [
      { student_name: new RegExp(escapeRegex(req.query.search), "i") },
      { mob_number: new RegExp(escapeRegex(req.query.search), "i") },
    ];
  }
  return filter;
}

async function listOldFeeReport(req, res) {
  const { allowed, filter } = buildCategoryBranchFilter(req);
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that branch.",
    });
  }
  buildOldFeeFilter(req, filter);

  const { sort, limit, page } = req.query;
  let query = StudentFeeReport.find(filter).populate(
    "student_id",
    "admission_no full_name",
  );
  if (sort) query = query.sort(sort);

  let meta;
  if (page) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 25, 1);
    const total = await StudentFeeReport.countDocuments(filter);
    query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
    meta = {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  } else if (limit) {
    query = query.limit(Number(limit));
  }

  const records = await query.lean();
  const paidMap = await oldFeePaidByStudent(
    records.map((r) => r.student_id?._id || r.student_id),
  );
  const data = records.map((r) => {
    const paid = paidMap.get(String(r.student_id?._id || r.student_id)) || 0;
    const balance = r.old_fee || 0;
    return shapeCategoryRow(r, {
      gross: paid + balance,
      concession: 0,
      net: paid + balance,
      paid,
      balance,
    });
  });
  return res.json({ success: true, data, ...(meta && { meta }) });
}

async function oldFeeSummary(req, res) {
  const { allowed, filter } = buildCategoryBranchFilter(req);
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that branch.",
    });
  }
  buildOldFeeFilter(req, filter);

  const [result] = await StudentFeeReport.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        balance: { $sum: { $ifNull: ["$old_fee", 0] } },
      },
    },
  ]);
  const count = result?.count || 0;
  const balance = result?.balance || 0;

  const studentIds = await StudentFeeReport.find(filter).distinct("student_id");
  const paidMap = await oldFeePaidByStudent(studentIds);
  const paid = [...paidMap.values()].reduce((a, b) => a + b, 0);

  return res.json({
    success: true,
    data: { count, net: paid + balance, paid, balance },
  });
}

// Kit Amount / Other Income - these have no StudentFeeReport bucket at
// all (see PAYMENT_CATEGORIES above), so the report is built directly off
// FeePayment: one row per student who has at least one non-cancelled
// payment of that fee_type, with Gross/Net/Paid all equal to what they've
// paid (there's nothing "owed" beyond what was already collected for a
// one-off charge like this) and Balance always 0.
async function listPaymentCategoryReport(req, res, feeType) {
  const { allowed, filter: branchFilter } = resolveBranchQueryFilter(
    req.user,
    req.query.branch,
  );
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that branch.",
    });
  }

  const match = {
    ...branchFilter,
    fee_type: feeType,
    status: { $ne: "Cancelled" },
  };
  if (req.query.search) {
    match.student_name = new RegExp(escapeRegex(req.query.search), "i");
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: "$student_id",
        student_name: { $first: "$student_name" },
        total: { $sum: "$amount" },
      },
    },
    {
      $lookup: {
        from: "students",
        localField: "_id",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
  ];
  if (req.query.class && mongoose.isValidObjectId(req.query.class)) {
    pipeline.push({
      $match: { "student.class": new mongoose.Types.ObjectId(req.query.class) },
    });
  }
  pipeline.push({ $sort: { student_name: 1 } });

  const { limit, page } = req.query;
  let meta;
  if (page) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 25, 1);
    const [countResult] = await FeePayment.aggregate([
      ...pipeline,
      { $count: "total" },
    ]);
    const total = countResult?.total || 0;
    pipeline.push({ $skip: (pageNum - 1) * pageSize }, { $limit: pageSize });
    meta = {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  } else if (limit) {
    pipeline.push({ $limit: Number(limit) });
  }

  const rows = await FeePayment.aggregate(pipeline);
  const data = rows.map((r) => ({
    _id: String(r._id),
    student_id: String(r._id),
    admission_no: r.student?.admission_no || "",
    student_name: r.student_name,
    father_name: r.student?.parent_name || "",
    mob_number: r.student?.parent_phone || "",
    class: r.student?.class || null,
    student_type: null,
    status: r.student?.status || null,
    gross: r.total,
    concession: 0,
    net: r.total,
    paid: r.total,
    balance: 0,
  }));
  return res.json({ success: true, data, ...(meta && { meta }) });
}

async function paymentCategorySummary(req, res, feeType) {
  const { allowed, filter: branchFilter } = resolveBranchQueryFilter(
    req.user,
    req.query.branch,
  );
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that branch.",
    });
  }

  const match = {
    ...branchFilter,
    fee_type: feeType,
    status: { $ne: "Cancelled" },
  };
  if (req.query.search) {
    match.student_name = new RegExp(escapeRegex(req.query.search), "i");
  }

  const pipeline = [
    { $match: match },
    { $group: { _id: "$student_id", total: { $sum: "$amount" } } },
  ];
  if (req.query.class && mongoose.isValidObjectId(req.query.class)) {
    pipeline.push(
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          "student.class": new mongoose.Types.ObjectId(req.query.class),
        },
      },
    );
  }
  pipeline.push({
    $group: { _id: null, count: { $sum: 1 }, net: { $sum: "$total" } },
  });

  const [result] = await FeePayment.aggregate(pipeline);
  const net = result?.net || 0;
  return res.json({
    success: true,
    data: { count: result?.count || 0, net, paid: net, balance: 0 },
  });
}

// Inactive Students - scoped by the Student's own `status` (Active vs.
// everything else: Inactive/Graduated/Transferred Out/Dropped Out/On
// Leave/Alumni), which is a completely different field from
// StudentFeeReport.status (that one just means "archived report", not
// "this student left") - so this has to start from Student, not from
// StudentFeeReport, or "inactive" here would silently mean the wrong thing.
async function findInactiveStudentIds(req, branchFilter) {
  const studentFilter = { ...branchFilter, status: { $ne: "Active" } };
  if (req.query.class) studentFilter.class = req.query.class;
  if (req.query.search) {
    studentFilter.$or = [
      { full_name: new RegExp(escapeRegex(req.query.search), "i") },
      { parent_phone: new RegExp(escapeRegex(req.query.search), "i") },
    ];
  }
  return Student.find(studentFilter).distinct("_id");
}

async function listInactiveStudentsReport(req, res) {
  const { allowed, filter: branchFilter } = resolveBranchQueryFilter(
    req.user,
    req.query.branch,
  );
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that branch.",
    });
  }

  const inactiveIds = await findInactiveStudentIds(req, branchFilter);
  const filter = { ...branchFilter, student_id: { $in: inactiveIds } };

  const { sort, limit, page } = req.query;
  // Populate `status` too (not just admission_no/full_name) - this report's
  // whole point is showing WHY a student is inactive, so the row has to
  // read the Student's own status, not StudentFeeReport's unrelated one.
  let query = StudentFeeReport.find(filter).populate(
    "student_id",
    "admission_no full_name status",
  );
  if (sort) query = query.sort(sort);

  let meta;
  if (page) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 25, 1);
    const total = await StudentFeeReport.countDocuments(filter);
    query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
    meta = {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  } else if (limit) {
    query = query.limit(Number(limit));
  }

  const records = await query.lean();
  const data = records.map((r) => {
    const row = shapeCategoryRow(r, {
      gross: sumFields(r, GROSS_FEE_FIELDS),
      concession: sumFields(r, CONCESSION_FEE_FIELDS),
      net: sumFields(r, NET_FEE_FIELDS),
      paid: sumFields(r, PAID_FIELDS),
      balance: sumFields(r, BALANCE_FEE_FIELDS) + (r.old_fee || 0),
    });
    row.status = r.student_id?.status || "Inactive";
    return row;
  });
  return res.json({ success: true, data, ...(meta && { meta }) });
}

async function inactiveStudentsSummary(req, res) {
  const { allowed, filter: branchFilter } = resolveBranchQueryFilter(
    req.user,
    req.query.branch,
  );
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to that branch.",
    });
  }

  const inactiveIds = await findInactiveStudentIds(req, branchFilter);
  const filter = { ...branchFilter, student_id: { $in: inactiveIds } };

  const sumOf = (fields) => ({
    $sum: fields.reduce(
      (acc, f) => ({ $add: [acc, { $ifNull: [`$${f}`, 0] }] }),
      0,
    ),
  });
  const [result] = await StudentFeeReport.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        old_fee: { $sum: { $ifNull: ["$old_fee", 0] } },
        net: sumOf(NET_FEE_FIELDS),
        paid: sumOf(PAID_FIELDS),
        balance: sumOf(BALANCE_FEE_FIELDS),
      },
    },
  ]);
  return res.json({
    success: true,
    data: {
      count: result?.count || 0,
      net: result?.net || 0,
      paid: result?.paid || 0,
      balance: (result?.old_fee || 0) + (result?.balance || 0),
    },
  });
}

// GET /api/fee/category-report?category=old|admission|term|transport|hostel|application|registration|kit|other_income|inactive
// Single entry point the frontend actually calls (see
// src/lib/feeReportCategories.js / CategoryFeeReport.jsx) - dispatches to
// whichever of the scoped queries above matches `category`. Every branch
// returns rows in the same shape (see shapeCategoryRow), so the frontend
// needs exactly one table component for all 10 reports.
export const listCategoryReport = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { category } = req.query;
    if (category === "old") return await listOldFeeReport(req, res);
    if (category === "inactive")
      return await listInactiveStudentsReport(req, res);
    if (PAYMENT_CATEGORIES[category])
      return await listPaymentCategoryReport(
        req,
        res,
        PAYMENT_CATEGORIES[category].feeType,
      );
    if (REPORT_CATEGORIES[category])
      return await listBucketCategoryReport(
        req,
        res,
        REPORT_CATEGORIES[category],
      );
    return res.status(400).json({
      success: false,
      message: `Unknown report category "${category}".`,
    });
  } catch (err) {
    console.error("fee.listCategoryReport error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch the fee report." });
  }
};

// GET /api/fee/category-report-summary - same `category` param as above,
// minus page/limit/sort. Resolves to { count, net, paid, balance } - the
// exact 4 numbers the "Total Students / Total Net Fee / Total Paid Fee /
// Total Balance Fee" cards on each report page need, pre-aggregated across
// every MATCHING row (not just the current page).
export const categoryReportSummary = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { category } = req.query;
    if (category === "old") return await oldFeeSummary(req, res);
    if (category === "inactive") return await inactiveStudentsSummary(req, res);
    if (PAYMENT_CATEGORIES[category])
      return await paymentCategorySummary(
        req,
        res,
        PAYMENT_CATEGORIES[category].feeType,
      );
    if (REPORT_CATEGORIES[category])
      return await bucketCategorySummary(req, res, REPORT_CATEGORIES[category]);
    return res.status(400).json({
      success: false,
      message: `Unknown report category "${category}".`,
    });
  } catch (err) {
    console.error("fee.categoryReportSummary error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch the fee report summary.",
    });
  }
};

// ---------------------------------------------------------------------
// Class Consolidated Report
// ---------------------------------------------------------------------

const CLASS_REPORT_NET_FIELDS = [
  "net_adm_fee",
  "net_term_fee",
  "net_transport_fee",
  "net_hostel_fee",
  "net_application_fee",
  "net_registration_fee",
];
const CLASS_REPORT_PAID_FIELDS = [
  "paid_adm_fee",
  "paid_term_fee",
  "paid_transport_fee",
  "paid_hostel_fee",
  "paid_application_fee",
  "paid_registration_fee",
];
const CLASS_REPORT_BALANCE_FIELDS = [
  "balance_adm_fee",
  "balance_term_fee",
  "balance_transport_fee",
  "balance_hostel_fee",
  "balance_application_fee",
  "balance_registration_fee",
];
const classReportSumOf = (fields) => ({
  $sum: fields.reduce(
    (acc, f) => ({ $add: [acc, { $ifNull: [`$${f}`, 0] }] }),
    0,
  ),
});

// Every numeric the report groups on - listed once so section groups can be
// merged and zero-filled generically instead of field by field.
const CLASS_ROW_METRICS = [
  "total_students",
  "old_fee",
  "net_fee",
  "paid_fee",
  "balance_fee",
  "admission_fee_paid",
  "admission_fee_balance",
  "registration_fee_paid",
  "registration_fee_balance",
  "term_fee_paid",
  "term_fee_balance",
  "transport_fee_paid",
  "transport_fee_balance",
  "hostel_fee_paid",
  "hostel_fee_balance",
];
const zeroMetrics = () =>
  Object.fromEntries(CLASS_ROW_METRICS.map((k) => [k, 0]));
// Also acts as the pick that keeps a raw $group document's `_id` from
// leaking into a response row.
const addMetrics = (a, b) =>
  Object.fromEntries(
    CLASS_ROW_METRICS.map((k) => [k, (a?.[k] || 0) + (b?.[k] || 0)]),
  );

// Where students of a sectioned class land when their own Student.section is
// empty. The "Section is required for this class" check in studentController
// only runs at creation time, so a class that had sections added *after* its
// students were enrolled leaves them all unassigned - they must still be
// reported somewhere or the section rows stop adding up to the class.
const UNASSIGNED_SECTION = "Not Assigned";

// Class.section is free text typed comma-separated (see BPClasses.jsx), so
// "A" declared on the class and " a" stored on a student are the same section
// as far as this report is concerned.
const sectionKeyOf = (s) =>
  String(s ?? "")
    .trim()
    .toUpperCase();
const UNASSIGNED_KEY = sectionKeyOf(UNASSIGNED_SECTION);
const bySectionName = (a, b) =>
  String(a).localeCompare(String(b), "en", { numeric: true });

// GET /api/fee/class-consolidated-report - one row per SECTION, scoped to a
// single academic year (`academic_year` query param) - Class documents are
// themselves per-year (see Class.js's unique {branch, academic_year, grade}
// index; StudentFeeReport has no academic_year of its own, only reaching one
// transitively through its `class` ref), so "current year only" means
// resolving that year's Class _ids first and grouping StudentFeeReport
// against just those, not every class that has ever existed. Includes
// sections with zero students for the year (a plain StudentFeeReport
// aggregation alone would silently omit those, since it only ever produces
// one group per section that actually HAS a report). The summary cards
// total across every fee type (all 6 StudentFeeReport buckets, with old_fee
// folded into balance like reportSummary() does), not just the five
// buckets (Admission/Registration/Term/Transport/Hostel) broken out in the
// table.
//
// Section is not a field on StudentFeeReport - it lives in two places, and
// the split matters here: Class.section is the ARRAY of sections that EXIST
// for a class (["A","B","C"], empty when it has none) while Student.section
// is the single section each student SITS IN. So rows come from the class
// and counts come from a $lookup on the student. Deliberately not
// denormalized onto StudentFeeReport - Transfers.jsx moves students between
// sections, and a copy here would immediately drift.
//
// Every row shape this can emit, all of which exist to keep the invariant
// that the rows always sum to the summary cards:
//   - class has no sections   -> ONE row, section: null, folding in every
//                                student regardless of their own section
//                                (a class can have its sections removed
//                                after students were assigned)
//   - declared section        -> one row each, always, even at zero students
//   - section on students but
//     not declared on class   -> its own row (the class's section list was
//                                edited after students were assigned)
//   - no section on student   -> one UNASSIGNED_SECTION row per class, and
//                                only when it actually has students
export const classConsolidatedReport = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { allowed, filter: branchFilter } = resolveBranchQueryFilter(
      req.user,
      req.query.branch,
    );
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }

    const classFilter = { ...branchFilter, is_deleted: { $ne: true } };
    if (req.query.academic_year)
      classFilter.academic_year = req.query.academic_year;

    const classes = await Class.find(classFilter)
      .sort({ grade_order: 1 })
      .lean();
    const classIds = classes.map((c) => c._id);

    const grouped = await StudentFeeReport.aggregate([
      { $match: { ...branchFilter, class: { $in: classIds } } },
      {
        $lookup: {
          from: "students",
          localField: "student_id",
          foreignField: "_id",
          as: "student",
          // Only `section` is ever read - projecting inside the lookup keeps
          // a full Student document per fee report from being pulled through
          // the rest of the pipeline.
          pipeline: [{ $project: { _id: 0, section: 1 } }],
        },
      },
      {
        // Null, "", whitespace, or a missing Student document altogether all
        // collapse to UNASSIGNED_SECTION rather than dropping the report.
        $addFields: {
          section_name: {
            $let: {
              vars: {
                sec: {
                  $trim: {
                    input: {
                      $ifNull: [{ $arrayElemAt: ["$student.section", 0] }, ""],
                    },
                  },
                },
              },
              in: {
                $cond: [{ $eq: ["$$sec", ""] }, UNASSIGNED_SECTION, "$$sec"],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: { class: "$class", section: "$section_name" },
          total_students: { $sum: 1 },
          old_fee: { $sum: { $ifNull: ["$old_fee", 0] } },
          net_fee: classReportSumOf(CLASS_REPORT_NET_FIELDS),
          paid_fee: classReportSumOf(CLASS_REPORT_PAID_FIELDS),
          balance_fee: classReportSumOf(CLASS_REPORT_BALANCE_FIELDS),
          admission_fee_paid: { $sum: { $ifNull: ["$paid_adm_fee", 0] } },
          admission_fee_balance: { $sum: { $ifNull: ["$balance_adm_fee", 0] } },
          registration_fee_paid: {
            $sum: { $ifNull: ["$paid_registration_fee", 0] },
          },
          registration_fee_balance: {
            $sum: { $ifNull: ["$balance_registration_fee", 0] },
          },
          term_fee_paid: { $sum: { $ifNull: ["$paid_term_fee", 0] } },
          term_fee_balance: { $sum: { $ifNull: ["$balance_term_fee", 0] } },
          transport_fee_paid: { $sum: { $ifNull: ["$paid_transport_fee", 0] } },
          transport_fee_balance: {
            $sum: { $ifNull: ["$balance_transport_fee", 0] },
          },
          hostel_fee_paid: { $sum: { $ifNull: ["$paid_hostel_fee", 0] } },
          hostel_fee_balance: { $sum: { $ifNull: ["$balance_hostel_fee", 0] } },
        },
      },
    ]);

    // classId -> Map(sectionKey -> { section, metrics }). Keyed case- and
    // space-insensitively, so student sections of "A" and " a" merge into one
    // section rather than the second silently overwriting the first.
    const byClass = new Map();
    for (const g of grouped) {
      const cid = String(g._id.class);
      if (!byClass.has(cid)) byClass.set(cid, new Map());
      const bucket = byClass.get(cid);
      // $addFields above already maps an empty section to UNASSIGNED_SECTION,
      // so `key` is never blank in practice - normalized again here so the
      // assembly below can't ever emit a row with a blank Section cell.
      const key = sectionKeyOf(g._id.section) || UNASSIGNED_KEY;
      const prev = bucket.get(key);
      bucket.set(key, {
        section:
          prev?.section ??
          (key === UNASSIGNED_KEY ? UNASSIGNED_SECTION : g._id.section),
        metrics: addMetrics(prev?.metrics, g),
      });
    }

    const rows = [];
    let totalSections = 0;

    for (const c of classes) {
      const sections = byClass.get(String(c._id)) || new Map();
      const pushRow = (section, metrics, has_sections = true) =>
        rows.push({
          class_id: c._id,
          grade: c.grade,
          // null tells the client this class has no sections at all, which it
          // renders (and exports) as "No sections" - distinct from a class
          // that HAS sections but some students aren't in one.
          section,
          has_sections,
          total_students: metrics.total_students,
          admission_fee_paid: metrics.admission_fee_paid,
          admission_fee_balance: metrics.admission_fee_balance,
          registration_fee_paid: metrics.registration_fee_paid,
          registration_fee_balance: metrics.registration_fee_balance,
          term_fee_paid: metrics.term_fee_paid,
          term_fee_balance: metrics.term_fee_balance,
          transport_fee_paid: metrics.transport_fee_paid,
          transport_fee_balance: metrics.transport_fee_balance,
          hostel_fee_paid: metrics.hostel_fee_paid,
          hostel_fee_balance: metrics.hostel_fee_balance,
        });

      const declaredSeen = new Set();
      const declared = (Array.isArray(c.section) ? c.section : [])
        .map((s) => String(s ?? "").trim())
        .filter((s) => {
          const key = sectionKeyOf(s);
          if (!s || declaredSeen.has(key)) return false;
          declaredSeen.add(key);
          return true;
        })
        .sort(bySectionName);

      if (declared.length === 0) {
        const whole = [...sections.values()].reduce(
          (acc, s) => addMetrics(acc, s.metrics),
          zeroMetrics(),
        );
        pushRow(null, whole, false);
        continue;
      }

      for (const s of declared) {
        pushRow(s, sections.get(sectionKeyOf(s))?.metrics || zeroMetrics());
        totalSections += 1;
      }

      const strays = [...sections.entries()]
        .filter(([key]) => key !== UNASSIGNED_KEY && !declaredSeen.has(key))
        .sort((a, b) => bySectionName(a[1].section, b[1].section));
      for (const [, s] of strays) {
        pushRow(s.section, s.metrics);
        totalSections += 1;
      }

      // Skipped if the class somehow declares a section of its own by this
      // name - the loop above already emitted a row for it.
      const unassigned = declaredSeen.has(UNASSIGNED_KEY)
        ? null
        : sections.get(UNASSIGNED_KEY);
      if (unassigned?.metrics.total_students > 0)
        pushRow(UNASSIGNED_SECTION, unassigned.metrics);
    }

    rows.forEach((r, i) => {
      r.sno = i + 1;
    });

    const summary = grouped.reduce(
      (acc, g) => {
        acc.net_fee += g.net_fee || 0;
        acc.paid_fee += g.paid_fee || 0;
        // Matches reportSummary()'s convention: old_fee (previous due) is
        // itself an outstanding balance, so it's folded into balance_fee.
        acc.balance_fee += (g.balance_fee || 0) + (g.old_fee || 0);
        return acc;
      },
      {
        total_classes: classes.length,
        // Real sections only - a whole-class "No sections" row isn't a
        // section, and neither is an UNASSIGNED_SECTION row, so a school that
        // has set none reads as "13 classes, 0 sections".
        total_sections: totalSections,
        net_fee: 0,
        paid_fee: 0,
        balance_fee: 0,
      },
    );

    return res.json({ success: true, data: { summary, rows } });
  } catch (err) {
    console.error("fee.classConsolidatedReport error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch the class consolidated report.",
    });
  }
};

// ---------------------------------------------------------------------
// Pending Dues Report (student-wise)
// ---------------------------------------------------------------------

// The Class Consolidated Report answers "which section owes"; this answers
// "who inside it owes, and how much".
//
// Shares OUTSTANDING_FIELDS/OUTSTANDING_SUM_EXPR with the has_balance
// filter on listReports rather than defining its own notion of "owes
// money" - if the two ever disagreed, the "Pending" filter on the main
// report and this report would return different sets of students and
// there would be no way to tell which was right.
//
// It is a raw sum, so an over-payment in one bucket offsets a shortfall in
// another. That is the same arithmetic the summary cards and the Class
// Consolidated totals already do; netting differently here would put two
// "total balance" figures in the app that never agree.
const TOTAL_PENDING_EXPR = OUTSTANDING_SUM_EXPR;

// Shared head of both pipelines below (rows + summary) so the two can never
// disagree about who counts as pending. Resolves section and admission_no
// off the Student, which is where they live - neither is a field on
// StudentFeeReport (see the note in classConsolidatedReport on why section
// is deliberately not denormalized onto it).
const pendingPipelineStages = (req, branchFilter) => {
  const match = { ...branchFilter, is_deleted: { $ne: true } };
  if (req.query.class && mongoose.isValidObjectId(req.query.class)) {
    match.class = new mongoose.Types.ObjectId(req.query.class);
  }
  if (req.query.student_type) match.student_type = req.query.student_type;

  // `min_pending` doubles as the "owes anything at all" gate - this report
  // is only ever about students with something outstanding, so the floor is
  // 1 rupee even when no threshold is passed.
  const minPending = Math.max(Number(req.query.min_pending) || 0, 1);

  // Ordering matters: total_pending is computed and filtered BEFORE the
  // $lookup, so the join only runs over students who actually owe
  // something rather than over every fee report in the branch. In a school
  // where most families are paid up that is the difference between joining
  // a few hundred documents and joining all ~18k, on a page that polls
  // every 30s and runs this pipeline three times per refresh (rows, count,
  // summary).
  const stages = [
    { $match: match },
    { $addFields: { total_pending: TOTAL_PENDING_EXPR } },
    { $match: { total_pending: { $gte: minPending } } },
    {
      $lookup: {
        from: "students",
        localField: "student_id",
        foreignField: "_id",
        as: "student",
        // Only these three fields are ever read - projecting inside the
        // lookup keeps a full Student document per report from being pulled
        // through the rest of the pipeline.
        pipeline: [
          { $project: { _id: 0, admission_no: 1, section: 1, status: 1 } },
        ],
      },
    },
    {
      $addFields: {
        admission_no: {
          $ifNull: [{ $arrayElemAt: ["$student.admission_no", 0] }, ""],
        },
        student_status: {
          $ifNull: [{ $arrayElemAt: ["$student.status", 0] }, "Active"],
        },
        // Same normalization the Class Consolidated Report applies, so a
        // student with a blank or missing section reads as "Not Assigned"
        // in both reports rather than as an empty cell in one of them.
        section: {
          $let: {
            vars: {
              sec: {
                $trim: {
                  input: {
                    $ifNull: [{ $arrayElemAt: ["$student.section", 0] }, ""],
                  },
                },
              },
            },
            in: {
              $cond: [{ $eq: ["$$sec", ""] }, UNASSIGNED_SECTION, "$$sec"],
            },
          },
        },
      },
    },
  ];

  // Only the two filters that need the joined Student fields are left to
  // apply - the amount gate already ran above.
  const postMatch = {};

  if (req.query.section) {
    // Section is free text (see sectionKeyOf) - matched case-insensitively
    // and anchored, so section "A" never also matches "AB".
    postMatch.section = new RegExp(
      `^${escapeRegex(String(req.query.section).trim())}$`,
      "i",
    );
  }
  if (req.query.search) {
    // admission_no can join this $or directly (unlike buildReportFilter,
    // which has to resolve it to student ids first) - the $lookup above has
    // already folded it onto the row by this point.
    const re = new RegExp(escapeRegex(req.query.search), "i");
    postMatch.$or = [
      { student_name: re },
      { mob_number: re },
      { admission_no: re },
    ];
  }
  if (Object.keys(postMatch).length > 0) stages.push({ $match: postMatch });
  return stages;
};

const PENDING_SORT_FIELDS = new Set([
  "total_pending",
  "student_name",
  "admission_no",
  "section",
]);

// GET /api/student-fee-reports/pending-report
// One row per student who still owes something, defaulting to
// highest-pending-first - a collections list is read top-down, so the
// students actually worth a phone call have to land on page 1 without the
// user having to sort first.
export const listPendingReport = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { allowed, filter: branchFilter } = resolveBranchQueryFilter(
      req.user,
      req.query.branch,
    );
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }

    const rawSort = String(req.query.sort || "-total_pending");
    const desc = rawSort.startsWith("-");
    const sortField = desc ? rawSort.slice(1) : rawSort;
    const sortStage = {
      [PENDING_SORT_FIELDS.has(sortField) ? sortField : "total_pending"]: desc
        ? -1
        : 1,
      // Tiebreak on _id so paging is stable - without it, two students with
      // identical dues can swap places between page 1 and page 2 and one of
      // them is never seen at all.
      _id: 1,
    };

    const stages = [
      ...pendingPipelineStages(req, branchFilter),
      { $sort: sortStage },
      {
        $project: {
          student_id: 1,
          admission_no: 1,
          student_name: 1,
          father_name: 1,
          mob_number: 1,
          class: 1,
          section: 1,
          student_type: 1,
          status: "$student_status",
          old_fee: { $ifNull: ["$old_fee", 0] },
          admission_pending: { $ifNull: ["$balance_adm_fee", 0] },
          registration_pending: { $ifNull: ["$balance_registration_fee", 0] },
          term_pending: { $ifNull: ["$balance_term_fee", 0] },
          transport_pending: { $ifNull: ["$balance_transport_fee", 0] },
          hostel_pending: { $ifNull: ["$balance_hostel_fee", 0] },
          application_pending: { $ifNull: ["$balance_application_fee", 0] },
          // Folded into one column - both are running ledgers that settle to
          // 0 on every payment (see the Kit Fee note on FEE_BUCKETS), so two
          // near-always-empty columns would only widen the sheet.
          kit_other_pending: {
            $add: [
              { $ifNull: ["$balance_kit_fee", 0] },
              { $ifNull: ["$balance_other_fee", 0] },
            ],
          },
          total_pending: 1,
        },
      },
    ];

    // Export (no `page`) pulls every matching row in one request, the same
    // contract listReports/listCategoryReport honour - the frontend relies
    // on it to build a complete sheet rather than exporting only the page
    // currently on screen.
    const { page, limit } = req.query;
    let meta;
    if (page) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const pageSize = Math.max(parseInt(limit, 10) || 25, 1);
      const [countResult] = await StudentFeeReport.aggregate([
        ...pendingPipelineStages(req, branchFilter),
        { $count: "total" },
      ]);
      const total = countResult?.total || 0;
      stages.push({ $skip: (pageNum - 1) * pageSize }, { $limit: pageSize });
      meta = {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      };
    } else if (limit) {
      stages.push({ $limit: Number(limit) });
    }

    const data = await StudentFeeReport.aggregate(stages);
    return res.json({ success: true, data, ...(meta && { meta }) });
  } catch (err) {
    console.error("fee.listPendingReport error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch the pending report." });
  }
};

// GET /api/student-fee-reports/pending-report-summary - the figures the
// cards above the table need, aggregated across every MATCHING student
// (not just the page on screen), so the totals never shift as the user
// pages through the list.
export const pendingReportSummary = async (req, res) => {
  try {
    if (!isAllowed(REPORT_ENTITY, "read", req.user.role))
      return forbidden(res, REPORT_ENTITY, "view");

    const { allowed, filter: branchFilter } = resolveBranchQueryFilter(
      req.user,
      req.query.branch,
    );
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to that branch.",
      });
    }

    const sumOf = (fields) => ({
      $sum: fields.reduce(
        (acc, f) => ({ $add: [acc, { $ifNull: [`$${f}`, 0] }] }),
        0,
      ),
    });
    const [result] = await StudentFeeReport.aggregate([
      ...pendingPipelineStages(req, branchFilter),
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          old_fee: { $sum: { $ifNull: ["$old_fee", 0] } },
          net: sumOf(NET_FEE_FIELDS),
          paid: sumOf(PAID_FIELDS),
          total_pending: { $sum: "$total_pending" },
        },
      },
    ]);

    return res.json({
      success: true,
      data: {
        count: result?.count || 0,
        net: result?.net || 0,
        paid: result?.paid || 0,
        old_fee: result?.old_fee || 0,
        total_pending: result?.total_pending || 0,
      },
    });
  } catch (err) {
    console.error("fee.pendingReportSummary error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch the pending report summary.",
    });
  }
};
