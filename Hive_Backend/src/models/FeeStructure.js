import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";
import { CLASS_GRADES } from "./Class.js";

const feeStructureSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  academic_year: { type: String, required: true, trim: true, index: true },
  grade: {
    type: String,
    required: true,
    enum: CLASS_GRADES,
    trim: true,
    index: true,
  },
  tuition_fee: { type: Number, required: true },

  // null = "not part of the standard schedule for this branch/class" -
  // the consuming form (Admission / Student Fee Report) leaves that
  // specific bucket editable rather than locking it to 0, since the
  // source spreadsheet only fills these for a handful of branches.
  admission_fee: { type: Number, default: null },
  registration_fee: { type: Number, default: null },
  application_fee: { type: Number, default: null },

  // Set by the one-time import script when a value was estimated from
  // reference data rather than taken directly from the source sheet
  // (e.g. a missing branch, a zero/placeholder fee, or a row with more
  // than one conflicting value) - surfaced in the admin screen so a
  // human can confirm or correct it.
  needs_review: { type: Boolean, default: false },
});

withCommonFields(feeStructureSchema);

// Only enforced among non-deleted rows, same reasoning as Class: a
// soft-deleted row shouldn't block re-adding the same branch/year/grade.
feeStructureSchema.index(
  { branch: 1, academic_year: 1, grade: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);

export default mongoose.model("FeeStructure", feeStructureSchema);
