import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";
const PAYMENT_MODES = [
  "Cash",
  "Cheque",
  "Swipe machine",
  "Paytm",
  "GooglePay",
  "PhonePay",
  "OnlineTransfer",
  "Others",
];

const feePaymentSchema = new mongoose.Schema({
  payment_id: { type: String },
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
  student_name: { type: String },
  academic_year: { type: String, required: true },
  fee_type: {
    type: String,
    enum: [
      "Tuition",
      "Annual",
      "Transport",
      "Exam",
      "Other",
      "School Fee",
      "Admission Fee",
      "Previous Due",
      "Application Fee",
      "Transport Fee",
      "Term Fee",
      "Registration Fee",
      "Hostel Fee",
      "Kit Fee",
    ],
    required: true,
  },
  amount: { type: Number, required: true },
  // Only meaningful for fee_type "Kit Fee"/"Other" - which item (e.g. "Text
  // Books", "Bonafide Amount") this particular row is for, since neither
  // category has its own StudentFeeReport bucket to track per-item history
  // against (see itemPaymentTotals in feeController.js, which sums these by
  // item_name). Left blank for every other fee_type.
  item_name: { type: String },
  // Only meaningful for fee_type "Kit Fee"/"Other" - this payment's DELTA
  // contribution to the item's running Actual Fee / Concession (not the
  // item's cumulative total), used to accumulate onto StudentFeeReport's
  // kit_gross_fee/kit_concession (or other_*) in collectPayment(), and to
  // reverse those fields correctly if this payment is later cancelled (see
  // cancelReceipt). Left blank for every other fee_type, and blank for any
  // Kit/Other payment made before these fields existed - itemPaymentTotals
  // falls back to treating those as amount/0.
  item_actual_fee: { type: Number },
  item_concession_fee: { type: Number },
  payment_date: { type: Date },
  payment_mode: { type: String, enum: PAYMENT_MODES, default: "Cash" },
  voucher_type: { type: String, enum: ["MvNo", "CvNo"], default: "MvNo" },
  // MvNo: typed in by hand at collection time. CvNo: system-generated (see
  // generateVoucherNo in utils/admissionNumbering.js) - either way, this is
  // the actual voucher number, distinct from voucher_type which is just
  // which kind it is.
  voucher_no: { type: String },
  receipt_no: { type: String, index: true },
  // Cheque-specific
  cheque_date: { type: Date },
  transaction_no: { type: String },
  bank_name: { type: String },
  bank_branch: { type: String },
  status: {
    type: String,
    enum: ["Paid", "Pending", "Cancelled"],
    default: "Pending",
  },
});

withCommonFields(feePaymentSchema);

export const FEE_PAYMENT_MODES = PAYMENT_MODES;
export default mongoose.model("FeePayment", feePaymentSchema);
