import StudentFeeReport from "../models/StudentFeeReport.js";

// Superset of feeController.js's PENDING_BUCKETS: that list drives the
// Pending Fees screen and deliberately excludes Kit/Other Fee (they're a
// running ledger, not a fixed target - see StudentFeeReport.js), but unpaid
// Kit/Other balance is still real money owed, so the delete-guard checks it
// too. Math.max(...,0) floors each field so a credit/overpayment on one
// bucket or report can't net against real debt elsewhere.
const BALANCE_FIELDS = [
  "old_fee",
  "balance_adm_fee",
  "balance_term_fee",
  "balance_transport_fee",
  "balance_hostel_fee",
  "balance_application_fee",
  "balance_registration_fee",
  "balance_kit_fee",
  "balance_other_fee",
];

export async function getStudentOutstandingBalance(studentId) {
  const reports = await StudentFeeReport.find({
    student_id: studentId,
    status: "Active",
    is_deleted: { $ne: true },
  }).lean();

  return reports.reduce(
    (total, r) =>
      total + BALANCE_FIELDS.reduce((sum, f) => sum + Math.max(r[f] || 0, 0), 0),
    0,
  );
}

// balance_x is derived as net_x - paid_x (and net_x = gross_x - concession_x)
// in StudentFeeReport's pre('validate') hook, so it can't be set directly.
// To write off a bucket's balance without touching what was actually paid,
// bump its concession by the outstanding amount instead - net drops to meet
// paid, balance recomputes to 0, and the write-off stays visible in the
// concession figure rather than silently vanishing. Used only for a
// dropout-reason deletion request, once an Admin Officer approves it (see
// approveDeleteRequestStudent) - never at request time, so a
// rejected/withdrawn request never touches fee data.
const CONCESSION_FIELD_BY_BALANCE = {
  balance_adm_fee: "adm_concession",
  balance_term_fee: "term_concession",
  balance_transport_fee: "transport_concession",
  balance_hostel_fee: "hostel_concession",
  balance_application_fee: "application_concession",
  balance_registration_fee: "registration_concession",
  balance_kit_fee: "kit_concession",
  balance_other_fee: "other_concession",
};

// Soft-deletes every fee report tied to a student, mirroring Student's own
// is_deleted/deleted_at soft-delete rather than removing the documents -
// financial history (what was charged/paid/waived) stays intact and every
// fee query already excludes is_deleted reports (getStudentOutstandingBalance,
// listPendingFees, eligible-student search, ...), so nothing else needs to
// change for a deleted student's reports to disappear from active views.
// A plain updateMany is enough here - we're only flipping the delete flags,
// not touching any of the derived net_x/balance_x fields, so there's no need
// to load full documents through the pre('validate') recompute hook.
export async function softDeleteStudentFeeReports(studentId, deletedByUserId) {
  await StudentFeeReport.updateMany(
    { student_id: studentId, is_deleted: { $ne: true } },
    { is_deleted: true, deleted_at: new Date(), updated_by: deletedByUserId },
  );
}

export async function waiveStudentOutstandingBalance(studentId, waivedByUserId) {
  const reports = await StudentFeeReport.find({
    student_id: studentId,
    status: "Active",
    is_deleted: { $ne: true },
  });

  for (const report of reports) {
    let waived = 0;

    // old_fee is a flat carry-forward balance, not derived from a
    // gross/concession/paid triple like the other buckets - waiving it
    // means zeroing it directly.
    const oldFee = Math.max(report.old_fee || 0, 0);
    if (oldFee > 0) {
      report.old_fee = 0;
      waived += oldFee;
    }

    for (const [balanceField, concessionField] of Object.entries(
      CONCESSION_FIELD_BY_BALANCE,
    )) {
      const balance = Math.max(report[balanceField] || 0, 0);
      if (balance <= 0) continue;
      report[concessionField] = (report[concessionField] || 0) + balance;
      waived += balance;
    }
    if (waived <= 0) continue;

    // remarks is a free-text field staff fill in themselves (see
    // StudentFeeReportForm.jsx) - append rather than overwrite so an
    // existing note isn't silently destroyed, still bounded to the
    // schema's 100-char maxlength.
    const waiverNote = `Fee waived (dropout deletion) ₹${waived}`;
    report.remarks = (
      report.remarks ? `${report.remarks}; ${waiverNote}` : waiverNote
    ).slice(0, 100);
    report.updated_by = waivedByUserId;
    // validateModifiedOnly: this report may predate a since-added required
    // field - only the concession/remarks paths we just touched (plus the
    // net_x/balance_x fields the pre('validate') hook recomputes from them)
    // need to validate here.
    await report.save({ validateModifiedOnly: true });
  }
}
