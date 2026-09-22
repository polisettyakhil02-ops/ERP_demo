import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";
import { addressSchema } from "./_addressSchema.js";

export const STUDENT_STATUSES = [
  "Active",
  "Inactive",
  "Graduated",
  "Transferred Out",
  "Dropped Out",
  "On Leave",
  "Alumni",
];

const studentSchema = new mongoose.Schema({
  admission_no: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
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
    index: true,
  },
  section: { type: String, trim: true, default: null, required: false },
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
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  address: { type: addressSchema, default: null },
  joining_date: { type: Date },
  status: {
    type: String,
    enum: STUDENT_STATUSES,
    default: "Active",
  },
  photo_url: { type: String },
  is_hosteler: { type: Boolean, default: false },
  // Free-text route name/number (e.g. "North Route") - there's no route
  // master-data (capacity/driver/fare) in this schema, so this is just a
  // label attached to the student, set/changed via the Transfers page
  // (transferController.js). Blank means the student isn't on transport;
  // kept in sync with StudentFeeReport.has_transport_fee by that
  // controller, not enforced at the schema level.
  transport_route: { type: String, default: "", trim: true },
  schoolName: {
    type: String,
    required: true,
  },

  // Deletion-approval workflow: an Accounts Manager can only request a
  // student be deleted - the Principal must approve or reject it before
  // is_deleted actually flips (see studentController.js
  // requestDeleteStudent/approveDeleteRequestStudent/rejectDeleteRequestStudent).
  delete_requested: { type: Boolean, default: false },
  delete_requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  delete_requested_at: { type: Date, default: null },
  // "dropout" bypasses the outstanding-fee-balance guard on both the
  // request and the Admin Officer's approval (see requestDeleteStudent /
  // approveDeleteRequestStudent) - the remaining balance is written off via
  // waiveStudentOutstandingBalance at approval time instead of being
  // collected. "other"/null keeps the existing hard block.
  delete_requested_reason: {
    type: String,
    enum: ["dropout", "other"],
    default: null,
  },

  // Status-change-approval workflow: an Accounts Manager can only request a
  // student's status be changed - the Principal must approve or reject it
  // before `status` actually flips (see studentController.js
  // requestStatusChangeStudent/approveStatusChangeRequestStudent/
  // rejectStatusChangeRequestStudent).
  status_change_requested: { type: Boolean, default: false },
  status_change_requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  status_change_requested_at: { type: Date, default: null },
  status_change_to: {
    type: String,
    enum: STUDENT_STATUSES,
    default: null,
  },
});

withCommonFields(studentSchema);
studentSchema.index({ branch: 1, class: 1 });

// Backs the Add Fee Payment dialog's student search (see
// controllers/feeController.js listEligibleStudents) - a case-insensitive
// "starts with" match on full_name, scoped to a branch+class already
// picked. The collation (not a second lowercased field) is what lets a
// plain `^prefix` regex actually use this index instead of a full
// collection scan: MongoDB only takes the fast path on a case-insensitive
// anchored regex when the index's collation matches the query's, so the
// query side (listEligibleStudents) must request this exact same
// { locale: "en", strength: 2 } collation for it to apply.
studentSchema.index(
  { branch: 1, class: 1, full_name: 1 },
  { collation: { locale: "en", strength: 2 } },
);

// Guard-rail: a student's class must belong to the student's own branch.
studentSchema.pre("save", async function (next) {
  if (!this.isModified("class")) return next();
  const cls = await mongoose
    .model("Class")
    .findById(this.class)
    .select("branch")
    .lean();
  if (!cls) return next(new Error("Assigned class does not exist."));
  if (String(cls.branch) !== String(this.branch)) {
    return next(
      new Error("Student's class must belong to the student's own branch."),
    );
  }
  next();
});

export default mongoose.model("Student", studentSchema);
