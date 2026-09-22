import React from "react";

export default function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}) {
  const colorMap = {
    indigo: {
      bg: "bg-indigo-50",
      icon: "bg-indigo-100 text-indigo-600",
      text: "text-indigo-700",
    },
    green: {
      bg: "bg-green-50",
      icon: "bg-green-100 text-green-600",
      text: "text-green-700",
    },
    amber: {
      bg: "bg-amber-50",
      icon: "bg-amber-100 text-amber-600",
      text: "text-amber-700",
    },
    rose: {
      bg: "bg-rose-50",
      icon: "bg-rose-100 text-rose-600",
      text: "text-rose-700",
    },
    sky: {
      bg: "bg-sky-50",
      icon: "bg-sky-100 text-sky-600",
      text: "text-sky-700",
    },
    purple: {
      bg: "bg-purple-50",
      icon: "bg-purple-100 text-purple-600",
      text: "text-purple-700",
    },
    teal: {
      bg: "bg-teal-50",
      icon: "bg-teal-100 text-teal-600",
      text: "text-teal-700",
    },
    orange: {
      bg: "bg-orange-50",
      icon: "bg-orange-100 text-orange-600",
      text: "text-orange-700",
    },
  };

  const c = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={`${c.bg} rounded-2xl p-5 flex items-start gap-4 shadow-sm border border-white/80 animate-fade-in`}
    >
      {Icon && (
        <div className={`${c.icon} rounded-xl p-2.5 shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 mb-1">{title}</p>
        <p className={`text-2xl font-bold ${c.text} leading-tight`}>{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
