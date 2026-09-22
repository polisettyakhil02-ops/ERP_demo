import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";
import { ALL_ROLES } from "../config/constants.js";

const notificationSchema = new mongoose.Schema({
  // Role+branch addressing (e.g. "every accounts_manager at branch X") -
  // still required so every notification has a coherent branch context,
  // even ones that are really addressed to a specific person below.
  recipient_role: { type: String, enum: ALL_ROLES, required: true, index: true },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  // Optional single-person addressing, for alerts that need to reach one
  // specific user rather than "whoever holds this role at this branch" -
  // e.g. looping back to the exact Admin Officer who started a transfer,
  // who as a multi-branch role has no single `branch` to match on.
  // When set, list() matches this instead of/in addition to recipient_role+branch.
  recipient_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  // e.g. "staff_transfer_reassignment" - a free-text type tag rather than an
  // enum, so new alert types can be added without a schema migration.
  type: { type: String, required: true, trim: true, index: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  related_staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  // Same idea as related_staff_id, but for alerts about a Student record
  // (e.g. "student_delete_request") rather than a staff User doc.
  related_student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    default: null,
    index: true,
  },
  // Who should be told once this alert is resolved (e.g. the Admin Officer
  // who should retry a blocked transfer once its class-duty alert clears).
  initiated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  destination_branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
  },
  // Generic pointer to whatever domain record this alert is actually
  // about (e.g. a BackDateRequest._id for a "back_date_request" alert) -
  // deliberately untyped/unref'd rather than adding a new dedicated field
  // per feature, since `type` already tells the frontend/backend how to
  // interpret it. Lets an actionable notification (Approve/Reject, not
  // just "Mark done") act on the right record without a second lookup.
  related_record_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  status: { type: String, enum: ["Open", "Resolved"], default: "Open", index: true },
});

withCommonFields(notificationSchema);

notificationSchema.index({ recipient_role: 1, branch: 1, status: 1 });
notificationSchema.index(
  { recipient_user_id: 1, status: 1 },
  { partialFilterExpression: { recipient_user_id: { $type: "objectId" } } },
);

// Backs the "one active alert per teacher per type per recipient" upsert
// dedupe in userController.transferTeachers - retrying a blocked transfer
// refreshes each recipient's existing Open notification instead of
// spamming duplicates (Principal and Accounts Manager each get their own
// notification document for the same teacher/type).
notificationSchema.index(
  { related_staff_id: 1, type: 1, recipient_role: 1, status: 1 },
  { partialFilterExpression: { related_staff_id: { $type: "objectId" } } },
);

export default mongoose.model("Notification", notificationSchema);
