// controllers/concessionController.js
//
// Requesting, approving, and rejecting permission to re-edit ONE
// concession bucket on a StudentFeeReport that's already locked. The lock
// itself, and enforcement of it, lives in feeController.js's
// createReport/updateReport (see applyConcessionLockRules there) - this
// file only manages the request lifecycle and the Notification that tells
// the Admin Officer one is waiting. Modeled directly on
// backDateRequestController.js, the existing precedent for this shape of
// workflow in this codebase.
import mongoose from "mongoose";
import ConcessionChangeRequest from "../models/ConcessionChangeRequest.js";
import StudentFeeReport from "../models/StudentFeeReport.js";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { isAllowed } from "../rbac/permissions.js";
import { ROLES } from "../config/constants.js";
import { resolveBranchQueryFilter } from "../middleware/branchScope.js";

const ENTITY = "ConcessionChangeRequest";

const BUCKET_LABELS = {
  adm: "Admission Fee",
  term: "Term Fee",
  transport: "Transport Fee",
  hostel: "Hostel Fee",
  application: "Application Fee",
  registration: "Registration Fee",
};

// POST /api/concession-change-requests
// body: { student_fee_report_id, bucket, reason }
export const create = asyncHandler(async (req, res) => {
  if (!isAllowed(ENTITY, "create", req.user.role))
    throw new ApiError(403, "Your role is not permitted to request a concession change.");

  const { student_fee_report_id, bucket, reason } = req.body;
  if (!BUCKET_LABELS[bucket]) {
    throw new ApiError(400, `bucket must be one of: ${Object.keys(BUCKET_LABELS).join(", ")}.`);
  }
  if (!reason || !reason.trim()) {
    throw new ApiError(400, "A reason is required so the Admin Officer has something to review.");
  }

  const { allowed, filter } = resolveBranchQueryFilter(req.user);
  if (!allowed) throw new ApiError(403, "You do not have access to that branch.");
  filter._id = student_fee_report_id;

  const report = await StudentFeeReport.findOne(filter);
  if (!report) throw new ApiError(404, "Fee report not found.");

  if (!(report.concession_locked_buckets || []).includes(bucket)) {
    throw new ApiError(
      400,
      `${BUCKET_LABELS[bucket]} concession isn't locked - it's already editable.`,
    );
  }

  const existing = await ConcessionChangeRequest.findOne({
    student_fee_report_id,
    bucket,
    status: "Pending",
  }).lean();
  if (existing) {
    throw new ApiError(409, `You already have a pending change request for ${BUCKET_LABELS[bucket]}.`);
  }

  const request = await ConcessionChangeRequest.create({
    branch: report.branch,
    student_fee_report_id,
    student_id: report.student_id,
    student_name: report.student_name,
    bucket,
    reason: reason.trim(),
    status: "Pending",
    requested_by: req.user._id,
  });

  const notification = await Notification.create({
    recipient_role: ROLES.ADMIN_OFFICER,
    branch: report.branch,
    type: "concession_change_request",
    related_record_id: request._id,
    related_student_id: report.student_id,
    initiated_by: req.user._id,
    status: "Open",
    title: `Concession change requested: ${report.student_name}`,
    message: `${req.user.full_name || "An Accounts Manager"} wants to re-edit the ${BUCKET_LABELS[bucket]} concession for ${report.student_name}. Reason: ${reason.trim()}`,
  });

  return res.status(201).json({ success: true, data: { request, notification } });
});

// GET /api/concession-change-requests
// params (all optional): status ("Pending"|"Approved"|"Rejected"), branch
export const list = asyncHandler(async (req, res) => {
  if (!isAllowed(ENTITY, "read", req.user.role))
    throw new ApiError(403, "Your role is not permitted to view concession change requests.");

  const { allowed, filter } = resolveBranchQueryFilter(req.user, req.query.branch);
  if (!allowed) throw new ApiError(403, "You do not have access to that branch.");
  if (req.query.status) filter.status = req.query.status;

  const requests = await ConcessionChangeRequest.find(filter)
    .sort("-created_date")
    .lean();
  return res.json({ success: true, data: requests });
});

async function review(req, res, decision) {
  if (!isAllowed(ENTITY, "update", req.user.role))
    throw new ApiError(403, "Only an Admin Officer can approve or reject a concession change request.");

  const { allowed, filter } = resolveBranchQueryFilter(req.user);
  if (!allowed) throw new ApiError(403, "You do not have access to that branch.");
  filter._id = req.params.id;

  const request = await ConcessionChangeRequest.findOne(filter);
  if (!request) throw new ApiError(404, "Concession change request not found.");
  if (request.status !== "Pending") {
    throw new ApiError(400, `This request was already ${request.status.toLowerCase()}.`);
  }

  request.status = decision;
  request.reviewed_by = req.user._id;
  request.reviewed_at = new Date();
  await request.save();

  if (decision === "Approved") {
    // Reopens the bucket - the requester edits it themselves and it
    // re-locks on their next save (see applyConcessionLockRules in
    // feeController.js). Approving here never applies a value directly.
    await StudentFeeReport.updateOne(
      { _id: request.student_fee_report_id },
      { $pull: { concession_locked_buckets: request.bucket } },
    );
  }

  await Notification.updateMany(
    { related_record_id: request._id, type: "concession_change_request", status: "Open" },
    { $set: { status: "Resolved", updated_by: req.user._id } },
  );

  await Notification.create({
    recipient_role: ROLES.ACCOUNTS_MANAGER,
    recipient_user_id: request.requested_by,
    branch: request.branch,
    type: "concession_change_result",
    related_record_id: request._id,
    related_student_id: request.student_id,
    status: "Open",
    title:
      decision === "Approved"
        ? `Concession change approved: ${request.student_name}`
        : `Concession change rejected: ${request.student_name}`,
    message:
      decision === "Approved"
        ? `Your request to re-edit the ${BUCKET_LABELS[request.bucket]} concession for ${request.student_name} was approved - it's editable again.`
        : `Your request to re-edit the ${BUCKET_LABELS[request.bucket]} concession for ${request.student_name} was rejected.`,
  });

  return res.json({ success: true, data: request });
}

// PUT /api/concession-change-requests/:id/approve
export const approve = asyncHandler((req, res) => review(req, res, "Approved"));

// PUT /api/concession-change-requests/:id/reject
export const reject = asyncHandler((req, res) => review(req, res, "Rejected"));
