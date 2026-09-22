import React, { useState, useEffect, useRef, useMemo } from "react";
import { studentApi, classApi, marksApi } from "@/api/api";
import { getSchoolMeta } from "@/lib/schoolBranding";
import { Search, Printer, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSubjects } from "@/lib/useSubjects";

// The fixed six-subject SUBJECTS array that used to live here is gone, and
// with it the strict enum on Marks.subject it was written to match -
// subjects are master data now (see Hive_Backend/src/models/Subject.js).
//
// A report card lists the subjects the student's OWN class teaches
// (Class.subject_teachers), so two classes with different subjects no
// longer print identical rows with half of them blank. getStudentReport()
// keys each exam block by that per-student list, which is why everything
// downstream reads the subjects back off the report object rather than
// taking a separate parameter.
const EXAM_TYPES = ["Quarterly", "Half Yearly", "Final"];

// Class model only has `grade` (no separate `section`) — see models/Class.js.
const classLabel = (c) => (c ? `Class ${c.grade}` : "—");

const getGrade = (pct) => {
  if (pct >= 90) return { grade: "A+", color: "#16a34a", bg: "#f0fdf4" };
  if (pct >= 80) return { grade: "A", color: "#2563eb", bg: "#eff6ff" };
  if (pct >= 70) return { grade: "B", color: "#7c3aed", bg: "#f5f3ff" };
  if (pct >= 60) return { grade: "C", color: "#d97706", bg: "#fffbeb" };
  if (pct >= 40) return { grade: "D", color: "#ea580c", bg: "#fff7ed" };
  return { grade: "F", color: "#dc2626", bg: "#fef2f2" };
};

const getRemark = (pct) => {
  if (pct >= 90) return "Outstanding";
  if (pct >= 80) return "Excellent";
  if (pct >= 70) return "Very Good";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Average";
  return "Needs Improvement";
};

// Maps exam_type values from the DB (Marks.exam_type enum: "Unit Test",
// "Mid Term", "Final" - see models/Marks.js) to the report card's own
// display names.
const EXAM_MAP = {
  Quarterly: "Quarterly",
  "Half Yearly": "Half Yearly",
  Final: "Final",
  "Unit Test": "Quarterly",
  "Mid Term": "Half Yearly",
};

