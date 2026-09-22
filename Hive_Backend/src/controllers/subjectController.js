// controllers/subjectController.js
//
// CRUD for the shared Subject catalog (see models/Subject.js) plus the
// per-branch enable/disable toggle that decides what each branch's subject
// dropdowns actually show.
//
// Branch scoping here deliberately does NOT go through buildScopeFilter.
// That helper pins single-branch roles with `scope.branch = user.branch`,
// and Subject has no `branch` field - it has `branches`, an array. Applying
// it unchanged would add a clause that matches nothing and every subject
// dropdown in the app would come back empty. resolveBranchQueryFilter is
// used instead and its resolved value re-keyed onto `branches`, where an
// equality match means "array contains" and `$in` means "contains any of".
import mongoose from "mongoose";
import Subject from "../models/Subject.js";
import Class from "../models/Class.js";
import User from "../models/User.js";
import Marks from "../models/Marks.js";
import Attendance from "../models/Attendance.js";
import Homework from "../models/Homework.js";
import Branch from "../models/Branch.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { isAllowed } from "../rbac/permissions.js";
import { resolveBranchQueryFilter } from "../middleware/branchScope.js";
import { MULTI_BRANCH_ROLES, ROLES } from "../config/constants.js";

function assertAllowed(action, role) {
  if (!isAllowed("Subject", action, role)) {
    throw new ApiError(403, `Your role is not permitted to ${action} subjects.`);
  }
}

// Translates resolveBranchQueryFilter's `{ branch: ... }` onto Subject's
// `branches` array. super_admin with no ?branch= gets `{}` (everything).
function branchClauseFor(user, queryBranch) {
  const { allowed, filter } = resolveBranchQueryFilter(user, queryBranch);
  if (!allowed) return { allowed: false, clause: {} };
  if (!("branch" in filter)) return { allowed: true, clause: {} };
  return { allowed: true, clause: { branches: filter.branch } };
}

// The single branch a write should default to. Single-branch roles can only
// ever mean their own; a multi-branch role has to say which one explicitly,
// the same rule sanitizeAndScopeBody applies on every other entity.
function resolveWriteBranch(user, requested) {
  if (!MULTI_BRANCH_ROLES.includes(user.role)) {
    if (requested && String(requested) !== String(user.branch)) {
      throw new ApiError(403, "You can only manage subjects for your own branch.");
    }
    return user.branch ? String(user.branch) : null;
  }
  if (!requested) {
    throw new ApiError(400, "branch is required.");
  }
  if (user.role !== ROLES.SUPER_ADMIN) {
    const assigned = (user.branches || []).map(String);
    if (!assigned.includes(String(requested))) {
      throw new ApiError(403, "You do not have access to that branch.");
    }
  }
  return String(requested);
}

// The guard that makes a SHARED catalog safe to hand to single-branch
// roles: a Principal at one branch must not be able to rename or delete a
// subject another branch is relying on. Multi-branch roles and super_admin
// see the whole picture already, so the check doesn't apply to them.
function assertNoOtherBranchUses(doc, user) {
  if (MULTI_BRANCH_ROLES.includes(user.role)) return;
  const mine = String(user.branch || "");
  const others = (doc.branches || [])
    .map(String)
    .filter((b) => b !== mine);
  if (others.length > 0) {
    throw new ApiError(
      409,
      `"${doc.name}" is in use by ${others.length} other branch${
        others.length === 1 ? "" : "es"
      }. Remove it from those branches first, or ask an Admin Officer.`,
    );
  }
}

function friendlyDuplicateError(err) {
  if (err?.code !== 11000) return null;
  return "A subject with this name already exists.";
}

function cleanName(name) {
  const trimmed = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) throw new ApiError(400, "Subject name is required.");
  if (trimmed.length > 60) {
    throw new ApiError(400, "Subject name must be 60 characters or fewer.");
  }
  return trimmed;
}

// GET /api/subjects
//   (default)        subjects enabled for the caller's branch - what every
//                    subject dropdown in the app uses
//   ?scope=catalog   the whole catalog, for the Subjects management page,
//                    with `branches` populated so it can show which
//                    branches have adopted each row
//   ?branch=<id>     narrows to one branch (multi-branch roles only)
//   ?include_inactive=true  keeps is_active:false rows in (management page)
export const listSubjects = asyncHandler(async (req, res) => {
  assertAllowed("read", req.user.role);

  const filter = { is_deleted: { $ne: true } };
  if (req.query.include_inactive !== "true") filter.is_active = true;

  const catalog = req.query.scope === "catalog";
  if (!catalog) {
    const { allowed, clause } = branchClauseFor(req.user, req.query.branch);
    if (!allowed) throw new ApiError(403, "You do not have access to that branch.");
    Object.assign(filter, clause);
  }

  let query = Subject.find(filter).sort({ name: 1 });
  if (catalog) query = query.populate("branches", "name code");

  const rows = await query.lean();
  res.json({ data: rows, total: rows.length });
});

