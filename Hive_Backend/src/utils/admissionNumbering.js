import Branch from "../models/Branch.js";
import Student from "../models/Student.js";
import { nextSequence } from "./sequence.js";

// Branch.code has no format restriction in the schema, so it could in
// theory contain regex metacharacters - escape it before interpolating
// into a $regex string below, otherwise a code like "A.B" would silently
// over-match and an unbalanced one (e.g. "A(B") would throw and break
// admission-number generation for that branch entirely.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function getBranchCode(branchId) {
  const branch = await Branch.findById(branchId).select("code name").lean();
  if (!branch)
    throw new Error(
      "Branch not found - cannot generate a numbered ID without it.",
    );
  return branch.code || branch.name?.slice(0, 3).toUpperCase() || "BR";
}

export async function generateUniqueId() {
  const seq = await nextSequence("admission-unique-id");
  return `UID-${String(seq).padStart(6, "0")}`;
}

export async function generateApplicationNo(branchId) {
  const branchCode = await getBranchCode(branchId);
  const year = new Date().getFullYear();
  const seq = await nextSequence(`application-${branchCode}-${year}`);
  return `${branchCode}${year}${String(seq).padStart(4, "0")}`;
}

// Bulk-uploaded students arrive with a caller-supplied admission_no this
// system's Counter never saw - most already follow the same
// "{branchCode}{year}{seq}" shape generateAdmissionNo produces (just
// assigned by hand/script, sometimes without the usual zero-padding, e.g.
// "BNR2026004"), some may be bare numbers (e.g. "300"). This collects every
// sequence value on record for the branch's CURRENT "{branchCode}{year}"
// namespace - deliberately NOT filtered by is_deleted, because a
// soft-deleted student's admission_no still physically occupies that row
// under Student's unique index (deleteStudent only ever sets is_deleted,
// it never removes the document), so reissuing its number to someone else
// would still throw a duplicate-key error. A number is only ever "free"
// here if no Student document - active or deleted - has ever used it.
async function getUsedSequencesForBranch(branchId, branchCode, year) {
  const prefix = `${branchCode}${year}`;
  const rows = await Student.find({
    branch: branchId,
    $or: [
      // case-insensitive - Branch.code is stored uppercase, but hand-typed
      // bulk-upload rows aren't guaranteed to match that casing.
      { admission_no: { $regex: `^${escapeRegex(prefix)}\\d+$`, $options: "i" } }, // e.g. "AYS20260300"
      { admission_no: /^\d+$/ }, // e.g. plain "300"
    ],
  })
    .select("admission_no")
    .lean();
  const used = new Set();
  for (const r of rows) {
    const raw = r.admission_no.toLowerCase().startsWith(prefix.toLowerCase())
      ? r.admission_no.slice(prefix.length)
      : r.admission_no;
    const n = parseInt(raw, 10);
    if (n > 0) used.add(n);
  }
  return used;
}

// Smallest sequence number not yet used - fills gaps left by soft-deleted
// students' predecessors/successors or by past collisions instead of only
// ever growing. Degenerates to exactly "max + 1" whenever there are no
// gaps (the case for every branch that hasn't had a deletion mid-sequence),
// so this changes nothing for the common case.
function firstUnusedSequence(used) {
  let seq = 1;
  while (used.has(seq)) seq++;
  return seq;
}

// This scan is the real source of truth on every call (no cached counter to
// drift out of sync) - it's scoped to one branch and one regex shape, so it
// can still miss real data (a row bulk-uploaded under the wrong branch
// reference, an odd casing/format, a Branch.code that drifted after the row
// was written). The loop below is what actually guarantees uniqueness:
// every candidate is checked against the *entire* Student collection (no
// branch filter, matching the real global unique index on admission_no)
// before it's ever handed out, so a wrong/stale scan can only cost a few
// wasted attempts, never a collision.
const MAX_ADMISSION_NO_ATTEMPTS = 50;

export async function generateAdmissionNo(branchId) {
  const branchCode = await getBranchCode(branchId);
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < MAX_ADMISSION_NO_ATTEMPTS; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const used = await getUsedSequencesForBranch(branchId, branchCode, year);
    const seq = firstUnusedSequence(used);
    const candidate = `${branchCode}${year}${String(seq).padStart(4, "0")}`;
    // eslint-disable-next-line no-await-in-loop
    const taken = await Student.exists({ admission_no: candidate });
    if (!taken) {
      if (attempt > 0) {
        console.warn(
          `generateAdmissionNo: ${candidate} needed ${attempt + 1} attempt(s) - ` +
            `a concurrent request took the same gap for branch ${branchId}.`,
        );
      }
      return candidate;
    }
  }
  throw new Error(
    `Could not generate a unique admission number for ${branchCode} (${year}) ` +
      `after ${MAX_ADMISSION_NO_ATTEMPTS} attempts.`,
  );
}

// roll_no scope: defaulted to PER CLASS (each class's roll numbers start
// at 1 independently) - this wasn't explicitly confirmed, flag if you
// wanted per-branch or school-wide instead.
export async function generateRollNo(classId) {
  const seq = await nextSequence(`roll-${classId}`);
  return String(seq);
}

export async function generateReceiptNo(branchId) {
  const branchCode = await getBranchCode(branchId);
  const year = new Date().getFullYear();
  const seq = await nextSequence(`receipt-${branchCode}-${year}`);
  return `RCT-${branchCode}-${year}-${String(seq).padStart(5, "0")}`;
}

// CV No. ("Computer Voucher") - the auto-generated counterpart to a
// hand-written MV No. ("Manual Voucher"), which the caller types in
// themselves instead of calling this. Same counter shape as
// generateReceiptNo, own namespace so the two sequences don't share numbers.
export async function generateVoucherNo(branchId) {
  const branchCode = await getBranchCode(branchId);
  const year = new Date().getFullYear();
  const seq = await nextSequence(`voucher-${branchCode}-${year}`);
  return `CV-${branchCode}-${year}-${String(seq).padStart(5, "0")}`;
}