export default function BPReportCard() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allMarks, setAllMarks] = useState([]);
  const [filterClass, setFilterClass] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef();
  const { subjects: branchSubjects } = useSubjects();

  useEffect(() => {
    Promise.all([studentApi.list(), marksApi.list(), classApi.list()]).then(
      ([s, m, c]) => {
        setStudents(s.filter((st) => st.status === "Active"));
        setAllMarks(m);
        setClasses(c.data);
        setLoading(false);
      },
    );
  }, []);

  const classesById = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(classes) ? classes : []).map((c) => [c._id, c]),
      ),
    [classes],
  );

  const studentClassId = (s) => s.class?._id || s.class;

  const filtered = students.filter((s) => {
    const matchClass =
      filterClass === "All" || studentClassId(s) === filterClass;
    const matchSearch =
      !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_no?.includes(search);
    return matchClass && matchSearch;
  });

  // Subjects taught in this student's class, falling back to the branch
  // catalog when the class has no subject teachers assigned yet - a report
  // card with no rows at all would read as "no marks recorded" rather than
  // "nobody has been assigned to teach this class".
  const subjectsForStudent = (studentId) => {
    const student = students.find((s) => s._id === studentId);
    const cls = student ? classesById[studentClassId(student)] : null;
    const names = [
      ...new Set((cls?.subject_teachers || []).map((st) => st.subject)),
    ].filter(Boolean);
    return names.length > 0 ? names.sort() : branchSubjects;
  };

  const getStudentReport = (studentId) => {
    const studentMarks = allMarks.filter((m) => m.student_id === studentId);
    const report = {};
    const subjects = subjectsForStudent(studentId);
    EXAM_TYPES.forEach((et) => {
      report[et] = {};
      subjects.forEach((subj) => {
        // match both direct and mapped exam types
        const entry = studentMarks.find((m) => {
          const mapped = EXAM_MAP[m.exam_type] || m.exam_type;
          return mapped === et && m.subject === subj;
        });
        report[et][subj] = entry ? entry.marks_obtained : null;
      });
    });
    return report;
  };

  // Reads the subject list back off the report block rather than taking it
  // as a parameter - getStudentReport keyed it by the student's own
  // subjects, so those keys already ARE the right list for this student.
  const examTotals = (report, examType) => {
    const vals = Object.values(report[examType] || {}).filter(
      (v) => v !== null,
    );
    if (!vals.length) return { total: 0, max: 0, pct: 0, hasData: false };
    const total = vals.reduce((a, b) => a + b, 0);
    const max = vals.length * 100;
    return { total, max, pct: Math.round((total / max) * 100), hasData: true };
  };

  const overallSummary = (report) => {
    let total = 0,
      max = 0;
    EXAM_TYPES.forEach((et) => {
      const t = examTotals(report, et);
      if (t.hasData) {
        total += t.total;
        max += t.max;
      }
    });
    return max > 0 ? Math.round((total / max) * 100) : 0;
  };

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Report Card - ${selectedStudent?.full_name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-size: 12px; }
        th { background: #f1f5f9; font-weight: 600; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 22px; font-weight: 700; color: #1e293b; margin: 0; }
        .header p { font-size: 13px; color: #64748b; margin: 2px 0; }
        .section-title { font-size: 14px; font-weight: 700; color: #fff; padding: 6px 12px; margin: 12px 0 6px; border-radius: 4px; }
        .q { background: #6366f1; } .h { background: #0891b2; } .f { background: #16a34a; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; font-size: 12px; }
        .info-item { display: flex; gap: 6px; } .info-label { font-weight: 600; color: #475569; }
        .grade-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; }
        .summary-row td { font-weight: 700; background: #f8fafc; }
        .overall { text-align: center; padding: 12px; background: #f0fdf4; border-radius: 8px; margin-top: 12px; }
        @media print { body { padding: 10px; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );

  const selectedClassDoc = selectedStudent
    ? classesById[studentClassId(selectedStudent)]
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Report Cards</h2>
          <p className="text-sm text-slate-500">
            Quarterly · Half Yearly · Final
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search student..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-44 text-sm">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {classLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Student List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {filtered.length} Students
            </p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No students found
              </div>
            )}
            {filtered.map((s) => {
              const report = getStudentReport(s._id);
              const pct = overallSummary(report);
              const { grade, color } = pct
                ? getGrade(pct)
                : { grade: "—", color: "#94a3b8" };
              return (
                <button
                  key={s._id}
                  onClick={() => setSelectedStudent(s)}
                  className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${selectedStudent?._id === s._id ? "bg-indigo-50 border-l-2 border-indigo-500" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {s.full_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {classLabel(classesById[studentClassId(s)])} ·{" "}
                        {s.admission_no}
                      </p>
                    </div>
                    <span className="text-sm font-bold" style={{ color }}>
                      {grade}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Report Card Detail */}
        <div className="lg:col-span-2">
          {!selectedStudent ? (
            <div className="bg-white rounded-xl border border-slate-200 h-full flex items-center justify-center text-slate-400">
              <div className="text-center p-10">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  Select a student to view their report card
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">
                  {selectedStudent.full_name}
                </p>
                <Button
                  onClick={handlePrint}
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                </Button>
              </div>

              {/* Printable Content */}
              <div className="p-5 overflow-y-auto max-h-[650px]" ref={printRef}>
                {/* School Header - branded per the student whose report
                    card this is, not whoever's viewing it. */}
                <div className="header text-center mb-5">
                  <img
                    src={getSchoolMeta(selectedStudent?.schoolName).logo}
                    alt={getSchoolMeta(selectedStudent?.schoolName).logoAlt}
                    className="h-12 w-auto mx-auto mb-2 object-contain"
                  />
                  <h1 className="text-2xl font-bold text-slate-800">
                    {getSchoolMeta(selectedStudent?.schoolName).erpName}
                  </h1>
                  <p className="text-sm text-slate-500">
                    Dominare Tech Pvt Ltd · Academic Report Card
                  </p>
                  <div className="mt-2 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded" />
                </div>

                {/* Student Info */}
                <div className="info-grid grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 mb-5 text-sm">
                  {[
                    ["Student Name", selectedStudent.full_name],
                    ["Admission No", selectedStudent.admission_no || "—"],
                    ["Class", classLabel(selectedClassDoc)],
                    ["Gender", selectedStudent.gender || "—"],
                    ["Roll No", selectedStudent.roll_no || "—"],
                    ["Academic Year", selectedClassDoc?.academic_year || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="info-item flex gap-1.5">
                      <span className="info-label font-semibold text-slate-500">
                        {label}:
                      </span>
                      <span className="text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Exam Sections */}
                {(() => {
                  const report = getStudentReport(selectedStudent._id);
                  const sectionColors = {
                    Quarterly: {
                      bg: "bg-indigo-600",
                      light: "bg-indigo-50",
                      text: "text-indigo-700",
                      border: "border-indigo-200",
                    },
                    "Half Yearly": {
                      bg: "bg-cyan-600",
                      light: "bg-cyan-50",
                      text: "text-cyan-700",
                      border: "border-cyan-200",
                    },
                    Final: {
                      bg: "bg-emerald-600",
                      light: "bg-emerald-50",
                      text: "text-emerald-700",
                      border: "border-emerald-200",
                    },
                  };
                  return EXAM_TYPES.map((et) => {
                    const totals = examTotals(report, et);
                    const c = sectionColors[et];
                    return (
                      <div key={et} className="mb-5">
                        <div
                          className={`section-title ${c.bg} text-white text-xs font-bold px-3 py-2 rounded-t-lg`}
                        >
                          {et === "Quarterly"
                            ? "📋 Quarterly Examination"
                            : et === "Half Yearly"
                              ? "📘 Half Yearly Examination"
                              : "🎓 Final Examination"}
                        </div>
                        <div
                          className={`rounded-b-lg border ${c.border} overflow-hidden`}
                        >
                          <table className="w-full text-sm">
                            <thead className={`${c.light}`}>
                              <tr>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">
                                  Subject
                                </th>
                                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">
                                  Max Marks
                                </th>
                                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">
                                  Obtained
                                </th>
                                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">
                                  %
                                </th>
                                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">
                                  Grade
                                </th>
                                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">
                                  Remark
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {Object.keys(report[et]).map((subj) => {
                                const val = report[et][subj];
                                const pct =
                                  val !== null
                                    ? Math.round((val / 100) * 100)
                                    : null;
                                const gradeInfo =
                                  pct !== null ? getGrade(pct) : null;
                                return (
                                  <tr key={subj} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-medium text-slate-700">
                                      {subj}
                                    </td>
                                    <td className="px-3 py-2 text-center text-slate-500">
                                      100
                                    </td>
                                    <td className="px-3 py-2 text-center font-semibold text-slate-800">
                                      {val !== null ? (
                                        val
                                      ) : (
                                        <span className="text-slate-300">
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center text-slate-600">
                                      {pct !== null ? `${pct}%` : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {gradeInfo ? (
                                        <span
                                          className="grade-badge px-2 py-0.5 rounded text-xs font-bold"
                                          style={{
                                            color: gradeInfo.color,
                                            background: gradeInfo.bg,
                                          }}
                                        >
                                          {gradeInfo.grade}
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center text-xs text-slate-500">
                                      {pct !== null ? getRemark(pct) : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* Summary row */}
                              <tr className="summary-row bg-slate-50 border-t-2 border-slate-200">
                                <td className="px-3 py-2 font-bold text-slate-800">
                                  Total
                                </td>
                                <td className="px-3 py-2 text-center font-bold text-slate-600">
                                  {Object.keys(report[et]).length * 100}
                                </td>
                                <td className="px-3 py-2 text-center font-bold text-slate-800">
                                  {totals.hasData ? totals.total : "—"}
                                </td>
                                <td className="px-3 py-2 text-center font-bold text-slate-800">
                                  {totals.hasData ? `${totals.pct}%` : "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {totals.hasData ? (
                                    <span
                                      className="grade-badge px-2 py-0.5 rounded text-xs font-bold"
                                      style={{
                                        color: getGrade(totals.pct).color,
                                        background: getGrade(totals.pct).bg,
                                      }}
                                    >
                                      {getGrade(totals.pct).grade}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                                  {totals.hasData ? getRemark(totals.pct) : "—"}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}

                {/* Overall Summary */}
                {(() => {
                  const report = getStudentReport(selectedStudent._id);
                  const pct = overallSummary(report);
                  if (!pct) return null;
                  const { grade, color, bg } = getGrade(pct);
                  return (
                    <div className="overall mt-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Overall Performance (All Exams)
                        </p>
                        <p className="text-2xl font-bold text-slate-800 mt-0.5">
                          {pct}%
                        </p>
                        <p className="text-sm text-slate-500">
                          {getRemark(pct)}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="text-5xl font-black" style={{ color }}>
                          {grade}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Overall Grade
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 text-right hidden sm:block">
                        <p>Class Teacher's Signature</p>
                        <div className="mt-6 border-t border-slate-300 w-28 text-center pt-1">
                          Signature
                        </div>
                        <p className="mt-4">Principal's Signature</p>
                        <div className="mt-6 border-t border-slate-300 w-28 text-center pt-1">
                          Signature
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
