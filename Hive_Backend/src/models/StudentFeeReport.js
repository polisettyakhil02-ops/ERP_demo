import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const studentFeeReportSchema = new mongoose.Schema({
  sno: { type: Number },
  // FIX: this field was missing entirely. Every controller function
  // (listReports/createReport/updateReport/removeReport) filters or sets
  // `branch` from req.user.branch, but since Mongoose is strict by default,
  // that key was being silently stripped on save and every branch filter
  // was matching against a field that didn't exist on any document -
  // accounts managers would see zero records. Matches the pattern used on
  // every other transactional model (Student, Attendance, Marks, etc).
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
    index: true,
  },
  student_name: { type: String, required: true },
  father_name: { type: String, required: true },
  mob_number: { type: String, required: true },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },
  student_type: { type: String, enum: ["Existing", "New"], required: true },
  old_fee: { type: Number },

  // Each fee bucket is opt-in per student via its has_*_fee flag - Admission
  // and Term default true since every report historically always carried
  // both; Transport/Application/Registration are net-new and default false
  // (see listReports in feeController.js for how pre-existing documents
  // that predate these flags are backfilled on read).
  has_admission_fee: { type: Boolean, default: true },
  adm_gross_fee: { type: Number, default: 0 },
  adm_concession: { type: Number, default: 0 },
  net_adm_fee: { type: Number },
  paid_adm_fee: { type: Number, default: 0 },
  balance_adm_fee: { type: Number },

  has_term_fee: { type: Boolean, default: true },
  gross_term_fee: { type: Number, default: 0 },
  term_concession: { type: Number, default: 0 },
  net_term_fee: { type: Number },
  paid_term_fee: { type: Number, default: 0 },
  balance_term_fee: { type: Number },

  has_transport_fee: { type: Boolean, default: false },
  transport_gross_fee: { type: Number, default: 0 },
  transport_concession: { type: Number, default: 0 },
  net_transport_fee: { type: Number },
  paid_transport_fee: { type: Number, default: 0 },
  balance_transport_fee: { type: Number },

  has_hostel_fee: { type: Boolean, default: false },
  hostel_gross_fee: { type: Number, default: 0 },
  hostel_concession: { type: Number, default: 0 },
  net_hostel_fee: { type: Number },
  paid_hostel_fee: { type: Number, default: 0 },
  balance_hostel_fee: { type: Number },

  has_application_fee: { type: Boolean, default: false },
  application_gross_fee: { type: Number, default: 0 },
  application_concession: { type: Number, default: 0 },
  net_application_fee: { type: Number },
  paid_application_fee: { type: Number, default: 0 },
  balance_application_fee: { type: Number },

  has_registration_fee: { type: Boolean, default: false },
  registration_gross_fee: { type: Number, default: 0 },
  registration_concession: { type: Number, default: 0 },
  net_registration_fee: { type: Number },
  paid_registration_fee: { type: Number, default: 0 },
  balance_registration_fee: { type: Number },

  // Kit Fee / Other Fee are net-new, and unlike the buckets above they have
  // no fixed target - collectPayment accumulates gross/concession/paid onto
  // these as a running ledger from each itemized Kit Amount/Other Income
  // payment (see itemPaymentTotals + the kit_fee/other_income branches in
  // feeController.js), rather than these being set once upfront.
  has_kit_fee: { type: Boolean, default: false },
  kit_gross_fee: { type: Number, default: 0 },
  kit_concession: { type: Number, default: 0 },
  net_kit_fee: { type: Number },
  paid_kit_fee: { type: Number, default: 0 },
  balance_kit_fee: { type: Number },

  has_other_fee: { type: Boolean, default: false },
  other_gross_fee: { type: Number, default: 0 },
  other_concession: { type: Number, default: 0 },
  net_other_fee: { type: Number },
  paid_other_fee: { type: Number, default: 0 },
  balance_other_fee: { type: Number },

  remarks: { type: String, maxlength: 100 },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },

  // Concession lock, per fixed bucket - once an Accounts Manager saves a
  // concession value for one of these 6 buckets, its key gets added here
  // and that bucket's concession becomes read-only for them (Admin Officer
  // is never blocked by this - see updateReport/createReport in
  // feeController.js). Kit/Other Fee deliberately have no lock: their
  // concession is a running ledger built up by collectPayment(), not a
  // set-once value, so locking them would break ordinary payment
  // collection. A locked bucket only reopens via the
  // ConcessionChangeRequest approve flow (see concessionController.js),
  // which removes its key from this array.
  concession_locked_buckets: {
    type: [String],
    enum: [
      "adm",
      "term",
      "transport",
      "hostel",
      "application",
      "registration",
    ],
    default: [],
  },
});

// Auto-derive the fields that are always computable from the others,
// so the frontend doesn't have to (and can't get them out of sync).
studentFeeReportSchema.pre("validate", function (next) {
  this.net_adm_fee = (this.adm_gross_fee || 0) - (this.adm_concession || 0);
  this.balance_adm_fee = this.net_adm_fee - (this.paid_adm_fee || 0);
  this.net_term_fee = (this.gross_term_fee || 0) - (this.term_concession || 0);
  this.balance_term_fee = this.net_term_fee - (this.paid_term_fee || 0);
  this.net_transport_fee =
    (this.transport_gross_fee || 0) - (this.transport_concession || 0);
  this.balance_transport_fee =
    this.net_transport_fee - (this.paid_transport_fee || 0);
  this.net_hostel_fee =
    (this.hostel_gross_fee || 0) - (this.hostel_concession || 0);
  this.balance_hostel_fee =
    this.net_hostel_fee - (this.paid_hostel_fee || 0);
  this.net_application_fee =
    (this.application_gross_fee || 0) - (this.application_concession || 0);
  this.balance_application_fee =
    this.net_application_fee - (this.paid_application_fee || 0);
  this.net_registration_fee =
    (this.registration_gross_fee || 0) - (this.registration_concession || 0);
  this.balance_registration_fee =
    this.net_registration_fee - (this.paid_registration_fee || 0);
  this.net_kit_fee = (this.kit_gross_fee || 0) - (this.kit_concession || 0);
  this.balance_kit_fee = this.net_kit_fee - (this.paid_kit_fee || 0);
  this.net_other_fee = (this.other_gross_fee || 0) - (this.other_concession || 0);
  this.balance_other_fee = this.net_other_fee - (this.paid_other_fee || 0);
  next();
});

withCommonFields(studentFeeReportSchema);

// Supports listPendingFees' { status: "Active" } match + { student_name: 1,
// _id: 1 } sort as a single indexed scan - without this, a multi-branch
// Admin Officer's { branch: { $in: [...] } } filter can match enough
// documents that the in-memory $sort blows MongoDB's 32MB buffer
// ("Sort exceeded memory limit"), and allowDiskUse isn't available on
// shared/free-tier Atlas clusters to fall back on.
studentFeeReportSchema.index({ status: 1, student_name: 1, _id: 1 });

export default mongoose.model("StudentFeeReport", studentFeeReportSchema);
