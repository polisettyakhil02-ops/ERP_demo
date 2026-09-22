import React, { useState, useEffect } from "react";
import { analyticsApi, branchApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { MapPin, Users, IndianRupee, TrendingUp } from "lucide-react";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const monthLabel = (item) =>
  `${MONTH_NAMES[item._id.m - 1]} '${String(item._id.y).slice(2)}`;

export default function AccountsManagerDashboard() {
  const { user } = useAuth();
  const [branch, setBranch] = useState(null);
  const [overview, setOverview] = useState(null);
  const [feesSummary, setFeesSummary] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // branchApi.list() is already scoped to the caller's own branch when
    // req.user.branch is set (see controllers/branchController.js) - an
    // accounts_manager gets back just their one branch, no dropdown needed.
    Promise.all([
      branchApi.list(),
      analyticsApi.overview(),
      analyticsApi.feesSummary(),
      analyticsApi.academicPerformance(),
    ]).then(([branches, ov, fees, perf]) => {
      setBranch(branches?.[0] || null);
      setOverview(ov);
      setFeesSummary(fees);
      setPerformance(perf);
      setLoading(false);
    });
  }, []);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  const feeByMonth = (feesSummary?.by_month || []).map((m) => ({
    month: monthLabel(m),
    amount: Math.round(m.total / 1000),
  }));

  const paid =
    feesSummary?.by_status?.find((s) => s._id === "Paid")?.total || 0;
  const pending =
    feesSummary?.by_status?.find((s) => s._id === "Pending")?.total || 0;
  const pieData = [
    { name: "Collected", value: paid },
    { name: "Pending", value: pending },
  ];

  const overallPerformance = (() => {
    const bySubject = performance?.by_subject || [];
    const totalCount = bySubject.reduce((sum, s) => sum + s.count, 0);
    if (!totalCount) return null;
    const weighted = bySubject.reduce((sum, s) => sum + s.avg_pct * s.count, 0);
    return Math.round(weighted / totalCount);
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      {/* Header - no branch switcher; an accounts manager only ever sees
          their own branch (see analyticsController.js scopeFor). */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            Account Consultant
          </h1>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
            Viewing:{" "}
            <span className="font-semibold text-indigo-600">
              {branch?.name || "Your branch"}
            </span>
          </p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Students",
            value: overview?.total_students?.toLocaleString("en-IN") ?? "0",
            icon: Users,
            color: "bg-indigo-500",
          },
          {
            label: "Total Income (This Month)",
            value: fmt(overview?.total_income_this_month),
            sub: `Fee Payments ${fmt(overview?.fee_collected_this_month)} · Other ${fmt(overview?.other_income_this_month)}`,
            icon: IndianRupee,
            color: "bg-emerald-500",
          },
          {
            label: "Fee Pending",
            value: fmt(overview?.fee_pending),
            icon: TrendingUp,
            color: "bg-amber-500",
          },
          {
            label: "Total Staff",
            value: overview?.total_staff?.toLocaleString("en-IN") ?? "0",
            icon: Users,
            color: "bg-violet-500",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} mb-3`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl font-black text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Branch detail panel */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
        <p className="text-sm font-semibold text-indigo-200 mb-4">
          📍 {branch?.name || "Your Branch"} — Detailed View
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Active Students", value: overview?.active_students ?? 0 },
            {
              label: "Present Today",
              value: overview?.today_attendance?.present ?? 0,
            },
            {
              label: "Absent Today",
              value: overview?.today_attendance?.absent ?? 0,
            },
            {
              label: "Pending Admissions",
              value: overview?.pending_admissions ?? 0,
            },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-xl font-black">{value}</p>
              <p className="text-xs text-indigo-200 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {overallPerformance !== null && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-indigo-200 mb-1.5">
              <span>Academic Performance (avg across subjects)</span>
              <span>{overallPerformance}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full">
              <div
                className="h-2 bg-white rounded-full transition-all"
                style={{ width: `${overallPerformance}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">
            Fee Collected by Month (₹ thousands)
          </h3>
          {feeByMonth.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-14">
              No fee payment data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={feeByMonth} barSize={18}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`₹${v}k`, "Collected"]} />
                <Bar
                  dataKey="amount"
                  name="Collected"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col items-center">
          <h3 className="text-sm font-bold text-slate-700 mb-4 self-start">
            Fee Collection Status
          </h3>
          {paid === 0 && pending === 0 ? (
            <p className="text-sm text-slate-400 text-center py-14">
              No fee data yet.
            </p>
          ) : (
            <>
              <PieChart width={160} height={160}>
                <Pie
                  data={pieData}
                  cx={75}
                  cy={75}
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#10b981" : "#f59e0b"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Collected
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Pending
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
