// controllers/expenditureController.js
//
// isAllowed("Expenditure", action, role) - rbac/permissions.js already
// has an Expenditure entry: create/update/delete/read all include
// ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL.
//
// approved_by is a User reference on the schema - set here from
// req.user.id server-side rather than trusting a client-supplied value
// (the reference frontend's ExpenditurePanel had a free-text "Approved
// By" input, which doesn't match a User ObjectId ref at all).

import Expenditure from "../models/Expenditure.js";
import Notification from "../models/Notification.js";
import { isAllowed } from "../rbac/permissions.js";
import { resolveBranchQueryFilter } from "../middleware/branchScope.js";
import { ROLES } from "../config/constants.js";

const ENTITY = "Expenditure";

const forbidden = (res, action) =>
  res.status(403).json({
    success: false,
    message: `You do not have permission to ${action} expenditure records.`,
  });

// Which payment-mode-specific fields apply to each mode - mirrors the
// Cheque/OnlineTransfer/reference-only grouping in BPFees.jsx. Fields not
// listed for the current mode are cleared out so stale data from a
// previous mode never lingers on the record.
const PAYMENT_MODE_FIELDS = {
  Cheque: ["transaction_no", "cheque_date", "bank_name", "bank_branch"],
  OnlineTransfer: ["transaction_no", "bank_name", "bank_branch"],
  "Bank Transfer": ["transaction_no", "bank_name", "bank_branch"],
  "Swipe machine": ["transaction_no"],
  Paytm: ["transaction_no"],
  GooglePay: ["transaction_no"],
  PhonePay: ["transaction_no"],
  Others: ["transaction_no"],
  Cash: [],
};
const ALL_PAYMENT_FIELDS = ["transaction_no", "cheque_date", "bank_name", "bank_branch"];

// Only these categories may carry a document attachment (per product
// decision) - mirrors DOCUMENT_CATEGORIES in BPExpenditure.jsx. Enforced
// here too (not just in the UI), since create() otherwise takes the
// request body largely as-is - a direct API call could attach a document
// to any category without this check.
const DOCUMENT_CATEGORIES = [
  "Building-I Rent",
  "Building-II Rent",
  "Bus Diesel",
  "Bus EMI-I",
  "Bus EMI-II",
  "Salaries and Wages",
];

function pickPaymentFields(mode, body) {
  const allowed = PAYMENT_MODE_FIELDS[mode] || [];
  const out = {};
  for (const field of ALL_PAYMENT_FIELDS) {
    out[field] = allowed.includes(field) ? body[field] : undefined;
  }
  return out;
}

// The only fields a client may set. Every other path on the schema is
// server-owned - branch and approved_by below, plus the delete-approval
// flags, the soft-delete pair and the timestamps. Spreading req.body
// straight into Expenditure.create() (as this did) let a direct API call
// write any of them.
const INPUT_FIELDS = [
  "category",
  "description",
  "amount",
  "date",
  "paid_to",
  "payment_mode",
  "transaction_no",
  "cheque_date",
  "bank_name",
  "bank_branch",
  "document_url",
  "document_name",
];

// Shared by create() and bulkCreate() so a row imported from a spreadsheet
// is built exactly like one added through the form - the reason there was
// no bulk endpoint before was the risk of the two drifting, so there is
// deliberately only this one place where an Expenditure is assembled.
function buildExpenditureDoc(row, { branch, userId }) {
  const paymentMode = row.payment_mode || "Cash";
  const allowDocument = DOCUMENT_CATEGORIES.includes(row.category);

  const doc = {};
  for (const field of INPUT_FIELDS) {
    if (row[field] !== undefined) doc[field] = row[field];
  }

  Object.assign(doc, pickPaymentFields(paymentMode, row), {
    payment_mode: paymentMode,
    document_url: allowDocument ? row.document_url || null : null,
    document_name: allowDocument ? row.document_name || null : null,
    branch,
    approved_by: userId,
  });

  // Both the Add form and the bulk sheet send "" when no cheque date was
  // entered. Mongoose accepts that on a Date path and stores null, so this
  // is normalisation rather than a fix for a cast error: it leaves the key
  // off the document entirely instead of writing an explicit null. Every
  // reader treats the two the same, so nothing downstream depends on which
  // one lands.
  if (!doc.cheque_date) doc.cheque_date = undefined;
  return doc;
}

