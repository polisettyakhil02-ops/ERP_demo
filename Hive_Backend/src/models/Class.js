import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

// Display order, youngest first. PP1/PP2 are the pre-primary years under
// the naming some branches use instead of LKG/UKG; a school uses one
// naming or the other, so both sets live here and neither is aliased to
// the other.
const GRADES = [
  "PRE-NURSERY",
  "NURSERY",
  "PP1",
  "PP2",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

// grade_order is STORED on every Class document (see the pre-validate hook
// below), and it used to be GRADES.indexOf(grade). That made the array's
// positions load-bearing: inserting PRE-NURSERY/PP1/PP2 at the front would
// have shifted every index, silently invalidating the number already saved
// on every class in production - breaking the grade_order sorts in
// classController/feeController and the "can only promote to a higher
// class" check in studentController, with no error to signal it.
//
// So the order is pinned explicitly instead of derived from position.
// Every grade that existed before keeps the exact integer it was first
// saved with (NURSERY 0 ... "10" 12 - the original list has not changed
// since the initial commit, so those are the values in the database), and
// the three new grades take the gaps around them. That makes this change
// a pure schema addition: no existing document is wrong, and nothing needs
// backfilling. Re-saving an old class recomputes the same value it already
// had.
//
// Adding another grade later: give it a number that places it correctly
// relative to its neighbours WITHOUT renumbering anything already here.
// There is deliberately room between every pair.
const GRADE_ORDER = {
  "PRE-NURSERY": -1,
  NURSERY: 0,
  PP1: 0.3,
  PP2: 0.6,
  LKG: 1,
  UKG: 2,
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 7,
  6: 8,
  7: 9,
  8: 10,
  9: 11,
  10: 12,
};

const classSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      required: true,
      enum: GRADES,
      trim: true,
      index: true,
    },
    grade_order: { type: Number, required: true },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    academic_year: { type: String, required: true, trim: true, index: true },
    class_teacher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    capacity: { type: Number, default: null },

    // Replaces User.subject_assignments as the single source of truth for
    // "who teaches what in this class" — this is where that fact belongs,
    // and it turns "which classes does this teacher have" into a plain
    // query against Class instead of a reverse scan across every User.
    subject_teachers: {
      type: [
        {
          _id: false,
          teacher_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          subject: { type: String, required: true, trim: true },
        },
      ],
      default: [],
    },
    section: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

withCommonFields(classSchema);

classSchema.pre("validate", function (next) {
  // ?? rather than || - PRE-NURSERY's order is -1 and NURSERY's is 0, and
  // both are falsy. The enum on `grade` is what rejects an unknown grade;
  // -1 here would silently sort it to the front instead.
  this.grade_order = GRADE_ORDER[this.grade] ?? null;
  next();
});

// Only enforced among non-deleted classes - otherwise a soft-deleted class
// permanently blocks re-adding the same grade/year/branch combination,
// since deleteClass() never clears these fields, just flips is_deleted.
classSchema.index(
  { branch: 1, academic_year: 1, grade: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);

classSchema.index(
  { academic_year: 1, class_teacher_id: 1 },
  {
    unique: true,
    partialFilterExpression: { class_teacher_id: { $type: "objectId" } },
  },
);

// Guard-rail: every teacher referenced here — the homeroom class_teacher_id
// or any subject_teachers entry — must belong to this class's own branch.
classSchema.pre("save", async function (next) {
  const touchedTeacher = this.isModified("class_teacher_id");
  const touchedSubjects = this.isModified("subject_teachers");
  if (!touchedTeacher && !touchedSubjects) return next();

  const ids = new Set();
  if (touchedTeacher && this.class_teacher_id)
    ids.add(String(this.class_teacher_id));
  if (touchedSubjects)
    this.subject_teachers.forEach((row) => ids.add(String(row.teacher_id)));
  if (ids.size === 0) return next();

  const count = await mongoose
    .model("User")
    .countDocuments({ _id: { $in: [...ids] }, branch: this.branch });
  if (count !== ids.size) {
    return next(
      new Error("All assigned teachers must belong to this class's branch."),
    );
  }
  next();
});

export const CLASS_GRADES = GRADES;
export const CLASS_GRADE_ORDER = GRADE_ORDER;
export default mongoose.model("Class", classSchema);
