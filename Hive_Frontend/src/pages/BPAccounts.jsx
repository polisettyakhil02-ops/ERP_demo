// pages/BPAccounts.jsx
//
// Accounts overview for the Admin Officer (/accounts, finance-only).
//
// Previously this page pulled raw FeePayment + Expenditure rows through the
// generic entityClient and did every sum in the browser. That was wrong three
// ways: entityClient.list() caps at 1000 rows so the totals silently
// truncated; /api/entities applies NO branch filter for multi-branch roles
// (buildScopeFilter skips it), so an Admin Officer saw every branch in the
// system rather than their assigned ones; and "Total Income" counted only
// FeePayment, omitting the Income model entirely.
//
// Everything is now server-aggregated through the same endpoints the Admin
// Dashboard uses, all of which scope correctly on user.branches:
//   - analyticsApi.dashboardStats() -> the summary cards (Mongo aggregation,
//     no row cap, restricted to accessible branches, accepts ?branch=)
//   - feeApi.reportSummary()        -> real outstanding, from StudentFeeReport
//     balance buckets (NOT FeePayment.status, which is never "Pending")
//   - feeApi.paymentsSummary()      -> per-month and per-academic-year
//     collections, as lightweight {count,total_collected} aggregates
//   - incomeApi/expenditureApi.list -> dated rows for the month chart and the
//     category split (both go through resolveBranchQueryFilter)
//
// Deliberately NOT used: analyticsApi.feesSummary()/incomeExpenditure(). Their
// scopeFor() helper returns { branch: req.user.branch }, which is null for a
// multi-branch role, and a null in an aggregate $match matches zero documents -
// they return all zeros for an Admin Officer. See analyticsController.js.
import React, { useState, useEffect, useMemo } from "react";
import {
  analyticsApi,
  branchApi,
  feeApi,
  incomeApi,
  expenditureApi,
} from "@/api/api";
import { toast } from "sonner";
import { Download, TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import { ACADEMIC_YEARS } from "@/lib/constants.js";
import {
  formatCurrency,
  formatCurrencyShort,
  formatNumber,
} from "@/lib/formatCurrency.js";
import { useSchoolBranding } from "@/lib/schoolBranding";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

const MONTH_LABELS = [
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

// The 12 calendar months ending with the current one. The old chart bucketed
// by month-of-year only, so every September ever recorded landed in one bar -
// these carry the year too, so each bar is a real, distinct month.
// Boundaries are built in UTC (and `to` pushed to end-of-day) because
// paymentsSummary filters payment_date with a plain $gte/$lte and does no
// end-of-day adjustment of its own.
function lastTwelveMonths() {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() - i;
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    months.push({
      key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[start.getUTCMonth()]} ${String(start.getUTCFullYear()).slice(-2)}`,
      from: start.toISOString(),
      to: end.toISOString(),
    });
  }
  return months;
}

// "YYYY-MM" bucket key for a record's date, matching lastTwelveMonths().key.
function monthKeyOf(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const sumAmount = (rows) =>
  rows.reduce((total, r) => total + (Number(r.amount) || 0), 0);

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-800 tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${color}`}
        >
          <Icon size={22} className="text-white" />
        </div>
      </div>
      {sub && <p className="text-xs text-slate-500 leading-relaxed">{sub}</p>}
    </div>
  );
}

export default function BPAccounts() {
  const branding = useSchoolBranding();
  const months = useMemo(() => lastTwelveMonths(), []);

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [accessibleBranches, setAccessibleBranches] = useState([]);

  const [stats, setStats] = useState(null);
  const [outstanding, setOutstanding] = useState(0);
  const [monthlyFees, setMonthlyFees] = useState({});
  const [incomeRows, setIncomeRows] = useState([]);
  const [expenditureRows, setExpenditureRows] = useState([]);
  const [yearCollected, setYearCollected] = useState({});
  const [loading, setLoading] = useState(true);

  // Branch names for the picker. GET /api/branches already returns only what
  // this user may see, but dashboardStats.accessible_branches is the
  // authoritative list, so the dropdown is filtered against that below.
  useEffect(() => {
    branchApi
      .list()
      .then((data) => setBranches(data?.data || data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const branchParam =
      selectedBranch !== "all" ? { branch: selectedBranch } : {};
    const windowParams = {
      from: months[0].from,
      to: months[months.length - 1].to,
      ...branchParam,
    };

    Promise.all([
      analyticsApi.dashboardStats(branchParam),
      feeApi.reportSummary(branchParam),
      // Per-month fee collections as 12 small aggregates rather than shipping
      // every FeePayment row for the window to the browser.
      Promise.all(
        months.map((m) =>
          feeApi.paymentsSummary({ from: m.from, to: m.to, ...branchParam }),
        ),
      ),
      incomeApi.list(windowParams),
      expenditureApi.list(windowParams),
      Promise.all(
        ACADEMIC_YEARS.map((year) =>
          feeApi.paymentsSummary({ academic_year: year, ...branchParam }),
        ),
      ),
    ])
      .then(([dash, report, feeByMonth, incRes, expRes, byYear]) => {
        if (cancelled) return;
        setStats(dash || null);
        setAccessibleBranches(dash?.accessible_branches || []);
        setOutstanding(Number(report?.balance_fee) || 0);
        setMonthlyFees(
          Object.fromEntries(
            months.map((m, i) => [
              m.key,
              Number(feeByMonth[i]?.total_collected) || 0,
            ]),
          ),
        );
        setIncomeRows(incRes?.data || []);
        setExpenditureRows(expRes?.data || []);
        setYearCollected(
          Object.fromEntries(
            ACADEMIC_YEARS.map((year, i) => [
              year,
              Number(byYear[i]?.total_collected) || 0,
            ]),
          ),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        // The old version had no .catch() at all, so any failure left the
        // spinner running forever with no indication anything was wrong.
        toast.error(apiErrorMessage(err));
        setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBranch, months]);

  const summary = stats?.combined_stats || null;
  const totalIncome = Number(summary?.total_income) || 0;
  const totalExpenditure = Number(summary?.total_expenditure) || 0;
  const netBalance = Number(summary?.net_balance) || 0;

  const chartData = useMemo(() => {
    const incomeByMonth = {};
    incomeRows.forEach((r) => {
      const k = monthKeyOf(r.date);
      if (k) incomeByMonth[k] = (incomeByMonth[k] || 0) + (Number(r.amount) || 0);
    });
    const expByMonth = {};
    expenditureRows.forEach((r) => {
      const k = monthKeyOf(r.date);
      if (k) expByMonth[k] = (expByMonth[k] || 0) + (Number(r.amount) || 0);
    });
    return months.map((m) => ({
      month: m.label,
      Income: (monthlyFees[m.key] || 0) + (incomeByMonth[m.key] || 0),
      Expenditure: expByMonth[m.key] || 0,
    }));
  }, [months, monthlyFees, incomeRows, expenditureRows]);

  // Categories come from the records themselves - the old hardcoded list
  // ("Salaries"/"Utilities"/...) silently dropped any category that wasn't on
  // it, so those rupees vanished from the breakdown while still counting
  // toward Total Expenditure.
  const categoryData = useMemo(() => {
    const byCategory = {};
    expenditureRows.forEach((r) => {
      const key = r.category || "Uncategorized";
      byCategory[key] = (byCategory[key] || 0) + (Number(r.amount) || 0);
    });
    return Object.entries(byCategory)
      .map(([category, total]) => ({ category, total }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [expenditureRows]);

  const windowExpenditure = useMemo(
    () => sumAmount(expenditureRows),
    [expenditureRows],
  );

  const branchLabel =
    selectedBranch === "all"
      ? `All branches (${accessibleBranches.length || branches.length})`
      : branches.find((b) => String(b._id) === String(selectedBranch))?.name ||
        "Selected branch";

  const exportReport = () => {
    const lines = [
      `${branding.erpName} - Financial Report`,
      `Scope: ${branchLabel}`,
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      "",
      `Total Income: ${formatCurrency(totalIncome)}`,
      `  Fee Payments: ${formatCurrency(summary?.fee_collections || 0)}`,
      `  Other Income: ${formatCurrency(summary?.other_income || 0)}`,
      `Total Expenditure: ${formatCurrency(totalExpenditure)}`,
      `Net Balance: ${formatCurrency(netBalance)}`,
      `Total Outstanding: ${formatCurrency(outstanding)}`,
      "",
      "Fee Collected by Academic Year:",
      ...ACADEMIC_YEARS.map(
        (y) => `  ${y}: ${formatCurrency(yearCollected[y] || 0)}`,
      ),
      "",
      `Expenditure by Category (last 12 months, ${formatCurrency(windowExpenditure)}):`,
      ...categoryData.map(
        (c) => `  ${c.category}: ${formatCurrency(c.total)}`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "financial-report.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Accounts Overview
          </h2>
          <p className="text-sm text-slate-500">
            Financial summary · {branchLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-60 h-10 rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches
                .filter(
                  (b) =>
                    accessibleBranches.length === 0 ||
                    accessibleBranches.includes(String(b._id)),
                )
                .map((b) => (
                  <SelectItem key={b._id} value={String(b._id)}>
                    {b.name}
                    {b.code ? ` (${b.code})` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      {/* Summary cards - all server-aggregated, branch-scoped */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Income"
          value={formatCurrencyShort(totalIncome)}
          sub={`Fee Payments ${formatCurrencyShort(summary?.fee_collections || 0)} · Other ${formatCurrencyShort(summary?.other_income || 0)}`}
          icon={TrendingUp}
          color="bg-emerald-600"
        />
        <StatCard
          label="Total Expenditure"
          value={formatCurrencyShort(totalExpenditure)}
          sub={`₹${formatNumber(totalExpenditure)}`}
          icon={TrendingDown}
          color="bg-red-600"
        />
        <StatCard
          label="Net Balance"
          value={formatCurrencyShort(netBalance)}
          sub={netBalance >= 0 ? "✓ Surplus" : "⚠ Deficit"}
          icon={Wallet}
          color={netBalance >= 0 ? "bg-purple-600" : "bg-orange-600"}
        />
        <StatCard
          label="Total Outstanding"
          value={formatCurrencyShort(outstanding)}
          sub="Unpaid balance across all fee buckets"
          icon={Clock}
          color="bg-amber-600"
        />
      </div>

      {/* Monthly chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Monthly Income vs Expenditure (last 12 months)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => formatCurrencyShort(v)}
            />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="Income"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Expenditure"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Fee collected by academic year */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">
            Fee Collected by Academic Year
          </h3>
          {/* The old "Pending" column here filtered FeePayment.status ===
              "Pending", which collectPayment() never writes - it always
              stamped ₹0. Real outstanding has no per-year breakdown either:
              StudentFeeReport (where balances live) has no academic_year
              field, so it is surfaced as the single card above instead. */}
          <p className="text-xs text-slate-400 mb-3">
            Outstanding is not split by year — see Total Outstanding above.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left pb-2 text-xs text-slate-500">Year</th>
                <th className="text-right pb-2 text-xs text-slate-500">
                  Collected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ACADEMIC_YEARS.map((year) => (
                <tr key={year}>
                  <td className="py-2.5 font-medium text-slate-700">{year}</td>
                  <td className="py-2.5 text-right text-emerald-600 font-semibold">
                    {formatCurrency(yearCollected[year] || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expenditure by category */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">
            Expenditure by Category
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Last 12 months · {formatCurrency(windowExpenditure)}
          </p>
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              No expenditure recorded in this period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left pb-2 text-xs text-slate-500">
                    Category
                  </th>
                  <th className="text-right pb-2 text-xs text-slate-500">
                    Amount
                  </th>
                  <th className="text-right pb-2 text-xs text-slate-500">
                    % Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {categoryData.map((c) => (
                  <tr key={c.category}>
                    <td className="py-2.5 font-medium text-slate-700">
                      {c.category}
                    </td>
                    <td className="py-2.5 text-right text-slate-800 font-semibold">
                      {formatCurrency(c.total)}
                    </td>
                    <td className="py-2.5 text-right text-slate-500">
                      {windowExpenditure > 0
                        ? Math.round((c.total / windowExpenditure) * 100)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