// Ceiling on one bulk request. Well above the 500 rows the upload template
// covers, and ~600KB of JSON at that size - comfortably inside the 5mb
// express.json limit in app.js.
const BULK_MAX_RECORDS = 2000;

// GET /api/expenditure
// params (all optional): category, payment_mode, sort, from, to, page, limit, branch
// page/limit turn on pagination - when page is present the response also
// carries a `meta` block ({ total, page, limit, totalPages }); when it's
// omitted (existing callers), the endpoint behaves as before. `branch` only
// has any effect for multi-branch roles (single-branch roles are always
// pinned to their own branch) - see resolveBranchQueryFilter.
export const list = async (req, res) => {
  try {
    if (!isAllowed(ENTITY, "read", req.user.role))
      return forbidden(res, "view");

    const { category, payment_mode, sort, limit, page, from, to, branch } =
      req.query;
    const { allowed, filter } = resolveBranchQueryFilter(req.user, branch);
    if (!allowed) {
      return res
        .status(403)
        .json({ success: false, message: "You do not have access to that branch." });
    }
    if (category) filter.category = category;
    if (payment_mode) filter.payment_mode = payment_mode;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    let query = Expenditure.find(filter)
      .populate("branch", "name")
      .populate("approved_by", "full_name")
      .populate("delete_requested_by", "full_name");
    if (sort) query = query.sort(sort);

    let meta;
    if (page) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const pageSize = Math.max(parseInt(limit, 10) || 10, 1);
      const total = await Expenditure.countDocuments(filter);
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
    return res.json({ success: true, data: records, ...(meta && { meta }) });
  } catch (err) {
    console.error("expenditure.list error:", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch expenditure records.",
      });
  }
};

// POST /api/expenditure
export const create = async (req, res) => {
  try {
    if (!isAllowed(ENTITY, "create", req.user.role))
      return forbidden(res, "create");

    const branch = req.body.branch || req.user.branch;
    if (!branch) {
      return res
        .status(400)
        .json({ success: false, message: "A branch is required." });
    }

    const record = await Expenditure.create(
      buildExpenditureDoc(req.body, { branch, userId: req.user.id }),
    );

    const populated = await record.populate("approved_by", "full_name");
    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error("expenditure.create error:", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to create expenditure record.",
      });
  }
};

