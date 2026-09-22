// One-off (and safe to re-run) reconciliation of StudentFeeReport's stored
// paid_*_fee totals against the FeePayment receipts they're supposed to
// mirror.
//
// Why this exists: paid_*_fee is a denormalised running total, incremented
// by collectPayment() rather than derived from the receipts on read. It used
// to be written in a second, untransactioned save() that ran only after the
// FeePayment docs had already been created, so anything that interrupted the
// request in between committed the receipt and left the total short - and
// because the total is incremented rather than recomputed, every later
// payment built on the wrong base and the gap never closed. collectPayment()
// now does both writes in one transaction, so no NEW drift can open up; this
// script repairs the records that drifted before that fix landed.
//
//   node --env-file=.env src/utils/reconcileFeeReports.js           # dry run
//   node --env-file=.env src/utils/reconcileFeeReports.js --apply   # write
//
// Dry run is the default and touches nothing. --apply assigns the recomputed
// figure and save()s, so the schema's pre-validate hook recomputes
// net_*/balance_* from it - never write these fields with updateMany, which
// skips that hook and would leave balances stale.
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import FeePayment from "../models/FeePayment.js";
import StudentFeeReport from "../models/StudentFeeReport.js";

// Only the 6 fixed buckets. Kit Fee/Other are deliberately excluded: they're
// a running ledger whose gross/concession come from per-payment item deltas
// (item_actual_fee/item_concession_fee) rather than from a fixed target, and
// the ad-hoc Receipt Centre path (createPayment) writes Kit/Other receipts
// that were never meant to land on the report at all - so "sum the receipts"
// isn't the right answer for them. old_fee is excluded for the same reason:
// previous_due payments decrement it, and its original value isn't
// recoverable from the receipts alone.
const FEE_TYPE_TO_PAID_FIELD = {
  "School Fee": "paid_term_fee",
  "Term Fee": "paid_term_fee",
  "Admission Fee": "paid_adm_fee",
  "Transport Fee": "paid_transport_fee",
  "Hostel Fee": "paid_hostel_fee",
  "Application Fee": "paid_application_fee",
  "Registration Fee": "paid_registration_fee",
};

const PAID_FIELDS = [...new Set(Object.values(FEE_TYPE_TO_PAID_FIELD))];

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDB();

  // What the receipts actually say, per student per bucket. Cancelled rows
  // are excluded to match applyReceiptCancellation(), which reverses a
  // cancelled payment back out of the report.
  const rows = await FeePayment.aggregate([
    {
      $match: {
        status: { $ne: "Cancelled" },
        is_deleted: { $ne: true },
        fee_type: { $in: Object.keys(FEE_TYPE_TO_PAID_FIELD) },
      },
    },
    {
      $group: {
        _id: { student_id: "$student_id", fee_type: "$fee_type" },
        paid: { $sum: "$amount" },
      },
    },
  ]);

  const actual = new Map();
  for (const r of rows) {
    const key = String(r._id.student_id);
    const field = FEE_TYPE_TO_PAID_FIELD[r._id.fee_type];
    if (!actual.has(key)) actual.set(key, {});
    const bucket = actual.get(key);
    bucket[field] = (bucket[field] || 0) + r.paid;
  }

  const reports = await StudentFeeReport.find({ is_deleted: { $ne: true } });

  const drifted = [];
  for (const report of reports) {
    const expected = actual.get(String(report.student_id)) || {};
    const changes = [];
    for (const field of PAID_FIELDS) {
      const want = expected[field] || 0;
      const have = report[field] || 0;
      if (want !== have) changes.push({ field, have, want });
    }
    if (changes.length) drifted.push({ report, changes });
  }

  console.log(`Reports scanned : ${reports.length}`);
  console.log(`Reports drifted : ${drifted.length}`);
  console.log(`Mode            : ${apply ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);

  let net = 0;
  for (const { report, changes } of drifted) {
    for (const c of changes) {
      net += c.want - c.have;
      console.log(
        `${report.student_name} [${report._id}] ${c.field}: ${c.have} -> ${c.want} (${
          c.want - c.have > 0 ? "+" : ""
        }${c.want - c.have})`,
      );
    }
    if (apply) {
      for (const c of changes) report[c.field] = c.want;
      // save() (not updateMany) so pre-validate recomputes net_*/balance_*.
      await report.save();
    }
  }

  console.log(
    `\nNet correction to recorded collections: ${net >= 0 ? "+" : ""}${net}`,
  );
  if (!apply && drifted.length) {
    console.log("Re-run with --apply to write these corrections.");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("reconcileFeeReports failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
