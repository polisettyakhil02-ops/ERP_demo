import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const ticketSchema = new mongoose.Schema({
  type: { type: String, enum: ["bug", "feature", "improvement"], required: true },
  page: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  reporter_name: { type: String, required: true, trim: true },
  reporter_email: { type: String, required: true, trim: true, lowercase: true },
  reporter_role: { type: String, required: true },
  status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open" },
});

withCommonFields(ticketSchema);

export default mongoose.model("Ticket", ticketSchema);
