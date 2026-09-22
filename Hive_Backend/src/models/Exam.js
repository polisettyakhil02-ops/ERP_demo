import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const examSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  // The Subject model now exists (models/Subject.js), but this stays a
  // plain name string: that catalog drives the dropdowns, it is not a
  // foreign key. Same relationship Student.transport_route has with
  // BusRoute.
  subject: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  total_marks: { type: Number },
  passing_marks: { type: Number },
  exam_type: {
    type: String,
    enum: ["Unit Test", "Mid Term", "Annual", "Other"],
  },
});

withCommonFields(examSchema);

export default mongoose.model("Exam", examSchema);
