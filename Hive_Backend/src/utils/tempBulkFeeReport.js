// ===================================================================
// TEMP — BULK-UPLOAD FEE REPORT GENERATION
//
// While we're bulk-uploading historical student records, every student
// created via bulkCreateStudents (studentController.js) also needs a
// StudentFeeReport so the gross TERM fee shows up immediately, pulled from
// the matching FeeStructure row (looked up via the student's Class ->
// branch/grade/academic_year).
// `old_fee` comes from the "Previous Due Pending" column on the bulk
// upload sheet itself (see studentController.js for how it's threaded
// through, since it's not a field on the Student schema).
//
// The term fee is the ONLY fee taken from the FeeStructure here. Admission,
// Registration and Application are one-time entry fees that a continuing
// student does not owe, and every row this creates is student_type
// "Existing" - see the note on those three flags below for what went wrong
// when they were copied across too.
//
// This is a stop-gap for the migration period only. Once the historical
// bulk upload is complete:
//   1. Delete this file.
//   2. Remove the two call sites of tempCreateBulkFeeReports() in
//      bulkCreateStudents (studentController.js).
//   3. Records this created can be found/removed via:
//      StudentFeeReport.deleteMany({ remarks: TEMP_FEE_REPORT_MARKER })
// ===================================================================
import Class from "../models/Class.js";
import FeeStructure from "../models/FeeStructure.js";
import StudentFeeReport from "../models/StudentFeeReport.js";

export const TEMP_FEE_REPORT_MARKER = "TEMP-BULK-UPLOAD";

const structureKey = (branch, academicYear, grade) =>
  `${branch}|${academicYear}|${grade}`;

export async function tempCreateBulkFeeReports(
  createdStudents,
  userId,
  oldFeeByAdmissionNo = new Map(),
) {
  if (!createdStudents || createdStudents.length === 0) {
    return { created: 0, errors: [] };
  }

  const classIds = [...new Set(createdStudents.map((s) => String(s.class)))];
  const classes = await Class.find({ _id: { $in: classIds } })
    .select("grade academic_year branch")
    .lean();
  const classById = new Map(classes.map((c) => [String(c._id), c]));
  if (classById.size === 0) return { created: 0, errors: [] };

  const branches = [...new Set(classes.map((c) => String(c.branch)))];
  const years = [...new Set(classes.map((c) => c.academic_year))];
  const grades = [...new Set(classes.map((c) => c.grade))];

  const structures = await FeeStructure.find({
    branch: { $in: branches },
    academic_year: { $in: years },
    grade: { $in: grades },
    is_deleted: { $ne: true },
  }).lean();
  const structureByKey = new Map(
    structures.map((fs) => [
      structureKey(fs.branch, fs.academic_year, fs.grade),
      fs,
    ]),
  );

  const docs = createdStudents
    .map((student) => {
      const cls = classById.get(String(student.class));
      if (!cls) return null;
      const fs = structureByKey.get(
        structureKey(cls.branch, cls.academic_year, cls.grade),
      );
      return {
        branch: student.branch,
        student_id: student._id,
        student_name: student.full_name,
        father_name: student.parent_name || "Not provided",
        mob_number: student.parent_phone || "Not provided",
        class: student.class,
        student_type: "Existing",
        old_fee: oldFeeByAdmissionNo.get(student.admission_no) || 0,
        has_term_fee: true,
        gross_term_fee: fs?.tuition_fee || 0,

        // Admission / Registration / Application are ONE-TIME entry fees,
        // charged when a student first joins the school. Every row this
        // helper creates is student_type "Existing" - a continuing student,
        // already admitted in an earlier year - so none of them owe any of
        // the three, no matter what the branch's FeeStructure lists for a
        // fresh admission.
        //
        // These used to be copied off the FeeStructure like the term fee
        // above, which billed every bulk-uploaded student for an admission
        // they had already paid for (or never made). Across the historical
        // upload that came to roughly Rs.4.3 crore of dues that were never
        // owed, and it inflated every pending-dues figure in the app.
        //
        // has_admission_fee is written explicitly rather than left out:
        // unlike the other two it DEFAULTS TO TRUE on the schema (see
        // models/StudentFeeReport.js), so an omitted key would switch the
        // bucket back on - with a zero amount here, but visible as a live
        // fee row on every report. The other two default to false and are
        // set for symmetry, so all three read the same way.
        has_admission_fee: false,
        has_registration_fee: false,
        has_application_fee: false,

        // A genuinely new admission still gets all three - that path is
        // studentFeeReportFromStructure.js (student_type "New"), which is
        // deliberately left alone.
        remarks: TEMP_FEE_REPORT_MARKER,
        created_by: userId,
        updated_by: userId,
      };
    })
    .filter(Boolean);

  if (docs.length === 0) return { created: 0, errors: [] };

  try {
    const created = await StudentFeeReport.insertMany(docs, {
      ordered: false,
    });
    return { created: created.length, errors: [] };
  } catch (err) {
    const inserted = err.insertedDocs || err.results?.insertedDocs || [];
    const writeErrors =
      err.writeErrors || err.result?.result?.writeErrors || [];
    if (inserted.length === 0 && writeErrors.length === 0) throw err;
    return {
      created: inserted.length,
      errors: writeErrors.map((e) => ({
        index: e.index,
        message: e.errmsg || e.err?.errmsg || "Validation failed.",
      })),
    };
  }
}
