// utils/sequence.js
import Counter from "../models/Counter.js";

/**
 * Atomically increments and returns the next value for a given counter
 * key. Creates the counter at 1 on first use (upsert).
 */
export async function nextSequence(key) {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
}

/**
 * Makes sure a counter's current value is at least `floor`, without ever
 * pulling it down - used to catch a counter up to real pre-existing data
 * (e.g. bulk-uploaded records) the first time it's used, so the next
 * nextSequence() call continues on from reality instead of restarting at 1.
 * Read-then-write rather than a single atomic upsert, since a filter with
 * `$lt` combined with `upsert: true` would attempt a duplicate insert when
 * the doc already exists but doesn't match the condition.
 */
export async function ensureCounterAtLeast(key, floor) {
  if (!floor || floor <= 0) return;
  const existing = await Counter.findById(key).lean();
  if (!existing) {
    await Counter.create({ _id: key, seq: floor }).catch(() => {});
    return;
  }
  if (existing.seq < floor) {
    await Counter.updateOne({ _id: key, seq: { $lt: floor } }, { $set: { seq: floor } });
  }
}
