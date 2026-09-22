import React, { useState, useEffect } from "react";
import { marksApi, attendanceApi, classApi } from "@/api/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { TrendingUp, Users, ClipboardCheck } from "lucide-react";

// Class model only has `grade` (no separate `section`) — see models/Class.js.
const classLabel = (c) => (c ? `Class ${c.grade}` : "—");

export default function BPAnalytics() {
  const [classPerf, setClassPerf] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      marksApi.list(),
      attendanceApi.list({ sort: "-date", limit: 500 }),
      classApi.list(),
    ]).then(([marks, attendance, classes]) => {
      const classesById = Object.fromEntries(
        (Array.isArray(classes) ? classes : []).map((c) => [c._id, c]),
      );

      // --- Class Performance: avg marks per class ---
      // Marks.class is a real Class reference (an ObjectId), not a
      // readable string like "Class 5" - see models/Marks.js. Group by
      // the id, then resolve the label + sort order from the actual
      // Class doc (grade_order is computed server-side for exactly this).
      const classMap = {};
      marks.forEach((m) => {
        const classId = m.class?._id || m.class;
        if (!classId || !m.marks_obtained || !m.max_marks) return;
        if (!classMap[classId])
          classMap[classId] = { total: 0, max: 0, count: 0 };
        classMap[classId].total += m.marks_obtained;
        classMap[classId].max += m.max_marks;
        classMap[classId].count += 1;
      });
      const perfData = Object.entries(classMap)
        .map(([classId, v]) => {
          const cls = classesById[classId];
          return {
            class: classLabel(cls),
            gradeOrder: cls?.grade_order ?? 999,
            avgPercent: Math.round((v.total / v.max) * 100),
          };
        })
        .sort((a, b) => a.gradeOrder - b.gradeOrder);
      setClassPerf(perfData);

      // --- Attendance Trend: last 14 days present % ---
      const today = new Date();
      const days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (13 - i));
        return d.toISOString().split("T")[0];
      });

      const trendData = days
        .map((date) => {
          // Normalize both sides to YYYY-MM-DD - a.date may come back as
          // a full ISO timestamp rather than a bare date string.
          const dayRecs = attendance.filter(
            (a) => String(a.date).slice(0, 10) === date,
          );
          const total = dayRecs.length;
          const present = dayRecs.filter((a) => a.status === "Present").length;
          return {
            date: date.slice(5), // MM-DD
            present: total > 0 ? Math.round((present / total) * 100) : null,
            total,
          };
        })
        .filter((d) => d.total > 0);

      setAttendanceTrend(trendData);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <div className="p-6 flex items-center justify-center h-64 text-slate-400">
        Loading analytics...
      </div>
    );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" /> Analytics
        </h1>
        <p className="text-sm text-slate-500">
          Class performance and attendance trends
        </p>
      </div>

      {/* Class Performance */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700">
            Average Marks % by Class
          </h2>
        </div>
        {classPerf.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">
            No marks data available yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={classPerf}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="class" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#64748b" }}
                unit="%"
              />
              <Tooltip
                formatter={(v) => [`${v}%`, "Avg Score"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar
                dataKey="avgPercent"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                name="Avg %"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Attendance Trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-700">
            Attendance % — Last 14 Days
          </h2>
        </div>
        {attendanceTrend.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">
            No attendance data available yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={attendanceTrend}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#64748b" }}
                unit="%"
              />
              <Tooltip
                formatter={(v) => [`${v}%`, "Attendance"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="present"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#10b981" }}
                name="Present %"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
