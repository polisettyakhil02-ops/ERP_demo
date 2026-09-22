import React, { useState, useEffect, useMemo } from "react";
import { studentApi, classApi, attendanceApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useSubjects } from "@/lib/useSubjects";

// The six-name FALLBACK_SUBJECTS array that used to live here is gone -
// subjects come from the branch's Subject catalog now (lib/useSubjects.js).
// This page only ever offered the list to non-teacher roles; a teacher
// still picks from their own class assignments (myOptions below), which is
// what attendanceController authorises against.

const fmtDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Class model only has `grade` (no separate `section`) — see models/Class.js.
const classLabel = (c) => (c ? `Class ${c.grade}` : "—");

export default function BPAttendance() {
  const { user } = useAuth();
  const role = user?.role;
  const isTeacher = role === "teacher";
  const myId = user?.id || user?._id;

  const [classes, setClasses] = useState([]); // every Class doc in the branch
  const [classesLoaded, setClassesLoaded] = useState(false);

  useEffect(() => {
    classApi.list().then((data) => {
      setClasses(data.data);
      setClassesLoaded(true);
    });
  }, []);

  // Keyed by `_id` — the class documents coming back from the API don't
  // have an `id` alias, only the raw Mongo `_id`.
  const classesById = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(classes) ? classes : []).map((c) => [c._id, c]),
      ),
    [classes],
  );

  const myOptions = useMemo(() => {
    if (!isTeacher) return [];
    const options = [];
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
      subjects.forEach((subject) => {
        options.push({
          key: `${c._id}-${subject}`,
          class_id: c._id,
          subject,
        });
      });
    });
    return options;
  }, [classes, isTeacher, myId]);

  // Classes where Class.class_teacher_id === this teacher - the ONLY source
  // of truth for "am I the Class Teacher of X" (see models/Class.js).
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
  const isClassTeacherOfAny = classTeacherClassIds.length > 0;

  const [tab, setTab] = useState("mark");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [existing, setExisting] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [monthlyData, setMonthlyData] = useState([]);

  // --- Selection state -----------------------------------------------
  const [selectedKey, setSelectedKey] = useState("");
  const [classIdFilter, setClassIdFilter] = useState(""); // Principal/Admin Officer path
  const { subjects: branchSubjects } = useSubjects();
  // Starts empty rather than on a hard-coded first entry - the real list
  // arrives asynchronously, and the effect below picks the first one once
  // it does.
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    if (!subjectFilter && branchSubjects.length > 0) {
      setSubjectFilter(branchSubjects[0]);
    }
  }, [branchSubjects, subjectFilter]);

  useEffect(() => {
    if (isTeacher && !selectedKey && myOptions.length > 0) {
      setSelectedKey(myOptions[0].key);
    }
    if (!isTeacher && !classIdFilter && classes.length > 0) {
      setClassIdFilter(classes[0]._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, myOptions, classes]);

  const selectedAssignment = isTeacher
    ? myOptions.find((o) => o.key === selectedKey) || null
    : null;

  const activeClassId = isTeacher
    ? selectedAssignment?.class_id
    : classIdFilter || null;
  const activeSubject = isTeacher ? selectedAssignment?.subject : subjectFilter;
  const activeClassDoc = activeClassId ? classesById[activeClassId] : null;

  useEffect(() => {
    studentApi.list().then((data) => {
      setStudents(data.filter((s) => s.status === "Active"));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (tab === "monthly") {
      loadMonthly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!activeClassId || !activeSubject) return;
    attendanceApi
      .list({ date, subject: activeSubject, class_id: activeClassId })
      .then((data) => {
        setExisting(data);
        const map = {};
        data.forEach((a) => {
          map[a.student_id] = a.status;
        });
        setAttendance(map);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, activeClassId, activeSubject]);

  const loadMonthly = async () => {
    // No filters: server scopes this automatically. A teacher only gets
    // back attendance for classes they are Class Teacher of; Principal /
    // Admin Officer get the full branch-wide dataset.
    const data = await attendanceApi.list();
    setMonthlyData(data);
  };

  // Students belonging to the currently selected class.
  const filtered = students.filter(
    (s) => (s.class?._id || s.class) === activeClassId,
  );

  const setStatus = (id, status) =>
    setAttendance((prev) => ({ ...prev, [id]: status }));

  const saveAttendance = async () => {
    if (!activeClassId || !activeSubject) return;
    setSaving(true);
    try {
      const records = filtered.map((s) => ({
        student_id: s._id,
        student_name: s.full_name,
        status: attendance[s._id] || "Present",
      }));
      const updated = await attendanceApi.bulkMark({
        class_id: activeClassId,
        subject: activeSubject,
        date,
        records,
      });
      setExisting(updated);
    } finally {
      setSaving(false);
    }
  };

  const present = filtered.filter(
    (s) => (attendance[s._id] || "Present") === "Present",
  ).length;
  const absent = filtered.filter((s) => attendance[s._id] === "Absent").length;
  const late = filtered.filter((s) => attendance[s._id] === "Late").length;

  const getMonthlyPct = (studentId) => {
    const records = monthlyData.filter((a) => a.student_id === studentId);
    if (!records.length) return 0;
    const p = records.filter((a) => a.status === "Present").length;
    return Math.round((p / records.length) * 100);
  };

  // --- Class Analytics ("monthly" tab) visibility & scope -------------
  // A regular subject teacher does not get the class-wide analytics view -
  // only the Class Teacher of a class can see it, and even then only for
  // the class(es) they are Class Teacher of.
  const canSeeAnalytics = !isTeacher || isClassTeacherOfAny;

  const [analyticsClassId, setAnalyticsClassId] = useState("");
  useEffect(() => {
    if (isTeacher && !analyticsClassId && classTeacherClassIds.length > 0) {
      setAnalyticsClassId(classTeacherClassIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, classTeacherClassIds]);

  const analyticsStudents = useMemo(() => {
    let pool = students.filter((s) => s.status === "Active");
    if (isTeacher) {
      pool = pool.filter((s) =>
        classTeacherClassIds.includes(s.class?._id || s.class),
      );
      if (analyticsClassId) {
        pool = pool.filter(
          (s) => (s.class?._id || s.class) === analyticsClassId,
        );
      }
    }
    return pool;
  }, [students, isTeacher, classTeacherClassIds, analyticsClassId]);

  if (isTeacher && classesLoaded && myOptions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        You haven't been assigned any class or subject yet. Contact your
        Principal / Admin Officer to get your teaching assignments set up
        (Classes screen).
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Attendance</h2>
          <p className="text-sm text-slate-500">
            Mark and view student attendance
          </p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setTab("mark")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "mark" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
          >
            Mark Attendance
          </button>
          {canSeeAnalytics && (
            <button
              onClick={() => setTab("monthly")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "monthly" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
            >
              {isTeacher ? "Class Analytics" : "Monthly View"}
            </button>
          )}
        </div>
      </div>

      {tab === "mark" && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40 text-sm"
            />

            {isTeacher ? (
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger className="w-64 text-sm">
                  <SelectValue placeholder="Class / Subject" />
                </SelectTrigger>
                <SelectContent>
                  {myOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {classLabel(classesById[o.class_id])} — {o.subject}
                      {classTeacherClassIds.includes(o.class_id)
                        ? " (Class Teacher)"
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Select value={classIdFilter} onValueChange={setClassIdFilter}>
                  <SelectTrigger className="w-48 text-sm">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {classLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-40 text-sm">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchSubjects.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <Button
              onClick={saveAttendance}
              disabled={saving || !activeClassId || !activeSubject}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5 ml-auto"
            >
              <Save className="w-4 h-4" />{" "}
              {saving ? "Saving..." : "Save Attendance"}
            </Button>
          </div>

          <div className="flex gap-4">
            {[
              {
                label: "Present",
                count: present,
                color: "bg-emerald-100 text-emerald-700",
              },
              {
                label: "Absent",
                count: absent,
                color: "bg-red-100 text-red-700",
              },
              {
                label: "Late",
                count: late,
                color: "bg-amber-100 text-amber-700",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`px-4 py-2 rounded-lg ${s.color} text-sm font-medium`}
              >
                {s.label}: {s.count}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Class
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Subject
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!loading && !activeSubject && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        Pick a class and subject to take attendance.
                      </td>
                    </tr>
                  )}
                  {filtered.map((s) => {
                    const status = attendance[s._id] || "Present";
                    return (
                      <tr key={s._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {s.full_name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {classLabel(activeClassDoc)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {activeSubject}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {fmtDate(date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {["Present", "Absent", "Late", "Leave"].map(
                              (opt) => (
                                <button
                                  key={opt}
                                  onClick={() => setStatus(s._id, opt)}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                                    status === opt
                                      ? opt === "Present"
                                        ? "bg-emerald-500 text-white border-emerald-500"
                                        : opt === "Absent"
                                          ? "bg-red-500 text-white border-red-500"
                                          : opt === "Late"
                                            ? "bg-amber-500 text-white border-amber-500"
                                            : "bg-slate-500 text-white border-slate-500"
                                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ),
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "monthly" && canSeeAnalytics && (
        <>
          {isTeacher && (
            <div className="flex gap-3">
              <Select
                value={analyticsClassId}
                onValueChange={setAnalyticsClassId}
              >
                <SelectTrigger className="w-56 text-sm">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  {classTeacherClassIds.map((cid) => (
                    <SelectItem key={cid} value={cid}>
                      {classLabel(classesById[cid])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 self-center">
                Showing analytics for classes where you are the Class Teacher.
              </p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Student
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Class
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Attendance %
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Bar
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analyticsStudents.map((s) => {
                    const pct = getMonthlyPct(s._id);
                    const cDoc = classesById[s.class?._id || s.class];
                    return (
                      <tr key={s._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {s.full_name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {classLabel(cDoc)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {pct}%
                        </td>
                        <td className="px-4 py-3 w-48">
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
