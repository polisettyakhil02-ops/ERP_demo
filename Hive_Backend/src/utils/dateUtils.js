// utils/dateUtils.js
//
// Shared between backDateRequestController.js and feeController.js's
// collectPayment() - both need "what is today, as the same plain
// YYYY-MM-DD string a <input type="date"> already produces" so a back
// date can be checked with a simple string comparison instead of
// converting to Date objects (and risking a timezone-driven off-by-one-
// day bug right at the boundary this feature cares most about).

// Server-local "today" - matches the server's own clock/timezone, the
// same way the rest of this codebase already derives "today" (e.g.
// admissionNumbering.js's `new Date().getFullYear()`), rather than UTC.
export function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
