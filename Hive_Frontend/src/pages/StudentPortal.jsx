// pages/StudentPortal.jsx
//
// UI-only page. Routed for the `student` role, but unreachable in practice:
// students are modelled to authenticate with User.unique_id while
// /api/auth/login only accepts an email-format identifier and looks accounts
// up by `email`. Until a student login path exists there is no live data to
// show, so the entityClient wiring was replaced with the placeholders below.
import React, { useState, useEffect } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Bell,
  GraduationCap,
  CheckCircle,
  XCircle,
  Search,
  LogOut,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TABS = [
  { key: "home", label: "🏠 Home" },
  { key: "homework", label: "📝 Homework" },
  { key: "attendance", label: "✅ Attendance" },
  { key: "marks", label: "📊 Marks" },
];

// Sample data so every tab, the unread badge, the <75% attendance warning and
// the empty states are all reachable without a backend.
const PLACEHOLDER_STUDENT = {
  _id: "ph-student",
  full_name: "Ananya Sharma",
  admission_no: "ADM-2026-001",
  class: "7",
  section: "B",
  roll_no: "17",
  parent_name: "Rajesh Sharma",
  parent_phone: "9848012345",
  dob: "2013-04-22",
  blood_group: "O+",
};

const PLACEHOLDER_NOTIFICATIONS = [
  {
    id: "hw-1",
    title: "Algebra worksheet 4",
    subject: "Maths",
    description: "Complete exercises 1-15 from the worksheet shared in class.",
    due_date: "2026-09-22",
    assigned_by: "Teacher",
    status: "Unread",
  },
  {
    id: "hw-2",
    title: "Read chapter 6 - The Solar System",
    subject: "Science",
    description: "Prepare a short summary for tomorrow's discussion.",
    due_date: "2026-09-19",
    assigned_by: "Teacher",
    status: "Read",
  },
];

const PLACEHOLDER_ATTENDANCE = Array.from({ length: 40 }, (_, i) => {
  const d = new Date(2026, 8, 15 - i);
  return {
    id: `att-${i}`,
    date: d.toISOString().split("T")[0],
    status: i % 9 === 0 ? "Absent" : i % 13 === 0 ? "Late" : "Present",
  };
});

const PLACEHOLDER_MARKS = [
  { id: "mk-1", subject: "Maths", exam_type: "Mid Term", marks_obtained: 82, max_marks: 100, grade: "A" },
  { id: "mk-2", subject: "Science", exam_type: "Mid Term", marks_obtained: 74, max_marks: 100, grade: "B" },
  { id: "mk-3", subject: "English", exam_type: "Mid Term", marks_obtained: 91, max_marks: 100, grade: "A+" },
  { id: "mk-4", subject: "Maths", exam_type: "Unit Test", marks_obtained: 44, max_marks: 50, grade: "A" },
  { id: "mk-5", subject: "Science", exam_type: "Unit Test", marks_obtained: 38, max_marks: 50, grade: "B+" },
];

