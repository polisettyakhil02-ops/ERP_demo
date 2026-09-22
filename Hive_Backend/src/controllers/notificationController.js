import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Branch from "../models/Branch.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ROLES, MULTI_BRANCH_ROLES } from "../config/constants.js";

// GET /api/notifications?all=1&branch=&status=&page=&limit=
// Scoped inline rather than via rbac/permissions.js - this is simple enough
// (recipient_role+branch or recipient_user_id addressing) that a full
// PERMISSIONS entry would just be indirection. A caller sees whatever
// matches their role+branch (single-branch roles like principal/
// accounts_manager, matched via req.user.branch; multi-branch roles like
// admin_officer, matched via req.user.branches - e.g. student_delete_request
// notifications, addressed to whichever Admin Officer covers that specific
// student's branch) UNIONed with anything addressed to them by
// recipient_user_id directly (e.g. the "retry this transfer" loop-back in
// resolve() below).
//
// `branch` optionally narrows a multi-branch caller (admin_officer) down to
// one of their own assigned branches - same "narrow, never widen" contract
// as resolveBranchQueryFilter (branchScope.js), just applied inline since
// this filter's shape (an $or of two addressing modes) doesn't fit that
// helper directly. `status` (Open/Resolved/All) and `page`/`limit` back the
// full NotificationsPage; the bell keeps calling this with none of those,
// which still defaults to "Open, capped at 100" exactly as before.
// Every Notification `type` in this system follows an "entity_action"
// naming convention (student_delete_request, fee_receipt_cancellation_
// request, income_delete_result, ...) - this lets the Notifications page's
// category tabs filter server-side (so pagination/counts stay correct per
// tab) off a simple prefix match, without hand-listing every literal type
// string here and having to remember to update it each time a new one is
// added elsewhere in the codebase.
// Values are prefix LISTS, so one tab can own more than one type family.
//
// There is deliberately no "income" entry: the Income page is commented out
// of NAV_BY_ROLE (RoleLayout.jsx), so an Income tab could only ever be
// empty for a live user. Existing income_* notifications are still reachable
// under "All".
//
// back_date_ rides under fee_receipts rather than getting a tab of its own:
// a back-dated payment request is raised from the same Add Payment dialog
// as a receipt cancellation (see AddPaymentDialog.jsx), so that is where
// someone goes looking for it. Without this it would have no tab at all
// once the catch-all "other" tab was removed.
const CATEGORY_PREFIXES = {
  fee_receipts: ["fee_receipt_cancellation", "back_date_"],
  students: ["student_"],
  staff: ["staff_"],
  expenditure: ["expenditure_"],
  concessions: ["concession_"],
};


export const list = asyncHandler(async (req, res) => {
  const { status, page, limit, category } = req.query;
  const queryBranch = req.query.branch;

  const or = [{ recipient_user_id: req.user._id }];
  // A multi-branch role (admin_officer/super_admin) must always match on
  // the full req.user.branches[] - a stray req.user.branch left over from
  // account creation (it's nullable, never cleared) would otherwise
  // silently collapse this to just one of their assigned branches and hide
  // every other branch's Open notifications. Same "stray branch" footgun
  // resolveBranchQueryFilter (branchScope.js) already guards against.
  if (req.user.branch && !MULTI_BRANCH_ROLES.includes(req.user.role)) {
    or.push({ recipient_role: req.user.role, branch: req.user.branch });
  } else if (req.user.branches?.length) {
    or.push({
      recipient_role: req.user.role,
      branch: { $in: req.user.branches },
    });
  }

  const filter = { $or: or, is_deleted: { $ne: true } };

  if (queryBranch) {
    if (!mongoose.isValidObjectId(queryBranch)) {
      throw new ApiError(400, "Invalid branch.");
    }
    const ownsBranch = req.user.branches?.length
      ? req.user.branches.some((b) => String(b) === String(queryBranch))
      : String(req.user.branch) === String(queryBranch);
    if (!ownsBranch) {
      throw new ApiError(403, "You do not have access to that branch.");
    }
    filter.branch = new mongoose.Types.ObjectId(queryBranch);
  }

  if (status === "All" || req.query.all === "1") {
    // no status restriction
  } else if (status) {
    filter.status = status;
  } else {
    filter.status = "Open";
  }

  if (category && category !== "all" && CATEGORY_PREFIXES[category]) {
    filter.type = {
      $regex: `^(${CATEGORY_PREFIXES[category].join("|")})`,
    };
  }

  let query = Notification.find(filter).sort("-created_date");

  let meta;
  if (page) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 25, 1);
    const total = await Notification.countDocuments(filter);
    query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
    meta = {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  } else {
    query = query.limit(100);
  }

  const data = await query.lean();
  res.json({ data, ...(meta && { meta }) });
});

