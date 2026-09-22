// components/bp/StudentProfile.jsx
//
// UI-only component - nothing renders it today. The old entityClient wiring
// (Attendance/FeePayment/Marks filtered by student_id) was removed; it also
// filtered on `student.id`, which does not exist on a .lean() result (only
// `_id` does), so every lookup was silently scoped to undefined - the same
// bug StudentReceipt.jsx already carries a comment about.
//
// When this is wired up for real, the three datasets below map to:
//   attendance -> attendanceApi.list({ student_id })
//   fees       -> feeApi.listPayments({ student_id })
//   marks      -> marksApi.list({ student_id })
// all of which are branch-scoped server-side, unlike /api/entities.
import React from "react";
import { ArrowLeft, User } from "lucide-react";
import StatusBadge from "./StatusBadge";

const PLACEHOLDER_ATTENDANCE = [
  ...Array.from({ length: 42 }, (_, i) => ({
    id: `att-${i}`,
    status: i % 7 === 0 ? "Absent" : "Present",
  })),
];

const PLACEHOLDER_FEES = [
  { id: "fee-1", amount: 24000, status: "Paid" },
  { id: "fee-2", amount: 12000, status: "Paid" },
  { id: "fee-3", amount: 8000, status: "Pending" },
];

const PLACEHOLDER_MARKS = [
  { id: "mk-1", subject: "Maths", exam_type: "Mid Term", marks_obtained: 82, max_marks: 100, grade: "A" },
  { id: "mk-2", subject: "Science", exam_type: "Mid Term", marks_obtained: 74, max_marks: 100, grade: "B" },
  { id: "mk-3", subject: "English", exam_type: "Mid Term", marks_obtained: 91, max_marks: 100, grade: "A+" },
];

export default function StudentProfile({ student, onBack }) {
  const attendance = PLACEHOLDER_ATTENDANCE;
  const fees = PLACEHOLDER_FEES;
  const marks = PLACEHOLDER_MARKS;

  const present = attendance.filter((a) => a.status === "Present").length;
  const attPct =
    attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;
  const totalFee = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paidFee = fees
    .filter((f) => f.status === "Paid")
    .reduce((s, f) => s + (f.amount || 0), 0);
  const totalMarks = marks.reduce((s, m) => s + (m.marks_obtained || 0), 0);
  const maxMarks = marks.reduce((s, m) => s + (m.max_marks || 0), 0);
  const pct = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;

  const fields = [
    ["Admission No", student.admission_no],
    ["Class", `Class ${student.class}`],
    ["Section", student.section],
    ["Roll No", student.roll_no],
    ["Gender", student.gender],
    ["Blood Group", student.blood_group],
    ["Date of Birth", student.dob],
    ["City", student.city],
    ["Parent Name", student.parent_name],
    ["Parent Phone", student.parent_phone],
    ["Parent Email", student.parent_email],
    ["Joining Date", student.joining_date],
    ["Address", student.address],
  ];

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Students
      </button>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt=""
                className="w-16 h-16 rounded-xl object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-emerald-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-800">
                {student.full_name}
              </h2>
              <StatusBadge value={student.status} />
            </div>
            <p className="text-sm text-slate-500">
              {student.admission_no} · Class {student.class} {student.section}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
          {fields.map(
            ([label, val]) =>
              val && (
                <div key={label}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-sm font-medium text-slate-700">{val}</p>
                </div>
              ),
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{attPct}%</p>
          <p className="text-xs text-slate-500 mt-1">Attendance</p>
          <p className="text-xs text-slate-400">
            {present}/{attendance.length} days
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{pct}%</p>
          <p className="text-xs text-slate-500 mt-1">Academic Score</p>
          <p className="text-xs text-slate-400">
            {totalMarks}/{maxMarks} marks
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">
            ₹{paidFee.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-slate-500 mt-1">Fee Paid</p>
          <p className="text-xs text-slate-400">
            of ₹{totalFee.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {marks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Marks Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">
                    Subject
                  </th>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">
                    Exam
                  </th>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">
                    Marks
                  </th>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marks.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 text-slate-700">{m.subject}</td>
                    <td className="px-3 py-2 text-slate-500">{m.exam_type}</td>
                    <td className="px-3 py-2 font-medium">
                      {m.marks_obtained}/{m.max_marks}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={m.grade} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
