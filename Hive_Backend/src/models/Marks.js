import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

// Marks — also added teacher_id + branch to match your original diagram's target shape
const marksSchema = new mongoose.Schema({
  marks_id: { type: String },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
    index: true,
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },
  teacher_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  exam_type: {
    type: String,
    enum: ["Unit Test", "Mid Term", "Final"],
    required: true,
  },
  // Was a hard enum of six names ("Maths", "Science", "English", "Hindi",
  // "Social Studies", "Computer"). Subjects are master data now - see
  // models/Subject.js - so the valid set is a collection an Accounts
  // Manager or Principal edits, not a list baked into this file. Leaving
  // the enum would have meant every newly added subject was accepted by the
  // dropdown and then rejected at save time.
  //
  // Safe to widen: the marks collection was empty when this changed, so no
  // stored value is affected, and an enum only ever rejected writes.
  // What a teacher may actually write is enforced where it belongs -
  // marksController.js checks the (class, subject) pair against
  // Class.subject_teachers - which is a real authorisation check rather
  // than a spelling list.
  subject: { type: String, required: true, trim: true },
  marks_obtained: { type: Number, required: true },
  max_marks: { type: Number, required: true },
  grade: { type: String },
});

withCommonFields(marksSchema);

export default mongoose.model("Marks", marksSchema);
