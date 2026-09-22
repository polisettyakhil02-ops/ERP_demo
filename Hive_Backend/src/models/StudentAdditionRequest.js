// models/StudentAdditionRequest.js
//
// An Accounts Manager can no longer create a Student directly - they submit
// this request (with a reason) instead, and an Admin Officer assigned to
// the request's branch must approve it before the Student record (and its
// StudentFeeReport, seeded from the class's FeeStructure) actually gets
// created (see studentController.js's approveAdditionRequestStudent).
// Modeled on ConcessionChangeRequest/BackDateRequest, the existing
// precedent for this request/approve shape - unlike the Student
// delete/status-change requests, there's no existing Student document yet
// to hang request fields off, so this is its own collection instead.
import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";
import { addressSchema } from "./_addressSchema.js";

// Everything the "Add Student" form collects, minus admission_no - that's
// always server-generated at approval time, never at request time, so a
// rejected/withdrawn/still-pending request never reserves one.
const additionPayloadSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true, trim: true },
    dob: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    blood_group: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    section: { type: String, trim: true, default: null },
    roll_no: { type: String },
    parent_name: { type: String },
    parent_phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^\d{10}$/.test(v),
        message: (props) =>
          `"${props.value}" is not a valid 10-digit phone number.`,
      },
    },
    parent_email: { type: String, lowercase: true, trim: true },
    address: { type: addressSchema, required: true },
    joining_date: { type: Date },
    is_hosteler: { type: Boolean, default: false },
  },
  { _id: false },
);

const studentAdditionRequestSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  payload: { type: additionPayloadSchema, required: true },
  reason: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Withdrawn"],
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
  rejection_reason: { type: String, default: null },
  // Set on approval - keeps a durable link from the request to what it
  // produced, even though the request document itself never turns into a
  // Student (unlike delete/status-change requests, which live on the
  // Student doc they're about).
  created_student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    default: null,
  },
});

withCommonFields(studentAdditionRequestSchema);

export default mongoose.model(
  "StudentAdditionRequest",
  studentAdditionRequestSchema,
);
