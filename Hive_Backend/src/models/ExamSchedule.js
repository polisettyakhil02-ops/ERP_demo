import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const subjectScheduleSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    // 24h "HH:mm" (e.g. "09:00") - a comparable, sortable format is what
    // makes the no-overlap check in examScheduleController possible; the
    // free-text "09:00 AM" this replaced couldn't be compared at all.
    start_time: { type: String, required: true, trim: true },
    duration_minutes: { type: Number, required: true, default: 180 },
    max_marks: { type: Number, default: 100 },
  },
  { _id: false },
);

const examScheduleSchema = new mongoose.Schema({
  exam_name: { type: String, required: true },
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
  section: { type: String },
  academic_year: { type: String, required: true },
  exam_type: { type: String, enum: ["Unit Test", "Mid Term", "Final", "Annual"], required: true },
  center: { type: String },
  invigilator: { type: String },
  subjects: { type: [subjectScheduleSchema], default: [] },
});

withCommonFields(examScheduleSchema);

examScheduleSchema.index({ branch: 1, class: 1, academic_year: 1 });

export default mongoose.model("ExamSchedule", examScheduleSchema);
