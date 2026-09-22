import React from "react";

const configs = {
  Active: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  Paid: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  Present: "bg-emerald-100 text-emerald-700",
  Admitted: "bg-emerald-100 text-emerald-700",
  admitted: "bg-emerald-100 text-emerald-700",
  Pending: "bg-red-100 text-red-700",
  pending: "bg-red-100 text-red-700",
  Absent: "bg-red-100 text-red-700",
  Inactive: "bg-red-100 text-red-700",
  inactive: "bg-red-100 text-red-700",
  Rejected: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
  Applied: "bg-blue-100 text-blue-700",
  applied: "bg-blue-100 text-blue-700",
  Late: "bg-amber-100 text-amber-700",
  "Pending Approval": "bg-amber-100 text-amber-700",
  Enquiry: "bg-slate-100 text-slate-600",
  enquiry: "bg-slate-100 text-slate-600",
  Teacher: "bg-indigo-100 text-indigo-700",
  Admin: "bg-purple-100 text-purple-700",
  Support: "bg-teal-100 text-teal-700",
};

export default function StatusBadge({ value }) {
  const cls = configs[value] || "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {value}
    </span>
  );
}
