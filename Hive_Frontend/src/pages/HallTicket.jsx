import React, { useState, useEffect, useMemo } from "react";
import { studentApi, classApi, branchApi, examScheduleApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { useSubjects, withSelectedSubject } from "@/lib/useSubjects";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Printer,
  Plus,
  Trash2,
  Save,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  ACADEMIC_YEARS,
  CURRENT_ACADEMIC_YEAR,
  gradeLabel,
} from "@/lib/constants.js";
import { getSchoolMeta } from "@/lib/schoolBranding";
import { loadLogo } from "@/utils/pdfExport";

// The ten-name SUBJECTS array that used to live here is gone - the exam
// timetable picks from the branch's Subject catalog now (see
// lib/useSubjects.js), which is also what the Marks and Homework screens
// use, so a hall ticket can no longer name a subject nothing else knows.
const EXAM_TYPES = ["Unit Test", "Mid Term", "Final", "Annual"];
const EMPTY_SUBJECT = {
  subject: "",
  date: "",
  start_time: "09:00",
  duration_minutes: 180,
  max_marks: 100,
};
const EMPTY_FORM = {
  exam_name: "",
  class: "",
  section: "",
  academic_year: CURRENT_ACADEMIC_YEAR,
  exam_type: "Mid Term",
  center: "Main Campus",
  invigilator: "",
  subjects: [{ ...EMPTY_SUBJECT }],
};

// Class model only has `grade` (no separate label field) - see models/Class.js.
const classLabel = (c) =>
  c ? gradeLabel(c.grade) : "—";

const formatTime12h = (hhmm) => {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
};

// "3h", "30m", "3h 30m" - shorter than "180 min", which matters with up to
// 8 subject columns sharing the table width.
const formatDurationShort = (mins) => {
  const m = Number(mins) || 0;
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
};

// Shrinks the font (down to minSize) until `text` fits within maxW, then
// truncates with an ellipsis as a last resort - used for the subject-table
// cells instead of jsPDF's own text-wrapping (maxWidth), which would wrap
// long values (e.g. "09:00 AM-12:00 PM" in an 8-subject row) onto a second
// line and collide with the fixed row height above/below it.
const fitCellText = (doc, text, maxW, baseSize, minSize = 5) => {
  let size = baseSize;
  doc.setFontSize(size);
  while (doc.getTextWidth(text) > maxW && size > minSize) {
    size = Math.max(minSize, size - 0.5);
    doc.setFontSize(size);
  }
  if (doc.getTextWidth(text) <= maxW) return { text, size };
  let s = text;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1);
  return { text: s.length < text.length ? `${s}…` : s, size };
};

// Numeric dd/mm/yy - shorter than "01 Sept 2026", which matters with up to
// 8 subject columns sharing the table width. Reads UTC fields (not local)
// so the displayed date always matches the calendar day the backend's own
// overlap check compares against (dateKey() in examScheduleController.js
// also normalizes via toISOString) - never off-by-one in a timezone west
// of UTC.
const formatDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

