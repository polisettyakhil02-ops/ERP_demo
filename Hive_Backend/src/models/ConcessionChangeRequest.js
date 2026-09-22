// models/ConcessionChangeRequest.js
//
// Permission to re-edit ONE concession bucket on a StudentFeeReport that's
// already locked (see StudentFeeReport.concession_locked_buckets). An
// Accounts Manager enters a concession once, it locks; if it needs
// correcting, they submit a reason here rather than the exact new value -
// approving just reopens that bucket for them to fix it themselves (see
// concessionController.js), it doesn't apply a value on their behalf.
// Modeled directly on BackDateRequest, the existing precedent for this
// shape of request/approve workflow in this codebase.
import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const concessionChangeRequestSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  student_fee_report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StudentFeeReport",
    required: true,
    index: true,
  },
  // Denormalized off the report at creation time - lets the Admin
  // Officer's monitor screen and the Notification list the student by
  // name without a second lookup per row.
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
    index: true,
  },
  student_name: { type: String, required: true },
  bucket: {
    type: String,
    required: true,
    enum: ["adm", "term", "transport", "hostel", "application", "registration"],
  },
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

withCommonFields(concessionChangeRequestSchema);

// One live (Pending) request per bucket at a time - lets create() cheaply
// reject a duplicate ask for the same already-pending bucket instead of
// spamming the Admin Officer with two alerts for the same thing.
concessionChangeRequestSchema.index({
  student_fee_report_id: 1,
  bucket: 1,
  status: 1,
});

export default mongoose.model(
  "ConcessionChangeRequest",
  concessionChangeRequestSchema,
);
