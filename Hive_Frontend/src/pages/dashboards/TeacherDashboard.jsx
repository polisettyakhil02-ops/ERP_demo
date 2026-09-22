import React, { useState, useEffect, useMemo } from "react";
import { studentApi, attendanceApi, marksApi, classApi } from "@/api/api";
import { Link } from "react-router-dom";
import {
  Users,
  ClipboardCheck,
  BookOpen,
  Cake,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

const fmt = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

// Class model only has `grade` (no separate `section`) — see models/Class.js.
const classLabel = (c) => (c ? `Class ${c.grade}` : "—");

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("All");

  useEffect(() => {
    const todayISO = new Date().toISOString().split("T")[0];
    Promise.all([
      studentApi.list(),
      attendanceApi.list({ date: todayISO }),
      marksApi.list({ sort: "-created_date", limit: 20 }),
      classApi.list(),
    ]).then(([s, a, m, c]) => {
      setStudents(s);
      setAttendance(a);
      setMarks(m);
      setClasses(c.data);
      setLoading(false);
    });
  }, []);

  // Keyed by `_id` — Class docs don't have an `id` alias, only the raw
  // Mongo `_id` (see models/Class.js).
  const classesById = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(classes) ? classes : []).map((c) => [c._id, c]),
      ),
    [classes],
  );

  // Student.class_id is a reference to Class (possibly populated), not a
  // free-text string — matches the convention used across Attendance/Marks.
  const studentClassId = (s) => s.class;
  const today = new Date();
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const birthdays = students.filter((s) => {
    if (!s.dob) return false;
    return s.dob.slice(5) === todayMMDD;
  });

  // Distinct classes actually present among the (already role-scoped)
  // student list, labelled from the real Class docs.
  const classOptions = useMemo(() => {
    const ids = [...new Set(students.map(studentClassId).filter(Boolean))];
    return ids
      .map((id) => ({ id, label: classLabel(classesById[id]) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [students, classesById]);

  const filteredStudents =
    selectedClass === "All"
      ? students
      : students.filter((s) => studentClassId(s) === selectedClass);

  const presentToday = attendance.filter((a) => a.status === "Present").length;
  const absentToday = attendance.filter((a) => a.status === "Absent").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">Teacher Portal</h1>
        <p className="text-sm text-slate-500">Today: {today.toDateString()}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Students",
            value: loading ? "..." : students.length,
            icon: Users,
            color: "bg-indigo-500",
          },
          {
            label: "Present Today",
            value: loading ? "..." : presentToday,
            icon: CheckCircle,
            color: "bg-emerald-500",
          },
          {
            label: "Absent Today",
            value: loading ? "..." : absentToday,
            icon: XCircle,
            color: "bg-red-500",
          },
          {
            label: "Birthdays Today",
            value: loading ? "..." : birthdays.length,
            icon: Cake,
            color: "bg-pink-500",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} mb-3`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-black text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Student List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">Students</h3>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none"
            >
              <option value="All">All</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-y-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {["Name", "Adm No", "Class", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.slice(0, 20).map((s) => (
                  <tr key={s.id || s._id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800 text-xs">
                      {s.full_name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {s.admission_no}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">
                      {classLabel(classesById[studentClassId(s)])}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-slate-400 text-xs"
                    >
                      Loading...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Birthdays */}
          <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl border border-pink-100 p-5">
            <h3 className="text-sm font-bold text-pink-700 mb-3">
              🎂 Birthdays Today
            </h3>
            {birthdays.length === 0 ? (
              <p className="text-xs text-pink-400">No birthdays today</p>
            ) : (
              birthdays.map((s) => (
                <div
                  key={s.id || s._id}
                  className="flex items-center gap-2 mb-2"
                >
                  <div className="w-7 h-7 rounded-full bg-pink-200 flex items-center justify-center text-xs font-bold text-pink-600">
                    {s.full_name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {s.full_name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {classLabel(classesById[studentClassId(s)])}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Marks */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Recent Marks Entered
            </h3>
            <div className="space-y-2">
              {marks.slice(0, 5).map((m) => (
                <div
                  key={m.id || m._id}
                  className="flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-700 truncate max-w-[110px]">
                      {m.student_name}
                    </p>
                    <p className="text-slate-400">
                      {m.subject} · {m.exam_type}
                    </p>
                  </div>
                  <span className="font-bold text-indigo-600">
                    {m.marks_obtained}/{m.max_marks}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Mark Attendance",
            icon: ClipboardCheck,
            to: "/attendance",
            color: "bg-teal-50 text-teal-700",
          },
          {
            label: "Enter Marks",
            icon: BookOpen,
            to: "/marks",
            color: "bg-indigo-50 text-indigo-700",
          },
          {
            label: "Homework Manager",
            icon: BookOpen,
            to: "/homework-manager",
            color: "bg-amber-50 text-amber-700",
          },
          {
            label: "Hall Tickets",
            icon: Users,
            to: "/hall-ticket",
            color: "bg-rose-50 text-rose-700",
          },
          {
            label: "Student List",
            icon: Users,
            to: "/students",
            color: "bg-violet-50 text-violet-700",
          },
        ].map(({ label, icon: Icon, to, color }) => (
          <Link
            key={label}
            to={to}
            className={`${color} rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-semibold">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