export default function StudentPortal() {
  const [admissionNo, setAdmissionNo] = useState(
    () => localStorage.getItem("student_adm_no") || "",
  );
  const [searchInput, setSearchInput] = useState("");
  const [student, setStudent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [notifications, setNotifications] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Auto-login if stored
  useEffect(() => {
    if (admissionNo) loginStudent(admissionNo);
  }, []);

  // Placeholder sign-in: any admission number resolves to the sample student
  // below. The real flow can't run yet - students are modelled to log in with
  // User.unique_id, but /api/auth/login only accepts an email-format
  // identifier and looks the account up by `email`, so no student account can
  // authenticate at all (`unique_id` is never read anywhere in
  // authController.js). Until that exists this page has no live data source.
  const loginStudent = (adm) => {
    setLoading(true);
    setNotFound(false);
    if (!adm?.trim()) {
      setNotFound(true);
      setLoading(false);
      setStudent(null);
      localStorage.removeItem("student_adm_no");
      return;
    }
    setStudent({ ...PLACEHOLDER_STUDENT, admission_no: adm });
    localStorage.setItem("student_adm_no", adm);
    setLoading(false);
    loadStudentData();
  };

  // When this is wired up for real, the three datasets map to the student's
  // own records (the backend already enforces studentOwnOnly scoping):
  //   notifications -> /api/entities/HomeworkNotification, or a dedicated
  //                    homeworkApi route, filtered by the linked_student_id
  //   attendance    -> attendanceApi.list({ student_id })
  //   marks         -> marksApi.list({ student_id })
  // Note the old code filtered on `s.id`, which a .lean() result never has -
  // only `_id` - so every one of those lookups was scoped to undefined.
  const loadStudentData = () => {
    setDataLoading(true);
    setNotifications(PLACEHOLDER_NOTIFICATIONS);
    setAttendance(PLACEHOLDER_ATTENDANCE);
    setMarks(PLACEHOLDER_MARKS);
    setDataLoading(false);
  };

  const logout = () => {
    setStudent(null);
    setAdmissionNo("");
    localStorage.removeItem("student_adm_no");
    setNotifications([]);
    setAttendance([]);
    setMarks([]);
  };

  const unreadCount = notifications.filter((n) => n.status === "Unread").length;
  const presentDays = attendance.filter((a) => a.status === "Present").length;
  const totalDays = attendance.length;
  const attendancePct =
    totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  // Login screen
  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-900 via-[#0f172a] to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center mx-auto mb-4 text-3xl shadow-xl">
              🎒
            </div>
            <h1 className="text-2xl font-black text-white">Student Portal</h1>
            <p className="text-sm text-sky-300 mt-1">
              MasterMinds ERP · by Dominare Tech Pvt Ltd
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-sky-200 block mb-2">
                Enter Your Admission Number
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && loginStudent(searchInput)
                  }
                  placeholder="e.g. ADM-2024-001"
                  className="pl-9 bg-white/20 border-white/30 text-white placeholder:text-slate-400 focus:ring-sky-400"
                />
              </div>
              {notFound && (
                <p className="text-red-400 text-xs mt-2">
                  ❌ Admission number not found. Please check and try again.
                </p>
              )}
            </div>
            <Button
              onClick={() => loginStudent(searchInput)}
              disabled={loading || !searchInput.trim()}
              className="w-full bg-sky-500 hover:bg-sky-600 font-bold"
            >
              {loading ? "Searching..." : "🚀 Access My Portal"}
            </Button>
            <p className="text-xs text-center text-sky-400">
              Use your Admission Number to log in
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Portal
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-sky-600 to-indigo-700 px-4 py-4 text-white">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {student.full_name?.[0]}
            </div>
            <div>
              <p className="font-bold text-base">{student.full_name}</p>
              <p className="text-xs text-sky-200">
                {student.class} {student.section || ""} · Adm:{" "}
                {student.admission_no}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              </div>
            )}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab Nav */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? "border-sky-600 text-sky-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {dataLoading && (
          <p className="text-center py-8 text-slate-400 text-sm animate-pulse">
            Loading your data...
          </p>
        )}

        {/* HOME */}
        {!dataLoading && activeTab === "home" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Attendance",
                  value: `${attendancePct}%`,
                  sub: `${presentDays}/${totalDays} days`,
                  color: "bg-emerald-500",
                },
                {
                  label: "Subjects",
                  value: [...new Set(marks.map((m) => m.subject))].length,
                  sub: "recorded",
                  color: "bg-indigo-500",
                },
                {
                  label: "Homework",
                  value: notifications.length,
                  sub: `${unreadCount} unread`,
                  color: "bg-amber-500",
                },
              ].map(({ label, value, sub, color }) => (
                <div
                  key={label}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center"
                >
                  <div
                    className={`w-8 h-8 rounded-xl ${color} mx-auto mb-2 flex items-center justify-center`}
                  >
                    <span className="text-white text-xs font-bold">
                      {typeof value === "number" ? value : "~"}
                    </span>
                  </div>
                  <p className="text-xl font-black text-slate-800">{value}</p>
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className="text-[10px] text-slate-400">{sub}</p>
                </div>
              ))}
            </div>

            {/* Recent Homework */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">
                📝 Latest Homework
              </h3>
              {notifications.slice(0, 3).length === 0 ? (
                <p className="text-xs text-slate-400">
                  No homework assigned yet.
                </p>
              ) : (
                notifications.slice(0, 3).map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 mb-3 last:mb-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-sky-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {n.title}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {n.subject} · Due: {n.due_date || "Not set"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Profile */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">
                👤 My Profile
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Full Name", student.full_name],
                  ["Admission No", student.admission_no],
                  ["Class", `${student.class} ${student.section || ""}`],
                  ["Roll No", student.roll_no || "—"],
                  ["Father", student.parent_name || "—"],
                  ["Phone", student.parent_phone || "—"],
                  ["DOB", student.dob || "—"],
                  ["Blood Group", student.blood_group || "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-slate-400">{k}</p>
                    <p className="font-semibold text-slate-700">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HOMEWORK */}
        {!dataLoading && activeTab === "homework" && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700">
              {notifications.length} Homework Notifications
            </p>
            {notifications.length === 0 && (
              <p className="text-center py-10 text-slate-400">
                No homework yet! 🎉
              </p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 ${n.status === "Unread" ? "border-sky-300 bg-sky-50/50" : "border-slate-100"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-sky-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">
                          {n.title}
                        </p>
                        {n.status === "Unread" && (
                          <span className="w-2 h-2 bg-sky-500 rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-sky-600 font-semibold">
                        {n.subject}
                      </p>
                      {n.description && (
                        <p className="text-xs text-slate-500 mt-1">
                          {n.description}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">
                        📅 Due: {n.due_date || "Not set"} · By:{" "}
                        {n.assigned_by || "Teacher"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${n.status === "Unread" ? "bg-sky-200 text-sky-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {n.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ATTENDANCE */}
        {!dataLoading && activeTab === "attendance" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
              <p className="text-5xl font-black text-emerald-600">
                {attendancePct}%
              </p>
              <p className="text-sm text-slate-500 mt-1">Overall Attendance</p>
              <p className="text-xs text-slate-400">
                {presentDays} Present / {totalDays - presentDays} Absent /{" "}
                {totalDays} Total Days
              </p>
              <div className="h-2 bg-slate-100 rounded-full mt-4">
                <div
                  className="h-2 bg-emerald-500 rounded-full"
                  style={{ width: `${attendancePct}%` }}
                />
              </div>
              {attendancePct < 75 && (
                <p className="text-xs text-red-500 mt-2 font-semibold">
                  ⚠️ Attendance below 75% — please attend regularly!
                </p>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-700">
                  Attendance History
                </p>
              </div>
              <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                {attendance.slice(0, 30).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <p className="text-xs text-slate-600">{a.date}</p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.status === "Present" ? "bg-emerald-100 text-emerald-700" : a.status === "Late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
                {attendance.length === 0 && (
                  <p className="px-4 py-6 text-center text-slate-400 text-xs">
                    No attendance records
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MARKS */}
        {!dataLoading && activeTab === "marks" && (
          <div className="space-y-3">
            {[...new Set(marks.map((m) => m.exam_type))].map((examType) => (
              <div
                key={examType}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                  <p className="text-xs font-bold text-indigo-700">
                    {examType}
                  </p>
                </div>
                <div className="divide-y divide-slate-50">
                  {marks
                    .filter((m) => m.exam_type === examType)
                    .map((m) => {
                      const pct = Math.round(
                        (m.marks_obtained / m.max_marks) * 100,
                      );
                      return (
                        <div
                          key={m.id}
                          className="px-4 py-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-800">
                              {m.subject}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {m.marks_obtained}/{m.max_marks} marks
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-sm font-black ${pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}
                            >
                              {m.grade || pct + "%"}
                            </span>
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1">
                              <div
                                className={`h-1.5 rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
            {marks.length === 0 && (
              <p className="text-center py-10 text-slate-400">
                No marks recorded yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