// Notification types that must be decided through their own dedicated
// approve/reject endpoint (which resolves the notification itself as a side
// effect) rather than this generic resolve() - mirrors the frontend's
// ACTIONABLE_TYPES (Hive_Frontend/src/lib/notificationActionTypes.js), which
// is what the Notifications page and the header bell both use to render a
// real Approve/Reject instead of "Mark done" for these. Without this guard,
// any client hitting this endpoint directly on one of these (e.g. the bell's
// old back_date_request-only special case silently falling through to
// "Mark done" for every other actionable type) would clear the notification
// while leaving the underlying deletion/cancellation/change request stuck
// pending forever, with nothing left pointing at it.
const ACTIONABLE_NOTIFICATION_TYPES = new Set([
  "back_date_request",
  "student_delete_request",
  "student_status_change_request",
  "student_addition_request",
  "staff_delete_request",
  "concession_change_request",
  "fee_receipt_cancellation_request",
  "income_delete_request",
  "expenditure_delete_request",
]);

// PUT /api/notifications/:id/resolve
export const resolve = asyncHandler(async (req, res) => {
  const notif = await Notification.findOne({
    _id: req.params.id,
    is_deleted: { $ne: true },
  });
  if (!notif) throw new ApiError(404, "Notification not found.");

  if (ACTIONABLE_NOTIFICATION_TYPES.has(notif.type)) {
    throw new ApiError(
      400,
      "This notification must be approved or rejected through its own review action, not marked done directly.",
    );
  }

  const isRoleOwner =
    notif.recipient_role === req.user.role &&
    String(notif.branch) === String(req.user.branch);
  const isUserOwner =
    notif.recipient_user_id &&
    String(notif.recipient_user_id) === String(req.user._id);
  if (!isRoleOwner && !isUserOwner && req.user.role !== ROLES.ADMIN_OFFICER) {
    throw new ApiError(403, "You cannot resolve this notification.");
  }

  notif.status = "Resolved";
  notif.updated_by = req.user._id;
  await notif.save();

  // When the Principal marks the actionable "reassign these classes" alert
  // done, loop back to whichever Admin Officer started the transfer so
  // they know it's safe to retry - nothing else in the system would tell
  // them the block has cleared.
  if (
    notif.type === "staff_transfer_reassignment" &&
    notif.recipient_role === ROLES.PRINCIPAL &&
    notif.initiated_by
  ) {
    const [teacher, destBranch] = await Promise.all([
      notif.related_staff_id
        ? User.findById(notif.related_staff_id).select("full_name").lean()
        : null,
      notif.destination_branch
        ? Branch.findById(notif.destination_branch).select("name").lean()
        : null,
    ]);
    const teacherName = teacher?.full_name || "The teacher";

    await Notification.create({
      recipient_role: ROLES.ADMIN_OFFICER,
      recipient_user_id: notif.initiated_by,
      branch: notif.branch,
      destination_branch: notif.destination_branch,
      related_staff_id: notif.related_staff_id,
      type: "staff_transfer_retry",
      title: `Ready to retry transferring ${teacherName}`,
      message: destBranch
        ? `${teacherName}'s classes have been reassigned - you can retry transferring them to ${destBranch.name} now.`
        : `${teacherName}'s classes have been reassigned - you can retry the transfer now.`,
      status: "Open",
      updated_by: req.user._id,
    });
  }

  res.json({ success: true, data: notif });
});
