// models/FeeReceiptCancellationRequest.js
//
// Permission to cancel a fee receipt (a receipt_no, which may bundle
// several FeePayment rows paid together - e.g. Admission Fee + Term Fee in
// one transaction; cancellation always covers the whole receipt, never a
// single row within it, matching feeController.js's existing cancelReceipt).
// Requested by an Accounts Manager, approved/rejected only by an Admin
// Officer assigned to the receipt's branch. Modeled directly on
// ConcessionChangeRequest/BackDateRequest, the existing precedent for this
// shape of workflow in this codebase - a receipt spans multiple FeePayment
// rows, so this lives as its own record rather than flags bolted onto
// FeePayment itself.
import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const feeReceiptCancellationRequestSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  receipt_no: { type: String, required: true, trim: true, index: true },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
    index: true,
  },
  // Denormalized off the payments at creation time - lets the Admin
  // Officer's review list and the Notification show the student/amount
  // without a second lookup per row.
  student_name: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
    index: true,
  },
  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  reviewed_at: { type: Date, default: null },
});

withCommonFields(feeReceiptCancellationRequestSchema);

// One live (Pending) request per receipt at a time - lets create() cheaply
// reject a duplicate ask for a receipt that's already awaiting review.
feeReceiptCancellationRequestSchema.index({ receipt_no: 1, status: 1 });

export default mongoose.model(
  "FeeReceiptCancellationRequest",
  feeReceiptCancellationRequestSchema,
);
