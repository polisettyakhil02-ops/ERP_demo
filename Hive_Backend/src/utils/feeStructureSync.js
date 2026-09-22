// Syncs the 3 optional fee buckets (Admission/Registration/Application) on
// existing StudentFeeReports whenever their FeeStructure changes.
//
// Unlike a one-time backfill, this keeps syncing on every edit: a bucket
// already carrying a value gets overwritten with the structure's new value
// too, and a bucket the structure clears back to null gets reset to
// "not configured" (has_X_fee: false, amounts zeroed). The one thing this
// never overrides is money already collected - any report with a nonzero
// paid_X_fee for a bucket is left completely alone, since the structure
// changing after a payment was taken is a case for manual correction, not
// a silent rewrite.
//
// Tuition/Term isn't included here: tuition_fee is a required FeeStructure
// field (never null) and has_term_fee is always true on every report, so
// this would mean live-syncing gross_term_fee on every structure edit for
// every student regardless of prior amount - deliberately kept out of scope
// for now.
import Class from "../models/Class.js";
import StudentFeeReport from "../models/StudentFeeReport.js";

const OPTIONAL_BUCKETS = [
  {
    structureField: "admission_fee",
    hasFlag: "has_admission_fee",
    grossField: "adm_gross_fee",
    concessionField: "adm_concession",
    paidField: "paid_adm_fee",
    netField: "net_adm_fee",
    balanceField: "balance_adm_fee",
  },
  {
    structureField: "registration_fee",
    hasFlag: "has_registration_fee",
    grossField: "registration_gross_fee",
    concessionField: "registration_concession",
    paidField: "paid_registration_fee",
    netField: "net_registration_fee",
    balanceField: "balance_registration_fee",
  },
  {
    structureField: "application_fee",
    hasFlag: "has_application_fee",
    grossField: "application_gross_fee",
    concessionField: "application_concession",
    paidField: "paid_application_fee",
    netField: "net_application_fee",
    balanceField: "balance_application_fee",
  },
  {
    structureField: "tuition_fee",
    hasFlag: "has_term_fee",
    grossField: "gross_term_fee",
    concessionField: "term_concession",
    paidField: "paid_term_fee",
    netField: "net_term_fee",
    balanceField: "balance_term_fee",
  },
];

// A bucket is fair game to sync (in either direction) as long as nothing's
// been paid against it yet - $in: [0, null] catches both the normal
// zero-default and any legacy doc where the field is missing entirely.
const UNPAID = { $in: [0, null] };

export async function syncFeeReportBuckets(feeStructure, userId) {
  const cls = await Class.findOne({
    branch: feeStructure.branch,
    academic_year: feeStructure.academic_year,
    grade: feeStructure.grade,
    is_deleted: { $ne: true },
  })
    .select("_id")
    .lean();
  if (!cls) return { synced: 0, buckets: {} };

  const buckets = {};
  let synced = 0;
  for (const bucket of OPTIONAL_BUCKETS) {
    const value = feeStructure[bucket.structureField];
    const baseFilter = {
      class: cls._id,
      branch: feeStructure.branch,
      [bucket.paidField]: UNPAID,
    };

    let result;
    if (value == null) {
      // Structure no longer defines this bucket - drop it back to
      // "not configured" for anyone who hasn't paid on it, instead of
      // leaving a stale gross amount from the old schedule behind.
      // eslint-disable-next-line no-await-in-loop
      result = await StudentFeeReport.updateMany(
        { ...baseFilter, [bucket.hasFlag]: true },
        {
          $set: {
            [bucket.hasFlag]: false,
            [bucket.grossField]: 0,
            [bucket.concessionField]: 0,
            [bucket.netField]: 0,
            [bucket.balanceField]: 0,
            updated_by: userId,
          },
        },
      );
    } else {
      // eslint-disable-next-line no-await-in-loop
      result = await StudentFeeReport.updateMany(baseFilter, [
        {
          $set: {
            [bucket.hasFlag]: true,
            [bucket.grossField]: value,
            // Recomputed inline (not via the schema's pre-validate hook,
            // which a bulk updateMany never triggers) using each report's
            // own existing concession - paid is guaranteed 0/null here by
            // baseFilter, so balance always reduces to net.
            [bucket.netField]: {
              $subtract: [
                value,
                { $ifNull: [`$${bucket.concessionField}`, 0] },
              ],
            },
            [bucket.balanceField]: {
              $subtract: [
                {
                  $subtract: [
                    value,
                    { $ifNull: [`$${bucket.concessionField}`, 0] },
                  ],
                },
                { $ifNull: [`$${bucket.paidField}`, 0] },
              ],
            },
            updated_by: userId,
          },
        },
      ]);
    }
    buckets[bucket.structureField] = result.modifiedCount;
    synced += result.modifiedCount;
  }
  return { synced, buckets };
}
