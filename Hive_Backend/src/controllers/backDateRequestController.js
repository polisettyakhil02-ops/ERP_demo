// controllers/backDateRequestController.js
//
// Requesting, approving, and rejecting permission to collect a fee
// payment dated in the past. The actual enforcement of "you can't pick a
// back date without an Approved request for that exact date" lives in
// feeController.js's collectPayment() - this file only manages the
// request lifecycle itself and the Notification that tells the Principal
// one is waiting.
import BackDateRequest from "../models/BackDateRequest.js";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { isAllowed } from "../rbac/permissions.js";
import { ROLES } from "../config/constants.js";
import { todayDateString } from "../utils/dateUtils.js";

const ENTITY = "BackDateRequest";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/back-date-requests
export const create = asyncHandler(async (req, res) => {
  if (!isAllowed(ENTITY, "create", req.user.role))
    throw new ApiError(403, "Your role is not permitted to request a back date.");

  const branch = req.user.branch;
  if (!branch) throw new ApiError(400, "A branch is required.");

  const { requested_date, reason } = req.body;
  if (!requested_date || !DATE_RE.test(requested_date)) {
    throw new ApiError(400, "A valid date (YYYY-MM-DD) is required.");
  }
  if (requested_date >= todayDateString()) {
    throw new ApiError(
      400,
      "Only a date before today needs approval - today and future dates are already allowed.",
    );
  }
  if (!reason || !reason.trim()) {
    throw new ApiError(400, "A reason is required so the Principal has something to review.");
  }

  const existing = await BackDateRequest.findOne({
    requested_by: req.user._id,
    requested_date,
    status: { $in: ["Pending", "Approved"] },
  }).lean();
  if (existing) {
    throw new ApiError(
      409,
      existing.status === "Pending"
        ? "You already have a pending request for that date."
        : "You already have an approved, unused request for that date - it's ready to use.",
    );
  }

  const request = await BackDateRequest.create({
    branch,
    requested_by: req.user._id,
    requested_by_role: req.user.role,
    requested_date,
    reason: reason.trim(),
    status: "Pending",
  });

  const notification = await Notification.create({
    recipient_role: ROLES.PRINCIPAL,
    branch,
    type: "back_date_request",
    title: `Back-date request: ${requested_date}`,
    message: `${req.user.full_name || req.user.email || "A staff member"} wants to collect a fee payment dated ${requested_date}. Reason: ${reason.trim()}`,
    related_record_id: request._id,
    status: "Open",
  });

  return res.status(201).json({ success: true, data: { request, notification } });
});

// GET /api/back-date-requests/available - Approved-and-unused requests
// for the caller, so the Add Fee Payment dialog knows which specific
// date(s), if any, it can unlock the Payment Date field for.
export const listAvailable = asyncHandler(async (req, res) => {
  if (!isAllowed(ENTITY, "read", req.user.role))
    throw new ApiError(403, "Your role is not permitted to view back-date requests.");

  const requests = await BackDateRequest.find({
    requested_by: req.user._id,
    status: "Approved",
  })
    .sort("-requested_date")
    .lean();

  return res.json({ success: true, data: requests });
});

async function review(req, res, decision) {
  if (!isAllowed(ENTITY, "update", req.user.role))
    throw new ApiError(403, "Only a Principal can approve or reject a back-date request.");

  const filter = { _id: req.params.id };
  if (req.user.branch) filter.branch = req.user.branch;
  const request = await BackDateRequest.findOne(filter);
  if (!request) throw new ApiError(404, "Back-date request not found.");
  if (request.status !== "Pending") {
    throw new ApiError(400, `This request was already ${request.status.toLowerCase()}.`);
  }

  request.status = decision;
  request.reviewed_by = req.user._id;
  request.reviewed_at = new Date();
  await request.save();

  // Close out the Principal's own alert, then loop back to the requester
  // so they actually find out what happened - "Mark done" up above
  // doesn't happen automatically for them.
  await Notification.updateMany(
    { related_record_id: request._id, type: "back_date_request", status: "Open" },
    { $set: { status: "Resolved", updated_by: req.user._id } },
  );

  await Notification.create({
    recipient_role: request.requested_by_role,
    recipient_user_id: request.requested_by,
    branch: request.branch,
    type: "back_date_request_result",
    title:
      decision === "Approved"
        ? `Back-date request approved: ${request.requested_date}`
        : `Back-date request rejected: ${request.requested_date}`,
    message:
      decision === "Approved"
        ? `Your request to collect a payment dated ${request.requested_date} was approved - you can now pick that date on the Add Fee Payment form.`
        : `Your request to collect a payment dated ${request.requested_date} was rejected.`,
    related_record_id: request._id,
    status: "Open",
  });

  return res.json({ success: true, data: request });
}

// PUT /api/back-date-requests/:id/approve
export const approve = asyncHandler((req, res) => review(req, res, "Approved"));

// PUT /api/back-date-requests/:id/reject
export const reject = asyncHandler((req, res) => review(req, res, "Rejected"));