// POST /api/expenditure/bulk
// body: { records: [ <same shape as a single create>, ... ], branch? }
//
// One request for a whole spreadsheet. The bulk upload dialog used to POST
// every row separately, so a 900-row sheet meant 900 requests against the
// 1000-per-15-minutes limiter in app.js: past the limit the remaining rows
// came back 429 while the earlier ones had already saved, leaving a
// half-imported sheet that could not simply be re-uploaded (nothing dedupes
// expenditure records).
//
// Rows are built and validated up front, then written with ordered: false so
// one bad row never blocks the rest. Failures come back keyed by the index of
// the row in the submitted array, which the client maps to the spreadsheet
// row number it already showed the user. Partial success is the normal
// outcome, not an error - the response is 201 carrying both counts.
export const bulkCreate = async (req, res) => {
  try {
    if (!isAllowed(ENTITY, "create", req.user.role))
      return forbidden(res, "create");

    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Send a non-empty records array." });
    }
    if (records.length > BULK_MAX_RECORDS) {
      return res.status(400).json({
        success: false,
        message: `Too many records in one request (max ${BULK_MAX_RECORDS}). Split the file and upload it in parts.`,
      });
    }

    const branch = req.body.branch || req.user.branch;
    if (!branch) {
      return res
        .status(400)
        .json({ success: false, message: "A branch is required." });
    }

    // Validate everything before writing anything, so a row that could never
    // save is reported against its own index instead of surfacing as an
    // opaque bulk-write error. validateSync() runs the schema rules
    // themselves (enums, required, casts) - no second copy of them to keep in
    // step with the model.
    const failed = [];
    const pending = [];
    records.forEach((row, index) => {
      const doc = new Expenditure(
        buildExpenditureDoc(row ?? {}, { branch, userId: req.user.id }),
      );
      const invalid = doc.validateSync();
      if (invalid) {
        failed.push({
          index,
          message: Object.values(invalid.errors)
            .map((e) => e.message)
            .join("; "),
        });
        return;
      }
      pending.push({ index, doc });
    });

    let created = 0;
    if (pending.length > 0) {
      try {
        const inserted = await Expenditure.insertMany(
          pending.map((p) => p.doc),
          { ordered: false },
        );
        created = inserted.length;
      } catch (bulkErr) {
        // ordered: false - whatever could be written already was, so report
        // the stragglers rather than failing the whole request.
        const writeErrors = bulkErr.writeErrors ?? [];
        if (writeErrors.length === 0) throw bulkErr;
        created = bulkErr.insertedDocs?.length ?? 0;
        for (const writeErr of writeErrors) {
          const at = writeErr.index ?? writeErr.err?.index;
          failed.push({
            index: pending[at]?.index ?? at,
            message:
              writeErr.errmsg || writeErr.err?.errmsg || "Failed to save.",
          });
        }
      }
    }

    failed.sort((a, b) => a.index - b.index);
    return res.status(201).json({ success: true, data: { created, failed } });
  } catch (err) {
    console.error("expenditure.bulkCreate error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create expenditure records.",
    });
  }
};

// PUT /api/expenditure/:id
// Editing a saved record is intentionally limited to payment_mode and its
// related details (transaction_no/cheque_date/bank_name/bank_branch) -
// every other field (amount included) is locked once the record exists.
export const update = async (req, res) => {
  try {
    if (!isAllowed(ENTITY, "update", req.user.role))
      return forbidden(res, "update");

    const filter = { _id: req.params.id };
    if (req.user.branch) filter.branch = req.user.branch;
    const existing = await Expenditure.findOne(filter);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Expenditure record not found." });
    }

    if (existing.delete_requested) {
      return res.status(409).json({
        success: false,
        message: "This record has a pending deletion request and cannot be edited.",
      });
    }

    if (req.body.payment_mode === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "payment_mode is required." });
    }

    existing.payment_mode = req.body.payment_mode;
    const picked = pickPaymentFields(existing.payment_mode, req.body);
    for (const field of ALL_PAYMENT_FIELDS) existing[field] = picked[field];
    await existing.save();

    return res.json({ success: true, data: existing });
  } catch (err) {
    console.error("expenditure.update error:", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to update expenditure record.",
      });
  }
};

// POST /api/expenditure/:id/request-delete
// Anyone with delete permission can request deletion, but this does not
// remove the record - it just flags it for an Admin Officer to approve.
export const requestDelete = async (req, res) => {
  try {
    if (!isAllowed(ENTITY, "delete", req.user.role))
      return forbidden(res, "delete");

    const filter = { _id: req.params.id };
    if (req.user.branch) filter.branch = req.user.branch;
    const existing = await Expenditure.findOne(filter);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Expenditure record not found." });
    }

    if (existing.delete_requested) {
      return res.status(409).json({
        success: false,
        message: "A deletion request is already pending for this record.",
      });
    }

    existing.delete_requested = true;
    existing.delete_requested_by = req.user.id;
    existing.delete_requested_at = new Date();
    existing.delete_requested_by_role = req.user.role;
    await existing.save();

    await Notification.create({
      recipient_role: ROLES.ADMIN_OFFICER,
      branch: existing.branch,
      type: "expenditure_delete_request",
      related_record_id: existing._id,
      initiated_by: req.user._id,
      status: "Open",
      title: `Expenditure deletion requested: ${existing.category}`,
      message: `${req.user.full_name || "A staff member"} has requested to delete an expenditure record "${existing.category}" (₹${existing.amount.toLocaleString("en-IN")}). Review it on the Expenditure page.`,
    });

    return res.json({ success: true, data: existing });
  } catch (err) {
    console.error("expenditure.requestDelete error:", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to request deletion of expenditure record.",
      });
  }
};

