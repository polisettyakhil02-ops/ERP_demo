import React, { useState, useEffect, useMemo } from "react";
import { homeworkApi, studentApi, classApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Bell, BookOpen, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSubjects, withSelectedSubject } from "@/lib/useSubjects";

// Fallback subject list for non-teacher roles, who aren't restricted to a
// personal subject/class assignment. A teacher instead only ever sees the
// subjects they actually teach in the selected class (see
// subjectOptionsForForm below).
// The nine-name FALLBACK_SUBJECTS array that used to live here is gone -
// non-teacher roles pick from the branch's Subject catalog now (see
// lib/useSubjects.js). A teacher still picks only from their own
// assignments for the chosen class, which is what homeworkController
// authorises against.

// Class model only has `grade` (no separate `section`) — see models/Class.js.
const classLabel = (c) => (c ? `Class ${c.grade}` : "—");

const fmtDate = (d) => {
  if (!d) return "Not set";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// `class` is a Class _id now (not a free-text string like "Class 5"), and
// there's no `section` field on Homework anymore. `assigned_by` isn't
// collected from the form at all - the server sets it from the logged-in
// user, since it's a User reference, not free text.
const EMPTY = {
  title: "",
  subject: "",
  class: "",
  description: "",
  due_date: "",
};

export default function HomeworkManager() {
  const { user } = useAuth();
  const role = user?.role;
  const isTeacher = role === "teacher";
  const myId = user?.id || user?._id;
  const { subjects: branchSubjects } = useSubjects();

  const [classes, setClasses] = useState([]);
  useEffect(() => {
    classApi.list().then((data) => setClasses(data.data));
  }, []);

  // class_id -> [subjects this teacher teaches there], read from each
  // Class's own `subject_teachers` (the single source of truth - see
  // models/Class.js). Non-teacher roles aren't restricted at all.
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
      if (subjects.length > 0) map[c._id] = subjects;
    });
    return map;
  }, [classes, isTeacher, myId]);

  // Classes a teacher can even pick from - anywhere they teach at least
  // one subject. Non-teacher roles see every class in the branch.
  const visibleClasses = useMemo(
    () =>
      isTeacher ? classes.filter((c) => mySubjectsByClassId[c._id]) : classes,
    [classes, isTeacher, mySubjectsByClassId],
  );

  const [homeworks, setHomeworks] = useState([]);
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [notifyingId, setNotifyingId] = useState(null);
  const [filterClass, setFilterClass] = useState("All");
  const { toast } = useToast();

  const load = () =>
    Promise.all([
      homeworkApi.list({ sort: "-created_date", limit: 50 }),
      studentApi.list(),
    ]).then(([h, s]) => {
      setHomeworks(h);
      setStudents(s);
    });

  useEffect(() => {
    load();
  }, []);

  // Subjects selectable in the form for the currently-chosen class -
  // always the teacher's own subject(s) for that class; unrestricted for
  // non-teacher roles.
  const subjectOptionsForForm = useMemo(() => {
    if (!isTeacher) return withSelectedSubject(branchSubjects, form.subject);
    if (!form.class) return [];
    return mySubjectsByClassId[form.class] || [];
  }, [isTeacher, form.class, form.subject, mySubjectsByClassId, branchSubjects]);

  const canSubmitForm =
    form.title &&
    form.class &&
    form.subject &&
    form.due_date &&
    (!isTeacher || subjectOptionsForForm.includes(form.subject));

  const save = async () => {
    if (!canSubmitForm) return;
    setSaving(true);
    try {
      const classDoc = classes.find((c) => c._id === form.class);
      await homeworkApi.create({ ...form, status: "Active" });
      setForm({ ...EMPTY });
      setShowForm(false);
      await load();
      toast({
        title: "✅ Homework Added",
        description: `"${form.title}" saved for ${classLabel(classDoc)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const notifyStudents = async (hw) => {
    setNotifyingId(hw.id || hw._id);
    try {
      const { notified } = await homeworkApi.notify(hw.id || hw._id);
      if (notified === 0) {
        toast({
          title: "⚠️ No students found",
          description: `No active students found in ${classLabel(hw.class)}`,
        });
      } else {
        toast({
          title: "🔔 Notifications Sent!",
          description: `Notified ${notified} students in ${classLabel(hw.class)} about "${hw.title}"`,
        });
      }
    } finally {
      setNotifyingId(null);
    }
  };

  const deleteHw = async (id) => {
    await homeworkApi.remove(id);
    await load();
  };

  const filtered =
    filterClass === "All"
      ? homeworks
      : homeworks.filter((h) => (h.class?._id || h.class) === filterClass);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Homework Manager</h2>
          <p className="text-sm text-slate-500">
            Assign homework & notify students
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-sky-600 hover:bg-sky-700 gap-2"
        >
          <Plus className="w-4 h-4" /> Add Homework
        </Button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-700">
            New Homework Assignment
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-3">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Title *
              </label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="e.g. Chapter 3 Exercise 5"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Class *
              </label>
              <Select
                value={form.class}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, class: v, subject: "" }))
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {visibleClasses.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {classLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isTeacher && visibleClasses.length === 0 && (
                <p className="text-[11px] text-red-500 mt-1">
                  You aren't assigned to teach any class yet.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Subject *
              </label>
              <Select
                value={form.subject}
                onValueChange={(v) => setForm((p) => ({ ...p, subject: v }))}
                disabled={isTeacher && !form.class}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue
                    placeholder={
                      isTeacher && !form.class
                        ? "Pick a class first"
                        : "Select Subject"
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
                    You don't teach a subject for this class.
                  </p>
                )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Due Date *
              </label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, due_date: e.target.value }))
                }
                className="text-sm"
              />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Description / Instructions
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Write homework instructions here..."
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving || !canSubmitForm}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {saving ? "Saving..." : "Save Homework"}
            </Button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Classes</SelectItem>
            {visibleClasses.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {classLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-slate-500">{filtered.length} assignments</p>
      </div>

      {/* Homework List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-center py-10 text-slate-400">
            No homework assigned yet.
          </p>
        )}
        {filtered.map((hw) => (
          <div
            key={hw.id || hw._id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-slate-800">{hw.title}</p>
                  <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-semibold">
                    {hw.subject}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                    {classLabel(hw.class)}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${hw.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {hw.status}
                  </span>
                </div>
                {hw.description && (
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">
                    {hw.description}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Due: {fmtDate(hw.due_date)} · By:{" "}
                  {hw.assigned_by?.full_name || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => notifyStudents(hw)}
                disabled={notifyingId === (hw.id || hw._id)}
                className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 text-xs"
              >
                <Bell className="w-3.5 h-3.5" />
                {notifyingId === (hw.id || hw._id)
                  ? "Notifying..."
                  : "Notify Students"}
              </Button>
              <button
                onClick={() => deleteHw(hw.id || hw._id)}
                className="text-slate-300 hover:text-red-500 transition-colors p-1.5"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
