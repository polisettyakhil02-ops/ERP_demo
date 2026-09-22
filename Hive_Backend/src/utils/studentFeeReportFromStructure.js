// utils/studentFeeReportFromStructure.js
//
// Builds a single StudentFeeReport doc from a FeeStructure row - the
// non-bulk, non-tolerant counterpart to tempCreateBulkFeeReports (that one
// silently defaults every bucket to 0 when no FeeStructure exists, since
// it's a migration stop-gap; this one is only ever called once the caller
// has already confirmed a FeeStructure exists, so it never has to guess).
export function studentFeeReportFromStructure(student, feeStructure, userId) {
  if (!feeStructure) {
    throw new Error("A FeeStructure is required to build a StudentFeeReport.");
  }
  return {
    branch: student.branch,
    student_id: student._id,
    student_name: student.full_name,
    father_name: student.parent_name || "Not provided",
    mob_number: student.parent_phone || "Not provided",
    class: student.class,
    student_type: "New",
    has_term_fee: true,
    gross_term_fee: feeStructure.tuition_fee || 0,
    has_admission_fee: feeStructure.admission_fee != null,
    adm_gross_fee: feeStructure.admission_fee || 0,
    has_registration_fee: feeStructure.registration_fee != null,
    registration_gross_fee: feeStructure.registration_fee || 0,
    has_application_fee: feeStructure.application_fee != null,
    application_gross_fee: feeStructure.application_fee || 0,
    remarks: "Student addition request approved",
    created_by: userId,
    updated_by: userId,
  };
}