// Admin Officers only manage deletion requests for branches assigned to
// them via User.branches - this is separate from the general "delete"
// RBAC permission, which only governs who can *request* a deletion.
const isBranchAdminOfficer = (user, branchId) =>
  user.role === "admin_officer" &&
  (user.branches || []).some((b) => b.toString() === branchId.toString());

// POST /api/expenditure/:id/approve-delete
export const approveDelete = async (req, res) => {
  try {
    const existing = await Expenditure.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Expenditure record not found." });
    }

    if (!isBranchAdminOfficer(req.user, existing.branch)) {
      return forbidden(res, "approve deletion of");
    }

    if (!existing.delete_requested) {
      return res.status(409).json({
        success: false,
        message: "This record has no pending deletion request.",
      });
    }

    const requestedBy = existing.delete_requested_by;
    const requestedByRole = existing.delete_requested_by_role;
    const category = existing.category;
    const amount = existing.amount;
    const branch = existing.branch;
    const recordId = existing._id;

    await existing.deleteOne();

    await Notification.updateMany(
      {
        related_record_id: recordId,
        type: "expenditure_delete_request",
        status: "Open",
      },
      { $set: { status: "Resolved", updated_by: req.user._id } },
    );

    if (requestedBy && requestedByRole) {
      await Notification.create({
        recipient_role: requestedByRole,
        recipient_user_id: requestedBy,
        branch,
        type: "expenditure_delete_result",
        status: "Open",
        title: `Expenditure deletion approved: ${category}`,
        message: `Your request to delete the expenditure record "${category}" (₹${amount.toLocaleString("en-IN")}) was approved by the Admin Officer.`,
      });
    }

    return res.json({ success: true, data: { _id: recordId } });
  } catch (err) {
    console.error("expenditure.approveDelete error:", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to approve deletion of expenditure record.",
      });
  }
};

// POST /api/expenditure/:id/reject-delete
export const rejectDelete = async (req, res) => {
  try {
    const existing = await Expenditure.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Expenditure record not found." });
    }

    if (!isBranchAdminOfficer(req.user, existing.branch)) {
      return forbidden(res, "reject deletion of");
    }

    if (!existing.delete_requested) {
      return res.status(409).json({
        success: false,
        message: "This record has no pending deletion request.",
      });
    }

    const requestedBy = existing.delete_requested_by;
    const requestedByRole = existing.delete_requested_by_role;

    existing.delete_requested = false;
    existing.delete_requested_by = null;
    existing.delete_requested_at = null;
    existing.delete_requested_by_role = null;
    await existing.save();

    await Notification.updateMany(
      {
        related_record_id: existing._id,
        type: "expenditure_delete_request",
        status: "Open",
      },
      { $set: { status: "Resolved", updated_by: req.user._id } },
    );

    if (requestedBy && requestedByRole) {
      await Notification.create({
        recipient_role: requestedByRole,
        recipient_user_id: requestedBy,
        branch: existing.branch,
        type: "expenditure_delete_result",
        status: "Open",
        title: `Expenditure deletion rejected: ${existing.category}`,
        message: `Your request to delete the expenditure record "${existing.category}" (₹${existing.amount.toLocaleString("en-IN")}) was rejected by the Admin Officer.`,
      });
    }

    return res.json({ success: true, data: existing });
  } catch (err) {
    console.error("expenditure.rejectDelete error:", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to reject deletion of expenditure record.",
      });
  }
};
