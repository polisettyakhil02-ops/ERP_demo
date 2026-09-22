import { useEffect, useState } from "react";
import { subjectApi } from "@/api/api";

// The subject list for the current user's branch, for any page that needs a
// subject dropdown.
//
// This replaces the six hard-coded arrays that used to live in
// lib/constants.js (SUBJECTS) and in BPMarks / BPReportCard / BPAttendance /
// HomeworkManager / HallTicket individually. Those had drifted apart -
// "Mathematics" in the staff forms against "Maths" in the marks grid - so
// the same subject was being stored under two names depending on which page
// wrote it. There is one list now, and a Principal or Accounts Manager edits
// it from the Subjects page.
//
// Returns NAMES (strings), not documents, because that is what every model
// stores: Marks.subject, Attendance.subject, Homework.subject,
// Class.subject_teachers[].subject and User.subject_taught are all plain
// name strings. Handing a dropdown `_id`s would silently write ids into
// those fields.
//
// `fallback` covers the window before the request lands and the case where a
// branch has no subjects switched on yet - a dropdown that renders empty
// looks broken, and on an edit form it would also make an already-saved
// value unselectable. Pass the names the page must always be able to show
// (typically the value currently on the record).
// `branch` only matters for a multi-branch role (Admin Officer): without it
// the server returns the union across every branch they are assigned to,
// which on a page already scoped to ONE branch would offer subjects that
// branch has not adopted. Single-branch roles are pinned server-side and
// can ignore it.
export function useSubjects({ fallback = [], branch } = {}) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    subjectApi
      .list(branch ? { branch } : {})
      .then((rows) => {
        if (cancelled) return;
        setSubjects((rows || []).map((s) => s.name).filter(Boolean));
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branch]);

  const list = subjects.length > 0 ? subjects : fallback;
  return { subjects: list, loading, error };
}

// Merges a value already stored on a record into the option list, so editing
// an old record whose subject has since been renamed, retired or removed
// from the branch doesn't silently blank the field. The stale value stays
// selectable until someone changes it on purpose.
// Accepts a single name or an array of them, since some fields hold one
// subject (Marks, Homework) and others hold several (User.subject_taught).
export function withSelectedSubject(options, selected) {
  const wanted = (Array.isArray(selected) ? selected : [selected]).filter(
    Boolean,
  );
  const missing = wanted.filter((s) => !options.includes(s));
  return missing.length ? [...missing, ...options] : options;
}
