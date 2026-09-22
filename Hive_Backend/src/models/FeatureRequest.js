import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

export const FEATURE_REQUEST_STATUSES = [
  "Submitted",
  "Under Review",
  "Planned",
  "In Progress",
  "Done",
  "Declined",
];

export const FEATURE_REQUEST_PRIORITIES = ["Low", "Medium", "High"];

// A feature idea a staff member worked out with the AI assistant (see
// utils/featureChat.js) and then submitted for the development team.
// Nothing here changes the app itself - a Super Admin reviews each request
// and moves it through FEATURE_REQUEST_STATUSES.
const featureRequestSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  summary: { type: String, required: true, trim: true, maxlength: 2000 },
  problem: { type: String, trim: true, maxlength: 4000, default: "" },
  proposed_solution: { type: String, trim: true, maxlength: 6000, default: "" },
  user_stories: { type: [String], default: [] },
  acceptance_criteria: { type: [String], default: [] },
  affected_roles: { type: [String], default: [] },
  affected_modules: { type: [String], default: [] },
  priority: {
    type: String,
    enum: FEATURE_REQUEST_PRIORITIES,
    default: "Medium",
  },
  status: {
    type: String,
    enum: FEATURE_REQUEST_STATUSES,
    default: "Submitted",
    index: true,
  },

  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  requester_name: { type: String, trim: true },
  requester_role: { type: String, trim: true },
  // null for multi-branch requesters (Admin Officer / Super Admin).
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
    index: true,
  },

  // The chat that produced this request, kept so a reviewer can see what
  // the requester actually asked for in their own words.
  conversation: {
    type: [
      {
        _id: false,
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true, maxlength: 8000 },
      },
    ],
    default: [],
  },

  admin_notes: { type: String, trim: true, maxlength: 4000, default: "" },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  reviewed_at: { type: Date, default: null },
});

withCommonFields(featureRequestSchema);

export default mongoose.model("FeatureRequest", featureRequestSchema);
