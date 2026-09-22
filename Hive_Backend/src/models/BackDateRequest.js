// models/BackDateRequest.js
//
// Permission to collect a fee payment dated in the past, for one specific
// date - not a standing "this person can always backdate" flag. Requested
// by an Accounts Manager / Admin Officer (see controllers/
// backDateRequestController.js), approved or rejected by a Principal, and
// - once Approved - consumed exactly once by collectPayment() in
// feeController.js, which flips it to "Used" so the same grant can't be
// replayed for a second payment.
import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const backDateRequestSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Captured at creation time (from req.user.role) so the "approved/
  // rejected" notification back to the requester (see
  // backDateRequestController.js `review`) doesn't need a second User
  // lookup just to fill in Notification's required recipient_role field.
  requested_by_role: { type: String, required: true },
  // Date-only "YYYY-MM-DD" string, matching how payment_date already
  // travels through the Add Fee Payment form (a plain <input type="date">
  // value) - kept as the same shape end-to-end instead of converting to a
  // Date and back, which is where off-by-one-day timezone bugs creep in.
  requested_date: { type: String, required: true, index: true },
  reason: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Used"],
    default: "Pending",
    index: true,
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  reviewed_at: { type: Date, default: null },
  used_at: { type: Date, default: null },
});

withCommonFields(backDateRequestSchema);

// One request per person per date at a time - lets create() cheaply check
// "do they already have a live ask for this exact date" before creating a
// duplicate that would just spam the Principal a second time.
backDateRequestSchema.index({ requested_by: 1, requested_date: 1, status: 1 });

export default mongoose.model("BackDateRequest", backDateRequestSchema);
