// Generate schema from the above JSON data
import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    fatherName: { type: String, required: true },
    className: { type: String, required: true },
    academicYear: { type: String, required: true },
    mobileNo: { type: String, required: true },
    applicationNo: { type: String, required: true },
    commAddressLine1: { type: String, required: true },
    commLandmark: { type: String, required: true },
    commCity: { type: String, required: true },
    commDistrict: { type: String, required: true },
    commState: { type: String, required: true },
    permenantAddressLine1: { type: String, required: true },
    permenantLandmark: { type: String, required: true },
    permenantCity: { type: String, required: true },
    permenantDistrict: { type: String, required: true },
    permenantState: { type: String, required: true },
    // Payment Details - optional. A PRO/staff member filling out a sale of
    // application often doesn't have MV/CV or bank details in hand yet.
    proName: { type: String },
    selectMV: { type: String },
    mvNo: { type: String },
    bank: { type: String },
    previousSchool: { type: String },
    isPermanentSameAsCommunication: {
      type: Boolean,
      required: true,
      default: false,
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    isAdmitted: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

const Application = mongoose.model("Application", applicationSchema);

export default Application;