export default function HallTicket() {
  const { user } = useAuth();
  const myId = user?.id || user?._id;
  const isTeacher = user?.role === "teacher";
  // Accounts Manager can also create exam schedules, for any class in their
  // branch (no "class teacher" ownership concept for them - see
  // createEligibleClasses below and examScheduleController.js's
  // assertCanWriteClass on the backend).
  const canCreateExam = isTeacher || user?.role === "accounts_manager";
  const { subjects: branchSubjects } = useSubjects();

  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [students, setStudents] = useState([]);
  const [examSchedules, setExamSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedExam, setSelectedExam] = useState(null);
  const [activeTab, setActiveTab] = useState("generate");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const STUDENTS_PAGE_SIZE = 10;

  useEffect(() => {
    Promise.all([
      classApi.list(),
      branchApi.list(),
      studentApi.list({ sort: "full_name", limit: 1000 }),
      examScheduleApi.list(),
    ]).then(([classesRes, branchesRes, studentsRes, schedules]) => {
      setClasses(classesRes?.data || []);
      setBranches(branchesRes || []);
      setStudents(studentsRes || []);
      setExamSchedules(schedules || []);
      setLoading(false);
    });
  }, []);

  const classesById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c._id, c])),
    [classes],
  );
  const branchesById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b._id, b])),
    [branches],
  );

  // Classes where the current user is the Class Teacher (homeroom) - the
  // only classes a teacher may create an exam schedule / generate hall
  // tickets for. classApi.list() already restricts a teacher's results to
  // classes they're assigned to (Class Teacher OR subject teacher - see
  // classController.listClasses), so this narrows further to Class Teacher
  // only, matching what the backend enforces on write.
  const classTeacherClassIds = useMemo(
    () =>
      classes
        .filter(
          (c) =>
            String(c.class_teacher_id?._id || c.class_teacher_id) ===
            String(myId),
        )
        .map((c) => c._id),
    [classes, myId],
  );

  const selectableClasses = isTeacher
    ? classes.filter((c) => classTeacherClassIds.includes(c._id))
    : classes;

  // Create-form-only: classes are picked Academic-Year-first (form.academic_year
  // doubles as both "which year is picked" and what gets submitted), then
  // narrowed to Class Teacher ownership for a teacher, same as
  // selectableClasses above but scoped to one year at a time. accounts_manager
  // gets every class in their branch for that year (classApi.list() already
  // returns their whole branch, unrestricted - see classController.listClasses).
  const createEligibleClasses = useMemo(() => {
    const byYear = classes.filter((c) => c.academic_year === form.academic_year);
    return isTeacher
      ? byYear.filter((c) => classTeacherClassIds.includes(c._id))
      : byYear;
  }, [classes, form.academic_year, isTeacher, classTeacherClassIds]);

  const visibleExamSchedules = isTeacher
    ? examSchedules.filter((e) => {
        const classId = e.class?._id || e.class;
        return classTeacherClassIds.includes(classId);
      })
    : examSchedules;

  // Every exam schedule was created for exactly one class (see
  // examScheduleController.js) - the Class field on the Generate Tickets
  // tab exists to pick that class's roster, not to be picked independently
  // of it. Leaving it free once an exam is selected let it silently
  // mismatch (e.g. tickets for "Class 3 Mid Term" printed against Class 5's
  // roster), not just look confusing but actually mislabel students.
  const examClassId = selectedExam
    ? String(selectedExam.class?._id || selectedExam.class)
    : null;

  // Auto-follow the exam's own class the moment one is picked, so the
  // roster below never has to be set by hand in the common case.
  useEffect(() => {
    if (examClassId) setSelectedClassId(examClassId);
  }, [examClassId]);

  // Once an exam is selected, the Class dropdown only ever offers that
  // exam's own class - no other class is a valid pairing for it. With no
  // exam picked yet, it's still free to browse any class's roster.
  const classDropdownOptions = examClassId
    ? selectableClasses.filter((c) => c._id === examClassId)
    : selectableClasses;

  const classStudents = students.filter((s) => {
    const sClassId = typeof s.class === "object" ? s.class?._id : s.class;
    return sClassId === selectedClassId;
  });

  const studentTotalPages = Math.max(
    1,
    Math.ceil(classStudents.length / STUDENTS_PAGE_SIZE),
  );
  const paginatedStudents = classStudents.slice(
    (studentPage - 1) * STUDENTS_PAGE_SIZE,
    studentPage * STUDENTS_PAGE_SIZE,
  );

  // Back to page 1 whenever the underlying list changes shape, so an old
  // page number never points past the end of a newly-selected class.
  useEffect(() => {
    setStudentPage(1);
  }, [selectedClassId, classStudents.length]);

  const addSubject = () =>
    setForm((f) => ({ ...f, subjects: [...f.subjects, { ...EMPTY_SUBJECT }] }));
  const removeSubject = (i) =>
    setForm((f) => ({
      ...f,
      subjects: f.subjects.filter((_, idx) => idx !== i),
    }));
  const updateSubject = (i, key, val) =>
    setForm((f) => ({
      ...f,
      subjects: f.subjects.map((s, idx) =>
        idx === i ? { ...s, [key]: val } : s,
      ),
    }));

  const saveExam = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await examScheduleApi.create(form);
      const updated = await examScheduleApi.list();
      setExamSchedules(updated || []);
      setForm({ ...EMPTY_FORM, subjects: [{ ...EMPTY_SUBJECT }] });
      setActiveTab("generate");
    } catch (err) {
      // The backend's message here is specific (e.g. which two subjects
      // clash, on which date) - surface it verbatim rather than a generic
      // "something went wrong", both as a toast (easy to notice) and
      // inline (stays visible near the form after the toast fades).
      const message =
        err?.response?.data?.message || "Failed to save exam schedule.";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ── PDF layout ───────────────────────────────────────────────────────
  // Tickets are meant to be printed and cut apart, so every batch (even a
  // single student's) renders into ONE combined PDF, 3 compact tickets
  // per A4 page, with a dashed cutting guide between tickets - never one
  // PDF download per student.
  const PAGE_W = 210;
  const MARGIN_X = 12;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const MARGIN_TOP = 8;
  const SLOT_H = 90;
  const SLOT_GAP = 5.5;
  const SLOTS_PER_PAGE = 3;

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Draws a signature image (uploaded via the Staff page) centered above
  // its line, sized to fit within a small box - a no-op when there's no
  // image, leaving the line blank for a physical signature instead.
  const SIG_IMG_MAX_W = 30;
  const SIG_IMG_MAX_H = 6;
  const drawSigImage = (doc, img, centerX, lineY) => {
    if (!img?.dataUrl) return;
    const aspect = img.width / img.height;
    let w = SIG_IMG_MAX_W;
    let h = w / aspect;
    if (h > SIG_IMG_MAX_H) {
      h = SIG_IMG_MAX_H;
      w = h * aspect;
    }
    doc.addImage(img.dataUrl, "PNG", centerX - w / 2, lineY - h - 0.6, w, h);
  };

  // Draws one compact hall ticket inside [x0, y0, w, SLOT_H].
  const drawTicketSlot = (
    doc,
    y0,
    student,
    exam,
    logo,
    teacherSig,
    principalSig,
  ) => {
    const x0 = MARGIN_X;
    const w = CONTENT_W;

    doc.setDrawColor(120, 120, 150);
    doc.setLineWidth(0.35);
    doc.roundedRect(x0, y0, w, SLOT_H, 2, 2);

    const classDoc =
      classesById[
        typeof student.class === "object" ? student.class?._id : student.class
      ];
    const branchDoc =
      branchesById[
        typeof student.branch === "object"
          ? student.branch?._id
          : student.branch
      ];

    // Header: small logo top-left, title + academic year, exam name + type.
    let y = y0 + 3;
    if (logo?.dataUrl) {
      const logoH = 9;
      const logoW = Math.min((logo.width / logo.height) * logoH, 30);
      doc.addImage(logo.dataUrl, "PNG", x0 + 3, y, logoW, logoH);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 80);
    doc.text("HALL TICKET", x0 + w / 2, y + 6.5, { align: "center" });

    // Exam name and academic year paired on one line - left/right aligned
    // against each other rather than academic year floating up next to
    // the title while exam name sits alone on its own line.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 90);
    doc.text(`Exam: ${exam.exam_name}`, x0 + 3, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    doc.text(exam.academic_year || "", x0 + w - 3, y + 13, { align: "right" });
    y += 16;

    // Student info block - Branch Name / Name of Student / Parent-
    // Guardian's Name on the left, Class & Section / Roll No on the
    // right, matching the school's printed hall-ticket template.
    const labelColW = 48;
    const rightColW = 52;
    const rightLabelW = 26;
    const rowH = 6;
    const boxY = y;
    doc.setDrawColor(150, 150, 180);
    doc.setLineWidth(0.25);
    doc.rect(x0, boxY, w, rowH * 3);
    doc.line(x0, boxY + rowH, x0 + w, boxY + rowH);
    doc.line(x0, boxY + rowH * 2, x0 + w, boxY + rowH * 2);
    doc.line(x0 + labelColW, boxY, x0 + labelColW, boxY + rowH * 3);
    doc.line(
      x0 + w - rightColW,
      boxY + rowH,
      x0 + w - rightColW,
      boxY + rowH * 3,
    );
    doc.line(
      x0 + w - rightColW + rightLabelW,
      boxY + rowH,
      x0 + w - rightColW + rightLabelW,
      boxY + rowH * 3,
    );

    const rowText = (rowIdx, label, value, rightLabel, rightValue) => {
      const rowY = boxY + rowH * rowIdx + rowH / 2 + 1.3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.3);
      doc.setTextColor(70, 70, 110);
      doc.text(label, x0 + 2, rowY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.3);
      doc.setTextColor(30, 30, 30);
      doc.text(String(value || "—"), x0 + labelColW + 2, rowY);
      if (rightLabel) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.3);
        doc.setTextColor(70, 70, 110);
        doc.text(rightLabel, x0 + w - rightColW + 2, rowY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.3);
        doc.setTextColor(30, 30, 30);
        doc.text(
          String(rightValue || "—"),
          x0 + w - rightColW + rightLabelW + 2,
          rowY,
        );
      }
    };
    rowText(0, "BRANCH NAME", branchDoc?.name);
    rowText(
      1,
      "NAME OF STUDENT",
      student.full_name,
      "CLASS & SECTION",
      `${classLabel(classDoc)}${student.section ? " - " + student.section : ""}`,
    );
    rowText(
      2,
      "PARENT/GUARDIAN'S NAME",
      student.parent_name,
      "ROLL NO.",
      student.roll_no || student.admission_no,
    );
    y = boxY + rowH * 3 + 2.5;

    // Examination timetable - one column per subject. Invigilator Sig.
    // is left blank on purpose - it's signed by hand at the exam.
    const subjects = exam.subjects || [];
    const tblLabelW = 24;
    const subColW = subjects.length ? (w - tblLabelW) / subjects.length : 0;
    // Slightly tighter than the info-block rows (6mm vs 6mm there too,
    // was 7mm) - freed up by DATE/TIME both getting shorter (numeric date,
    // start time only), which is what actually made room to add the
    // DURATION row below without crowding 8 subject columns.
    const tblRowH = 6;
    const tblY = y;

    doc.setFillColor(79, 70, 229);
    doc.rect(x0, tblY, w, tblRowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text("SUBJECT", x0 + 2, tblY + tblRowH / 2 + 1.3);
    subjects.forEach((sub, i) => {
      const cx = x0 + tblLabelW + subColW * i;
      const fitted = fitCellText(doc, sub.subject || "—", subColW - 2, 6.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fitted.size);
      doc.setTextColor(255, 255, 255);
      doc.text(fitted.text, cx + subColW / 2, tblY + tblRowH / 2 + 1.3, {
        align: "center",
      });
    });

    const drawRow = (rowIdx, label, values) => {
      const rowY = tblY + tblRowH * (rowIdx + 1);
      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 248, 255);
        doc.rect(x0, rowY, w, tblRowH, "F");
      }
      doc.setDrawColor(200, 200, 220);
      doc.setLineWidth(0.2);
      doc.rect(x0, rowY, w, tblRowH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.3);
      doc.setTextColor(70, 70, 110);
      doc.text(label, x0 + 2, rowY + tblRowH / 2 + 1.3);
      values.forEach((val, i) => {
        const cx = x0 + tblLabelW + subColW * i;
        doc.line(cx, rowY, cx, rowY + tblRowH);
        // `val` is an intentionally-blank "" for INVIGILATOR SIG. (signed by
        // hand at the exam) - only null/undefined fall back to "—", so an
        // explicit "" doesn't get turned into a dash.
        const fitted = fitCellText(doc, val ?? "—", subColW - 2, 6.8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fitted.size);
        doc.setTextColor(50, 50, 50);
        doc.text(fitted.text, cx + subColW / 2, rowY + tblRowH / 2 + 1.3, {
          align: "center",
        });
      });
    };
    drawRow(
      0,
      "DATE",
      subjects.map((s) => formatDate(s.date)),
    );
    drawRow(
      1,
      "TIME",
      subjects.map((s) => formatTime12h(s.start_time)),
    );
    drawRow(
      2,
      "DURATION",
      subjects.map((s) => formatDurationShort(s.duration_minutes)),
    );
    drawRow(
      3,
      "INVIGILATOR SIG.",
      subjects.map(() => ""),
    ); // intentionally blank
    doc.setDrawColor(150, 150, 180);
    doc.setLineWidth(0.25);
    doc.rect(x0, tblY, tblLabelW, tblRowH * 5);
    doc.line(x0, tblY + tblRowH, x0 + w, tblY + tblRowH);
    y = tblY + tblRowH * 5 + 2.5;

    // Note line
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.8);
    doc.setTextColor(80, 80, 80);
    doc.text("Note:", x0 + 2, y + 2.5);
    doc.line(x0 + 12, y + 2.5, x0 + w - 2, y + 2.5);
    // Deliberately more room than a bare line-gap needs - both for visual
    // breathing space and so an uploaded signature image (drawn just above
    // the line below) never crosses the Note underline above it.
    y += 11;

    // Signatures - Student / Class Teacher / Principal. An uploaded
    // signature image (Staff page - see BPStaff.jsx/User.signature_url)
    // is drawn just above the Class Teacher's/Principal's line when one
    // exists; Student always stays blank - signed by hand at the exam.
    const teacherLineX1 = x0 + w / 2 - 22;
    const teacherLineX2 = x0 + w / 2 + 22;
    const principalLineX1 = x0 + w - 44;
    const principalLineX2 = x0 + w - 2;
    drawSigImage(doc, teacherSig, (teacherLineX1 + teacherLineX2) / 2, y);
    drawSigImage(doc, principalSig, (principalLineX1 + principalLineX2) / 2, y);

    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.2);
    doc.line(x0 + 2, y, x0 + 44, y);
    doc.line(teacherLineX1, y, teacherLineX2, y);
    doc.line(principalLineX1, y, principalLineX2, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text("Signature of Student", x0 + 2, y);
    doc.text("Signature of Class Teacher", x0 + w / 2, y, { align: "center" });
    doc.text("Signature of Principal", x0 + w - 2, y, { align: "right" });
  };

  // Dashed cutting guide drawn in the gap between two consecutive filled
  // slots on a page (never trailing under an empty slot).
  const drawCutGuide = (doc, afterY) => {
    const guideY = afterY + SLOT_GAP / 2;
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([1.5, 1.2], 0);
    doc.line(MARGIN_X, guideY, PAGE_W - MARGIN_X, guideY);
    doc.setLineDashPattern([], 0); // reset to solid for anything drawn after
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(140, 140, 140);
  };

  // Builds ONE combined PDF for every { student, exam } pair - used for a
  // single ticket, the bulk "Generate All", View and Download alike, so
  // there's one rendering path instead of several that could drift apart.
  // Callers decide what to do with the result (save to disk, or open it).
  const buildTicketsPdf = async (pairs) => {
    if (pairs.length === 0) return null;

    // Preload each distinct school's logo once (loadLogo also caches by
    // URL internally) before any synchronous jsPDF drawing happens.
    const schoolNames = [...new Set(pairs.map((p) => p.student.schoolName))];
    const bySchool = {};
    await Promise.all(
      schoolNames.map(async (name) => {
        const meta = getSchoolMeta(name);
        bySchool[name] = { meta, logo: await loadLogo(meta.logo) };
      }),
    );

    // Class Teacher's and Principal's signature images come from
    // classesById (see classController.listClasses, which looks these up
    // server-side) - preload one per distinct class, same caching approach
    // as the school logos above.
    const classIds = [
      ...new Set(
        pairs.map(({ student }) =>
          typeof student.class === "object"
            ? student.class?._id
            : student.class,
        ),
      ),
    ];
    const byClass = {};
    await Promise.all(
      classIds.map(async (classId) => {
        const cls = classesById[classId];
        const [teacherSig, principalSig] = await Promise.all([
          cls?.class_teacher?.signature_url
            ? loadLogo(cls.class_teacher.signature_url)
            : null,
          cls?.principal?.signature_url
            ? loadLogo(cls.principal.signature_url)
            : null,
        ]);
        byClass[classId] = { teacherSig, principalSig };
      }),
    );

    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });
    const pages = chunk(pairs, SLOTS_PER_PAGE);
    pages.forEach((page, pageIdx) => {
      if (pageIdx > 0) doc.addPage();
      page.forEach(({ student, exam }, slotIdx) => {
        const y0 = MARGIN_TOP + slotIdx * (SLOT_H + SLOT_GAP);
        const { logo } = bySchool[student.schoolName];
        const classId =
          typeof student.class === "object"
            ? student.class?._id
            : student.class;
        const { teacherSig, principalSig } = byClass[classId] || {};
        drawTicketSlot(doc, y0, student, exam, logo, teacherSig, principalSig);
        if (slotIdx < page.length - 1) drawCutGuide(doc, y0 + SLOT_H);
      });
    });

    return doc;
  };

  const downloadTickets = async (pairs, filename) => {
    const doc = await buildTicketsPdf(pairs);
    if (doc) doc.save(filename);
  };

  // Opens the generated PDF in a new tab instead of downloading it. The
  // tab is opened synchronously, before the async PDF build, so browsers
  // don't treat the eventual navigation as a blocked popup - only once the
  // PDF is ready does the already-open tab get pointed at it.
  const viewTickets = async (pairs) => {
    const win = window.open("", "_blank");
    const doc = await buildTicketsPdf(pairs);
    if (!doc) {
      win?.close();
      return;
    }
    const blobUrl = doc.output("bloburl");
    if (win) win.location.href = blobUrl;
    else window.open(blobUrl, "_blank");
  };

  const generateHallTicket = async (student, exam) => {
    await downloadTickets(
      [{ student, exam }],
      `HallTicket-${student.full_name}-${exam.exam_name}.pdf`,
    );
  };

  const viewHallTicket = async (student, exam) => {
    await viewTickets([{ student, exam }]);
  };

  const generateAllHallTickets = async () => {
    if (!selectedExam || classStudents.length === 0) return;
    setGenerating(true);
    try {
      await downloadTickets(
        classStudents.map((student) => ({ student, exam: selectedExam })),
        `HallTickets-${classLabel(classesById[selectedClassId])}-${selectedExam.exam_name}.pdf`,
      );
    } finally {
      setGenerating(false);
    }
  };

  const viewAllHallTickets = async () => {
    if (!selectedExam || classStudents.length === 0) return;
    setGenerating(true);
    try {
      await viewTickets(
        classStudents.map((student) => ({ student, exam: selectedExam })),
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Hall Ticket Generation
          </h2>
          <p className="text-sm text-slate-500">
            {canCreateExam
              ? "Create exam schedules and generate hall tickets"
              : "Download hall tickets for a class and exam"}
          </p>
        </div>
        {canCreateExam && (
          <div className="flex gap-2">
            {["generate", "create"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === tab ? "bg-indigo-600 text-white shadow" : "bg-white text-slate-500 border border-slate-200"}`}
              >
                {tab === "generate"
                  ? "🎫 Generate Tickets"
                  : "➕ Create Exam Schedule"}
              </button>
            ))}
          </div>
        )}
      </div>

      {(!canCreateExam || activeTab === "generate") && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Select Exam & Class
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Exam Schedule
                </label>
                <Select
                  value={selectedExam?._id || ""}
                  onValueChange={(v) =>
                    setSelectedExam(
                      visibleExamSchedules.find((e) => e._id === v),
                    )
                  }
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select exam..." />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleExamSchedules.map((e) => (
                      <SelectItem key={e._id} value={e._id}>
                        {e.exam_name} —{" "}
                        {classLabel(classesById[e.class?._id || e.class])} (
                        {e.exam_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Class
                </label>
                <Select
                  value={selectedClassId}
                  onValueChange={setSelectedClassId}
                  disabled={!!examClassId}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select class..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classDropdownOptions.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {classLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={viewAllHallTickets}
                  disabled={
                    !selectedExam ||
                    !selectedClassId ||
                    classStudents.length === 0 ||
                    generating
                  }
                  className="flex-1 gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <Eye className="w-4 h-4" />
                  View All
                </Button>
                <Button
                  onClick={generateAllHallTickets}
                  disabled={
                    !selectedExam ||
                    !selectedClassId ||
                    classStudents.length === 0 ||
                    generating
                  }
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {generating
                    ? "Generating..."
                    : `Generate All (${classStudents.length})`}
                </Button>
              </div>
            </div>
          </div>

          {/* Student list with individual view/print */}
          {selectedClassId && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-sm font-bold text-slate-700">
                  {classLabel(classesById[selectedClassId])} —{" "}
                  {classStudents.length} Students
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {loading && (
                  <p className="text-center py-8 text-slate-400 text-sm">
                    Loading...
                  </p>
                )}
                {!loading && classStudents.length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-sm">
                    No students found in this class
                  </p>
                )}
                {paginatedStudents.map((s) => (
                  <div
                    key={s._id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {s.full_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {s.admission_no}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selectedExam}
                        onClick={() => viewHallTicket(s, selectedExam)}
                        className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selectedExam}
                        onClick={() => generateHallTicket(s, selectedExam)}
                        className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {classStudents.length > STUDENTS_PAGE_SIZE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Showing {(studentPage - 1) * STUDENTS_PAGE_SIZE + 1}–
                    {Math.min(
                      studentPage * STUDENTS_PAGE_SIZE,
                      classStudents.length,
                    )}{" "}
                    of {classStudents.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={studentPage <= 1}
                      onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Previous
                    </Button>
                    <span className="text-xs text-slate-500 px-1">
                      Page {studentPage} of {studentTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={studentPage >= studentTotalPages}
                      onClick={() =>
                        setStudentPage((p) => Math.min(studentTotalPages, p + 1))
                      }
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Existing schedules */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-bold text-slate-700">Exam Schedules</p>
            </div>
            {visibleExamSchedules.length === 0 ? (
              <p className="text-center py-6 text-slate-400 text-sm">
                No exam schedules yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleExamSchedules.map((e) => (
                  <div
                    key={e._id}
                    className="px-5 py-3 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {e.exam_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {classLabel(classesById[e.class?._id || e.class])} ·{" "}
                        {e.exam_type} · {e.academic_year} ·{" "}
                        {(e.subjects || []).length} subjects
                      </p>
                    </div>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-semibold">
                      {e.exam_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {canCreateExam && activeTab === "create" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-slate-700">
            Create New Exam Schedule
          </h3>
          {isTeacher && classTeacherClassIds.length === 0 ? (
            <p className="text-sm text-slate-400">
              You are not the Class Teacher of any class, so you can't create an
              exam schedule.
            </p>
          ) : (
            <>
              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "Exam Name", key: "exam_name", type: "input" },
                  { label: "Exam Center", key: "center", type: "input" },
                  { label: "Invigilator", key: "invigilator", type: "input" },
                  { label: "Section", key: "section", type: "input" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">
                      {f.label}
                    </label>
                    <Input
                      value={form[f.key]}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      className="text-sm"
                    />
                  </div>
                ))}
                {/* Academic Year comes before Class on purpose - the Class
                    options below are scoped to whichever year is picked here
                    (see createEligibleClasses), not the other way around. */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    Academic Year
                  </label>
                  <Select
                    value={form.academic_year}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, academic_year: v, class: "" }))
                    }
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACADEMIC_YEARS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    Class
                  </label>
                  <Select
                    value={form.class}
                    onValueChange={(v) => setForm((p) => ({ ...p, class: v }))}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Select class..." />
                    </SelectTrigger>
                    <SelectContent>
                      {createEligibleClasses.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {classLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    Exam Type
                  </label>
                  <Select
                    value={form.exam_type}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, exam_type: v }))
                    }
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_TYPES.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {createEligibleClasses.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No classes found for {form.academic_year}. Pick a different
                  academic year above.
                </p>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-700">
                    Subject Schedule
                  </h4>
                  <button
                    onClick={addSubject}
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Subject
                  </button>
                </div>
                {/* Column headers - shown once above the rows below rather
                    than repeated per row, since Add Subject can create
                    several. */}
                <div className="grid grid-cols-5 gap-2 px-3 mb-1.5">
                  {[
                    "Subject",
                    "Exam Date",
                    "Start Time",
                    "Duration (min)",
                    "Max Marks",
                  ].map((label) => (
                    <label
                      key={label}
                      className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {label}
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  {form.subjects.map((sub, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-5 gap-2 items-center bg-slate-50 p-3 rounded-xl"
                    >
                      <Select
                        value={sub.subject}
                        onValueChange={(v) => updateSubject(i, "subject", v)}
                      >
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder="Subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {withSelectedSubject(
                            branchSubjects,
                            sub.subject,
                          ).map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={sub.date}
                        onChange={(e) =>
                          updateSubject(i, "date", e.target.value)
                        }
                        className="text-xs"
                      />
                      <Input
                        type="time"
                        value={sub.start_time}
                        onChange={(e) =>
                          updateSubject(i, "start_time", e.target.value)
                        }
                        className="text-xs"
                      />
                      <Input
                        type="number"
                        value={sub.duration_minutes}
                        onChange={(e) =>
                          updateSubject(
                            i,
                            "duration_minutes",
                            Number(e.target.value),
                          )
                        }
                        placeholder="180"
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={sub.max_marks}
                          onChange={(e) =>
                            updateSubject(
                              i,
                              "max_marks",
                              Number(e.target.value),
                            )
                          }
                          placeholder="100"
                          className="text-xs"
                        />
                        <button
                          onClick={() => removeSubject(i)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("generate")}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveExam}
                  disabled={saving || !form.class || !form.exam_name}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  <Save className="w-4 h-4" />{" "}
                  {saving ? "Saving..." : "Save Exam Schedule"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
