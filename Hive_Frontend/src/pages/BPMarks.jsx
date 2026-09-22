import React, { useState, useEffect, useMemo } from "react";
import { studentApi, classApi, marksApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { useSubjects } from "@/lib/useSubjects";
import { Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// The fixed six-column MARKS_SUBJECTS array that used to live here is gone.
// Columns are derived from the classes actually on screen (see
// subjectColumns below): a class's subjects are the ones it has subject
// teachers assigned for, which is the same fact marksController authorises
// writes against. The branch's Subject catalog is only the fallback for a
// class with nothing assigned yet.
const EXAM_TYPES = ["Unit Test", "Mid Term", "Final"];

const getGrade = (obtained, max) => {
  const pct = (obtained / max) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  return "D";
};

const gradeColor = {
  "A+": "text-emerald-700 bg-emerald-50",
  A: "text-blue-700 bg-blue-50",
  B: "text-indigo-700 bg-indigo-50",
  C: "text-amber-700 bg-amber-50",
  D: "text-red-700 bg-red-50",
};

// Class model only has `grade` (no separate `section`) — see models/Class.js.
const classLabel = (c) => (c ? `Class ${c.grade}` : "—");

// `class` matches Marks.class (an ObjectId ref Class) - see models/Marks.js.
const EMPTY_FORM = {
  student_id: "",
  student_name: "",
  class: "",
  exam_type: "Final",
  subject: "",
  marks_obtained: "",
  max_marks: "100",
};

export default function BPMarks() {
  const { user } = useAuth();
  const role = user?.role;
  const isTeacher = role === "teacher";
  const myId = user?.id || user?._id;

  const { subjects: branchSubjects } = useSubjects();

  const [classes, setClasses] = useState([]);
  useEffect(() => {
    // classApi.list() already resolves to a plain array - don't re-unwrap
    // with .data here, or `classes` ends up undefined.
    classApi.list().then((data) => {
      setClasses(data.data);
    });
  }, []);
  const classesById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c._id, c])),
    [classes],
  );

  const mySubjectsByClassId = useMemo(() => {
    if (!isTeacher) return {};
    const map = {};
    classes.forEach((c) => {
      const subjects =
        c.my_subjects && c.my_subjects.length
          ? c.my_subjects
          : (c.subject_teachers || [])
              .filter(
                (st) =>
                  String(st.teacher_id?._id || st.teacher_id) === String(myId),
              )
              .map((st) => st.subject);
      if (subjects.length > 0) {
        map[c._id] = new Set(subjects);
      }
    });
    return map;
  }, [classes, isTeacher, myId]);

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

  const myClassIds = useMemo(
    () => Object.keys(mySubjectsByClassId),
    [mySubjectsByClassId],
  );

  const canSeeAllSubjectsForRow = (classId) =>
    !isTeacher || classTeacherClassIds.includes(classId);

  const canSeeSubjectForRow = (classId, subject) => {
    if (!isTeacher) return true;
    if (canSeeAllSubjectsForRow(classId)) return true;
    return mySubjectsByClassId[classId]?.has(subject) || false;
  };

  const [marks, setMarks] = useState([]);
  const [students, setStudents] = useState([]);
  const [classIdFilter, setClassIdFilter] = useState("All");
  const [examFilter, setExamFilter] = useState("Final");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [m, s] = await Promise.all([marksApi.list(), studentApi.list()]);
    setMarks(m);
    setStudents(s.filter((st) => st.status === "Active"));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // A teacher may only enter marks for a (class, subject) pair they are
  // assigned to - marksController enforces the same rule server-side, so
  // offering anything wider here would just produce a 403 on save. Other
  // roles get the chosen class's subjects, falling back to the branch
  // catalog when that class has no subject teachers assigned yet.
  const subjectOptionsForForm = useMemo(() => {
    if (isTeacher) {
      if (!form.class) return [];
      return Array.from(mySubjectsByClassId[form.class] || []);
    }
    if (!form.class) return branchSubjects;
    const ofClass = subjectsOfClass(form.class);
    return ofClass.length > 0 ? ofClass.sort() : branchSubjects;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, form.class, mySubjectsByClassId, classesById, branchSubjects]);

  const canSubmitForm =
    form.student_id &&
    form.subject &&
    form.marks_obtained !== "" &&
    (!isTeacher || subjectOptionsForForm.includes(form.subject));

  const save = async () => {
    if (!canSubmitForm) return;
    const grade = getGrade(Number(form.marks_obtained), Number(form.max_marks));
    await marksApi.create({
      ...form,
      marks_obtained: Number(form.marks_obtained),
      max_marks: Number(form.max_marks),
      grade,
    });
    setShowForm(false);
    setForm(EMPTY_FORM);
    load();
  };

  // Students visible at all: a Teacher only ever sees students in a class
  // they teach a subject in or are Class Teacher of.
  const visibleStudents = useMemo(() => {
    if (!isTeacher) return students;
    return students.filter((s) => myClassIds.includes(s.class?._id || s.class));
  }, [students, isTeacher, myClassIds]);

  const filteredStudents = visibleStudents.filter(
    (s) =>
      classIdFilter === "All" || (s.class?._id || s.class) === classIdFilter,
  );

  // Every subject taught in a given class, from its subject_teachers.
  const subjectsOfClass = (classId) => {
    const cls = classesById[classId];
    if (!cls) return [];
    return [
      ...new Set((cls.subject_teachers || []).map((st) => st.subject)),
    ].filter(Boolean);
  };

  // The table's subject columns. One class selected means that class's
  // subjects; "All" means the union across every class on screen, since one
  // shared column set has to cover rows from several classes at once.
  // Falls back to the branch catalog so a school that hasn't assigned any
  // subject teachers yet still sees a usable grid rather than no columns.
  const subjectColumns = useMemo(() => {
    const ids =
      classIdFilter === "All"
        ? [...new Set(filteredStudents.map((s) => s.class?._id || s.class))]
        : [classIdFilter];
    const names = [...new Set(ids.flatMap(subjectsOfClass))];
    return names.length > 0 ? names.sort() : branchSubjects;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classIdFilter, filteredStudents, classesById, branchSubjects]);

  const classFilterOptions = isTeacher
    ? classes.filter((c) => myClassIds.includes(c._id))
    : classes;

  const classOptionsForForm = classFilterOptions;
  const studentOptionsForForm = useMemo(() => {
    if (!form.class) return [];
    return visibleStudents.filter(
      (s) => (s.class?._id || s.class) === form.class,
    );
  }, [visibleStudents, form.class]);

  const getStudentMarks = (studentId) =>
    marks.filter(
      (m) => m.student_id === studentId && m.exam_type === examFilter,
    );

  const getSubjectMark = (studentId, subject) => {
    const m = marks.find(
      (x) =>
        x.student_id === studentId &&
        x.exam_type === examFilter &&
        x.subject === subject,
    );
    return m ? m.marks_obtained : null;
  };

  const getTotal = (studentId) =>
    getStudentMarks(studentId).reduce((s, m) => s + (m.marks_obtained || 0), 0);

  const getMax = (studentId) => getStudentMarks(studentId).length * 100;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Marks</h2>
          <p className="text-sm text-slate-500">
            {isTeacher
              ? "Your subject's marks - full overview for classes where you're Class Teacher"
              : "Academic performance records"}
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Marks
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={classIdFilter} onValueChange={setClassIdFilter}>
          <SelectTrigger className="w-48 text-sm">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Classes</SelectItem>
            {classFilterOptions.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {classLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={examFilter} onValueChange={setExamFilter}>
          <SelectTrigger className="w-36 text-sm">
            <SelectValue placeholder="Exam" />
          </SelectTrigger>
          <SelectContent>
            {EXAM_TYPES.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50">
                  Student
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Class
                </th>
                {subjectColumns.map((s) => (
                  <th
                    key={s}
                    className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase"
                  >
                    {s}
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Total
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">
                  %
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td
                    colSpan={subjectColumns.length + 5}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading &&
                filteredStudents.map((s) => {
                  const classId = s.class?._id || s.class;
                  const rowSeesAll = canSeeAllSubjectsForRow(classId);
                  const total = getTotal(s._id);
                  const maxTotal = getMax(s._id);
                  const pct =
                    maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
                  const grade = maxTotal > 0 ? getGrade(total, maxTotal) : "—";
                  return (
                    <tr key={s._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white">
                        {s.full_name}
                      </td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                        {classLabel(classesById[classId])}
                      </td>
                      {subjectColumns.map((subj) => {
                        const canSee = canSeeSubjectForRow(classId, subj);
                        const val = canSee ? getSubjectMark(s._id, subj) : null;
                        return (
                          <td
                            key={subj}
                            className="px-3 py-3 text-center text-slate-700"
                          >
                            {!canSee ? (
                              <Lock className="w-3.5 h-3.5 text-slate-300 inline" />
                            ) : val !== null ? (
                              val
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      {/* Total/%/Grade only shown for rows where this viewer
                          can see every subject: either they aren't a
                          Teacher, or they're the Class Teacher of this
                          student's class. A plain subject teacher only ever
                          sees their own subject's number. */}
                      <td className="px-3 py-3 text-center font-semibold text-slate-800">
                        {rowSeesAll ? total || "—" : "—"}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600">
                        {rowSeesAll && pct ? `${pct}%` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {rowSeesAll && grade !== "—" && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${gradeColor[grade] || ""}`}
                          >
                            {grade}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Marks Entry</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Class
              </label>
              <Select
                value={form.class}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    class: v,
                    student_id: "",
                    student_name: "",
                    subject: "", // reset - depends on the newly selected class
                  })
                }
              >
                <SelectTrigger className="text-sm w-full">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classOptionsForForm.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {classLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isTeacher && classOptionsForForm.length === 0 && (
                <p className="text-[11px] text-red-500 mt-1">
                  You aren't assigned to teach any class yet.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Student
              </label>
              <Select
                value={form.student_id}
                onValueChange={(v) => {
                  const s = studentOptionsForForm.find((st) => st._id === v);
                  setForm({
                    ...form,
                    student_id: v,
                    student_name: s?.full_name || "",
                  });
                }}
                disabled={!form.class}
              >
                <SelectTrigger className="text-sm w-full">
                  <SelectValue
                    placeholder={
                      form.class ? "Select student" : "Pick a class first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {studentOptionsForForm.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.class && studentOptionsForForm.length === 0 && (
                <p className="text-[11px] text-red-500 mt-1">
                  No students found in this class.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Exam Type
              </label>
              <Select
                value={form.exam_type}
                onValueChange={(v) => setForm({ ...form, exam_type: v })}
              >
                <SelectTrigger className="text-sm w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Subject
              </label>
              <Select
                value={form.subject}
                onValueChange={(v) => setForm({ ...form, subject: v })}
                disabled={isTeacher && !form.class}
              >
                <SelectTrigger className="text-sm w-full">
                  <SelectValue
                    placeholder={
                      isTeacher && !form.class
                        ? "Pick a class first"
                        : "Subject"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptionsForForm.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isTeacher &&
                form.class &&
                subjectOptionsForForm.length === 0 && (
                  <p className="text-[11px] text-red-500 mt-1">
                    You don't teach a valid Marks subject for this class.
                  </p>
                )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Marks Obtained
              </label>
              <Input
                type="number"
                value={form.marks_obtained}
                onChange={(e) =>
                  setForm({ ...form, marks_obtained: e.target.value })
                }
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Max Marks
              </label>
              <Input
                type="number"
                value={form.max_marks}
                onChange={(e) =>
                  setForm({ ...form, max_marks: e.target.value })
                }
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!canSubmitForm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
