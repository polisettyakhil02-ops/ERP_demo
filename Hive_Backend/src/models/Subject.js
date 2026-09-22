// models/Subject.js
//
// Master data for the subjects taught across the school, replacing the six
// hard-coded lists the frontend used to carry (lib/constants.js SUBJECTS,
// plus a page-local copy in BPMarks/BPReportCard/BPAttendance/
// HomeworkManager/HallTicket). Those lists had drifted apart - "Mathematics"
// in the staff forms vs "Maths" in the marks grid - which is how the same
// subject ended up stored under two different names.
//
// SHAPE: one global catalog, enabled per branch.
//
// A Subject exists once for the whole school; `branches` lists the branches
// that have actually adopted it. Every subject dropdown in the app asks for
// "subjects enabled for my branch", so adding a row to the catalog does NOT
// by itself make it selectable anywhere - it has to be added to the branch
// first (see toggleSubjectBranch in the controller).
//
// This is deliberately NOT the per-branch shape BusRoute/FeeStructure use.
// Those are branch-owned records where the same name legitimately means
// different things per branch (a route, a fee amount). A subject is the
// same subject everywhere, and duplicating it per branch is exactly what
// let the names drift in the first place.
//
// The cost of a shared catalog is that Principal and Accounts Manager - the
// two roles that manage it - are single-branch, so a rename or delete here
// can reach branches they don't own. subjectController.js guards that: they
// can only edit or delete a subject that no OTHER branch has enabled.
//
// NOTE: records that use a subject (Marks.subject, Attendance.subject,
// Homework.subject, Class.subject_teachers[].subject, User.subject_taught)
// still store the subject NAME as a plain string, not a reference to this
// model. This collection supplies the dropdown; it is not a foreign key.
// Same relationship Student.transport_route already has with BusRoute.
// That is what keeps this change from having to migrate the 615 classes and
// 125 users that already carry subject names.
import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Optional short code (e.g. "MATH"), for report cards and hall tickets
  // that need a narrow column. Not unique - it is a label, not a key.
  code: { type: String, trim: true, uppercase: true, default: "" },
  // Branches that have adopted this subject. Empty means the subject is in
  // the catalog but not offered anywhere yet, so no dropdown will show it.
  branches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
  ],
  // Retire a subject without deleting it - keeps it off every dropdown
  // while leaving historical marks/attendance rows readable. Distinct from
  // is_deleted, which removes it from the management page too.
  is_active: { type: Boolean, default: true },
});

withCommonFields(subjectSchema);

// One row per subject name, case-insensitively: "english" must not be able
// to join "English" in the catalog, which is precisely the drift already
// visible in Class.subject_teachers today.
//
// strength: 2 is what makes the comparison case-insensitive (and
// accent-insensitive), so the index itself rejects the duplicate rather
// than relying on the controller remembering to lower-case before it
// checks. Partial on is_deleted so a deleted subject's name can be reused,
// matching Class/BusRoute/FeeStructure.
subjectSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { is_deleted: false },
  },
);

export default mongoose.model("Subject", subjectSchema);
