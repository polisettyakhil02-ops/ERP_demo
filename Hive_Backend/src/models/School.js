// models/School.js
import mongoose from "mongoose";

// Source of truth for "what schools exist" - Branch.schoolName stays free
// text (see utils/schoolName.js) rather than an ObjectId ref here, so this
// collection only drives the admin UI (the school picker on Add Branch) and
// branding lookups (logo/favicon), without a data migration on Branch.
const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    logoUrl: { type: String, required: true },
    faviconUrl: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_date", updatedAt: "updated_date" } },
);

export default mongoose.model("School", schoolSchema);
