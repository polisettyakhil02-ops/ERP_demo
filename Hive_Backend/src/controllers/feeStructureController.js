import FeeStructure from "../models/FeeStructure.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { isAllowed } from "../rbac/permissions.js";
import {
  buildScopeFilter,
  resolveBranchQueryFilter,
  sanitizeAndScopeBody,
} from "../middleware/branchScope.js";
import { syncFeeReportBuckets } from "../utils/feeStructureSync.js";

function assertAllowed(action, role) {
  if (!isAllowed("FeeStructure", action, role)) {
    throw new ApiError(
      403,
      `Your role is not permitted to ${action} FeeStructure records.`,
    );
  }
}

function friendlyDuplicateError(err) {
  if (err?.code !== 11000) return null;
  const keys = Object.keys(err.keyPattern || {});
  if (
    keys.includes("branch") &&
    keys.includes("academic_year") &&
    keys.includes("grade")
  ) {
    return "A fee structure for this branch, academic year and class already exists.";
  }
  return "A record with these values already exists.";
}

// GET /api/fee-structures
//
// Branch scoping goes through resolveBranchQueryFilter for the same reason
// listBusRoutes does - see the note there. Without it an admin_officer
// listing with no ?branch= received every FeeStructure in the database,
// across branches (and schools) they were never assigned to.
export const listFeeStructures = asyncHandler(async (req, res) => {
  assertAllowed("read", req.user.role);
  const { allowed, filter } = resolveBranchQueryFilter(req.user, req.query.branch);
  if (!allowed) throw new ApiError(403, "You do not have access to that branch.");
  const matchFilter = { ...buildScopeFilter("FeeStructure", req.user), ...filter };
  if (req.query.academic_year)
    matchFilter.academic_year = req.query.academic_year;
  if (req.query.grade) matchFilter.grade = req.query.grade;

  // ?summary=branch - per branch, how many DISTINCT classes have a fee
  // structure for the requested academic_year. That distinct-grade count
  // (not a row count) is what the branch card reports as "12 of 14 classes
  // set", and computing it server-side keeps the card screen off the full
  // row set.
  if (req.query.summary === "branch") {
    const summary = await FeeStructure.aggregate([
      { $match: matchFilter },
      { $group: { _id: { branch: "$branch", grade: "$grade" } } },
      { $group: { _id: "$_id.branch", grades: { $sum: 1 } } },
    ]);
    return res.json({
      data: summary.map((r) => ({ branch: r._id, grades: r.grades })),
    });
  }

  const rows = await FeeStructure.find(matchFilter)
    .populate("branch", "name code")
    .sort({ academic_year: -1, branch: 1 })
    .lean();

  res.json({ data: rows, total: rows.length });
});

// POST /api/fee-structures
export const createFeeStructure = asyncHandler(async (req, res) => {
  assertAllowed("create", req.user.role);
  const body = sanitizeAndScopeBody("FeeStructure", req.user, req.body);

  try {
    const doc = await FeeStructure.create({
      ...body,
      created_by: req.user._id,
      updated_by: req.user._id,
    });
    // Syncs the optional buckets (Admission/Registration/Application) onto
    // students who already exist for this branch/class - see
    // feeStructureSync.js for exactly what this does and doesn't touch.
    const sync = await syncFeeReportBuckets(doc, req.user._id);
    res.status(201).json({ ...doc.toObject(), _sync: sync });
  } catch (err) {
    const friendly = friendlyDuplicateError(err);
    if (friendly) throw new ApiError(409, friendly);
    throw err;
  }
});

// PUT /api/fee-structures/:id
export const updateFeeStructure = asyncHandler(async (req, res) => {
  assertAllowed("update", req.user.role);
  const scope = buildScopeFilter("FeeStructure", req.user);
  const clean = sanitizeAndScopeBody("FeeStructure", req.user, req.body);
  delete clean.branch;

  try {
    const doc = await FeeStructure.findOne({ _id: req.params.id, ...scope });
    if (!doc) throw new ApiError(404, "Fee structure record not found.");
    Object.assign(doc, clean);
    doc.updated_by = req.user._id;
    await doc.save();
    // See createFeeStructure above - same backfill, same rules.
    const sync = await syncFeeReportBuckets(doc, req.user._id);
    res.json({ ...doc.toObject(), _sync: sync });
  } catch (err) {
    const friendly = friendlyDuplicateError(err);
    if (friendly) throw new ApiError(409, friendly);
    throw err;
  }
});

// DELETE /api/fee-structures/:id
export const deleteFeeStructure = asyncHandler(async (req, res) => {
  assertAllowed("delete", req.user.role);
  const scope = buildScopeFilter("FeeStructure", req.user);
  const doc = await FeeStructure.findOneAndUpdate(
    { _id: req.params.id, ...scope },
    { is_deleted: true, deleted_at: new Date(), updated_by: req.user._id },
    { new: true },
  );
  if (!doc) throw new ApiError(404, "Fee structure record not found.");
  res.json({ success: true, id: doc._id });
});