// POST /api/subjects   body: { name, code?, branch? }
//
// Creating a subject also enables it for the creator's own branch. The
// catalog/branch split exists so ANOTHER branch has to opt in explicitly -
// not to make you add a subject twice to use it where you created it.
export const createSubject = asyncHandler(async (req, res) => {
  assertAllowed("create", req.user.role);

  const name = cleanName(req.body?.name);
  const branch = resolveWriteBranch(req.user, req.body?.branch);

  try {
    const doc = await Subject.create({
      name,
      code: String(req.body?.code ?? "").trim(),
      branches: branch ? [branch] : [],
      created_by: req.user._id,
      updated_by: req.user._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    const friendly = friendlyDuplicateError(err);
    if (friendly) throw new ApiError(409, friendly);
    throw err;
  }
});

// PUT /api/subjects/:id   body: { name?, code?, is_active? }
//
// `branches` is deliberately not settable here - it moves only through
// toggleSubjectBranch below, which is where the per-branch permission check
// lives. Letting it through here would be a way around that check.
export const updateSubject = asyncHandler(async (req, res) => {
  assertAllowed("update", req.user.role);

  const doc = await Subject.findOne({
    _id: req.params.id,
    is_deleted: { $ne: true },
  });
  if (!doc) throw new ApiError(404, "Subject not found.");

  const renaming =
    req.body?.name !== undefined && cleanName(req.body.name) !== doc.name;
  // Only a rename or a retire can hurt another branch - editing the short
  // code is cosmetic, so it isn't worth blocking on.
  if (renaming || req.body?.is_active === false) {
    assertNoOtherBranchUses(doc, req.user);
  }

  if (req.body?.name !== undefined) doc.name = cleanName(req.body.name);
  if (req.body?.code !== undefined) doc.code = String(req.body.code).trim();
  if (req.body?.is_active !== undefined) {
    doc.is_active = Boolean(req.body.is_active);
  }
  doc.updated_by = req.user._id;

  try {
    await doc.save();
    res.json(doc);
  } catch (err) {
    const friendly = friendlyDuplicateError(err);
    if (friendly) throw new ApiError(409, friendly);
    throw err;
  }
});

// Everywhere a subject name is stored as a plain string. Checked before a
// delete so a subject that teachers are assigned to, or that has marks
// against it, can't quietly vanish out from under those records - they
// would keep the name with nothing in the catalog to explain it.
async function subjectUsage(name) {
  const [classes, users, marks, attendance, homework] = await Promise.all([
    Class.countDocuments({
      "subject_teachers.subject": name,
      is_deleted: { $ne: true },
    }),
    // User has no is_deleted - it soft-deletes via is_active (see
    // models/User.js), and a deactivated teacher should not keep a subject
    // locked. strictQuery would have silently dropped an is_deleted clause
    // here, making the count quietly include them.
    User.countDocuments({ subject_taught: name, is_active: true }),
    Marks.countDocuments({ subject: name, is_deleted: { $ne: true } }),
    Attendance.countDocuments({ subject: name, is_deleted: { $ne: true } }),
    Homework.countDocuments({ subject: name, is_deleted: { $ne: true } }),
  ]);
  return { classes, users, marks, attendance, homework };
}

// DELETE /api/subjects/:id  (soft delete)
export const deleteSubject = asyncHandler(async (req, res) => {
  assertAllowed("delete", req.user.role);

  const doc = await Subject.findOne({
    _id: req.params.id,
    is_deleted: { $ne: true },
  });
  if (!doc) throw new ApiError(404, "Subject not found.");

  assertNoOtherBranchUses(doc, req.user);

  const usage = await subjectUsage(doc.name);
  const blockers = [
    usage.classes && `${usage.classes} class assignment(s)`,
    usage.users && `${usage.users} staff record(s)`,
    usage.marks && `${usage.marks} marks entr(ies)`,
    usage.attendance && `${usage.attendance} attendance record(s)`,
    usage.homework && `${usage.homework} homework record(s)`,
  ].filter(Boolean);

  if (blockers.length > 0) {
    throw new ApiError(
      409,
      `"${doc.name}" is still used by ${blockers.join(", ")}. ` +
        `Reassign those first, or set the subject to Inactive to hide it from dropdowns instead.`,
    );
  }

  doc.is_deleted = true;
  doc.deleted_at = new Date();
  doc.updated_by = req.user._id;
  await doc.save({ validateModifiedOnly: true });

  res.json({ success: true, id: doc._id });
});

// PUT /api/subjects/:id/branch   body: { branch?, enabled: boolean }
//
// Adds the subject to a branch's list, or takes it off. This is the "for a
// branch to get subjects they have to be added to the branch" step - a row
// in the catalog is invisible to a branch until it goes through here.
//
// $addToSet/$pull rather than read-modify-write so two branches enabling
// the same subject at once can't clobber each other's entry.
export const toggleSubjectBranch = asyncHandler(async (req, res) => {
  assertAllowed("update", req.user.role);

  const branch = resolveWriteBranch(req.user, req.body?.branch);
  if (!branch) throw new ApiError(400, "branch is required.");
  if (!mongoose.isValidObjectId(branch)) {
    throw new ApiError(400, "branch is not a valid id.");
  }
  const enabled = Boolean(req.body?.enabled);

  const exists = await Branch.exists({ _id: branch });
  if (!exists) throw new ApiError(404, "Branch not found.");

  // Taking a subject off a branch leaves any Class/User record that already
  // names it untouched - the string stays, the dropdown just stops offering
  // it. Warn rather than block: unlike a delete, this is reversible and
  // scoped to one branch.
  const doc = await Subject.findOneAndUpdate(
    { _id: req.params.id, is_deleted: { $ne: true } },
    {
      ...(enabled
        ? { $addToSet: { branches: branch } }
        : { $pull: { branches: branch } }),
      $set: { updated_by: req.user._id },
    },
    { new: true },
  ).populate("branches", "name code");

  if (!doc) throw new ApiError(404, "Subject not found.");
  res.json(doc);
});
