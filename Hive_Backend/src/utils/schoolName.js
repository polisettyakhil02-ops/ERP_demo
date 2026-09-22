import Branch from "../models/Branch.js";

// Branch.schoolName is free text with no real FK to a School record - this
// is the one place "same school" comparisons normalize it, so every caller
// (transferTeachers today, anything else later) treats it identically.
export const normalizeSchoolName = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

// What a record falls back to when its branch has no schoolName set yet
// (Branch.schoolName defaults to ""), matching what userController.create
// has always stamped on a user in the same situation.
export const DEFAULT_SCHOOL_NAME = "Master Minds";

// The BRANCH a record belongs to - never whoever happens to be saving it -
// decides which school that record is filed under. This matters for every
// request/approve flow: an Admin Officer spans several branches (and
// carries a schoolName of their own), so stamping req.user.schoolName filed
// the Accounts Manager's student under the *approver's* school whenever the
// two differed. userController.create/transferTeachers already resolve a
// user's schoolName from their branch this way; these helpers are the same
// rule for Students and Admissions.
export async function resolveSchoolNameForBranch(
  branchId,
  fallback = DEFAULT_SCHOOL_NAME,
) {
  if (!branchId) return fallback || DEFAULT_SCHOOL_NAME;
  const branch = await Branch.findById(branchId).select("schoolName").lean();
  return branch?.schoolName?.trim() || fallback || DEFAULT_SCHOOL_NAME;
}

// Batch form of the above, for bulk inserts that can span several branches
// in one payload - one query for the whole batch instead of one per row.
// Returns a Map keyed by String(branch id); callers fall back themselves
// for rows whose branch is missing or unknown.
export async function resolveSchoolNamesForBranches(
  branchIds,
  fallback = DEFAULT_SCHOOL_NAME,
) {
  const ids = [...new Set(branchIds.filter(Boolean).map(String))];
  if (ids.length === 0) return new Map();
  const branches = await Branch.find({ _id: { $in: ids } })
    .select("schoolName")
    .lean();
  return new Map(
    branches.map((b) => [
      String(b._id),
      b.schoolName?.trim() || fallback || DEFAULT_SCHOOL_NAME,
    ]),
  );
}
