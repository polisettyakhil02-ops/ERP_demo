import { useEffect, useState } from "react";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyticsApi, branchApi } from "@/api/api";
import {
  formatCurrency,
  formatCurrencyShort,
  formatNumber,
} from "@/lib/formatCurrency.js";

function StatCard({ label, value, sub, icon: Icon, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all ${onClick ? "cursor-pointer hover:-translate-y-0.5" : ""}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className="text-3xl font-bold text-slate-800 tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${color} flex-shrink-0`}
        >
          <Icon size={24} className="text-white" />
        </div>
      </div>
      {sub && <p className="text-sm text-slate-500 leading-relaxed">{sub}</p>}
    </div>
  );
}

function BranchCard({ branch, income, expenditure, net, students }) {
  const isPositive = net >= 0;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow h-full">
      <p className="font-semibold text-slate-900 text-base mb-4 line-clamp-2">
        {branch}
      </p>
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-sm text-slate-600">Students</span>
          <span className="font-semibold text-slate-800">
            {formatNumber(students)}
          </span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-sm text-slate-600">Income</span>
          <span className="font-semibold text-emerald-600">
            {formatCurrencyShort(income)}
          </span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-sm text-slate-600">Expenses</span>
          <span className="font-semibold text-red-600">
            {formatCurrencyShort(expenditure)}
          </span>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-semibold text-slate-700">
            Net Balance
          </span>
          <span
            className={`text-lg font-bold ${isPositive ? "text-emerald-600" : "text-red-600"}`}
          >
            {isPositive ? "+" : ""}
            {formatCurrencyShort(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [allBranches, setAllBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [showAllBranches, setShowAllBranches] = useState(false);

  // Fetch all branches on mount (for dropdown)
  useEffect(() => {
    branchApi
      .list()
      .then((data) => {
        const branches = data?.data || data || [];
        setAllBranches(branches);
      })
      .catch((err) => console.error("Failed to fetch branches:", err));
  }, []);

  // Fetch dashboard stats
  const load = () => {
    setLoading(true);
    analyticsApi
      .dashboardStats()
      .then((d) => {
        setStats(d);
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard stats:", err);
        setStats(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Determine which data to display based on selected branch
  let displayStats = null;
  let displayBranches = [];
  let displayTitle = "All Branches";

  if (stats) {
    const data = stats;

    if (selectedBranch === "all") {
      displayStats = data.combined_stats;
      displayBranches = data.all_branches || [];
      displayTitle = `All Branches (${displayBranches.length})`;
    } else {
      // FIX: this used to always fall back to data.combined_stats here,
      // so the summary cards never actually reflected the selected
      // branch - only the branch grid/chart below (which already used
      // `selected` correctly) changed. The cards need that same
      // per-branch stats object, not the all-branches combined one.
      const selected = data.all_branches?.find(
        (b) => String(b._id) === String(selectedBranch),
      );
      displayStats = selected || data.combined_stats;
      displayBranches = selected ? [selected] : [];
      const branchName = allBranches.find(
        (b) => String(b._id) === String(selectedBranch),
      )?.name;
      displayTitle = branchName || "Selected Branch";
    }
  }

  // Chart data (top 10 branches)
  const chartData = (displayBranches || [])
    .sort((a, b) => b.total_income - a.total_income)
    .slice(0, 10)
    .map((b) => ({
      name: b.code || b.name,
      Income: b.total_income,
      Expenditure: b.total_expenditure,
    }));

  const visibleBranches = showAllBranches
    ? displayBranches
    : displayBranches.slice(0, 8);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="page-content p-6 space-y-8">
        {/* Controls Section */}
        {stats?.accessible_branches && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="text-sm font-semibold text-slate-700">
                Select Branch:
              </label>
              <Select
                value={selectedBranch}
                onValueChange={setSelectedBranch}
                disabled={loading}
              >
                <SelectTrigger className="w-full sm:w-72 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {allBranches
                    .filter((b) =>
                      stats.accessible_branches.includes(String(b._id)),
                    )
                    .map((branch) => (
                      <SelectItem key={branch._id} value={String(branch._id)}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Financial Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Total Branches"
              value={
                loading
                  ? "—"
                  : selectedBranch === "all"
                    ? formatNumber(displayBranches.length)
                    : "1"
              }
              sub={
                selectedBranch === "all"
                  ? "Accessible branches"
                  : "Selected branch"
              }
              icon={Building2}
              color="bg-indigo-600"
            />
            <StatCard
              label="Total Income"
              value={
                loading
                  ? "—"
                  : formatCurrencyShort(displayStats?.total_income || 0)
              }
              sub={
                loading
                  ? undefined
                  : `Fee Payments ${formatCurrencyShort(displayStats?.fee_collections || 0)} · Other ${formatCurrencyShort(displayStats?.other_income || 0)}`
              }
              icon={TrendingUp}
              color="bg-emerald-600"
              onClick={() => navigate("/financial-report")}
            />
            <StatCard
              label="Total Expenditure"
              value={
                loading
                  ? "—"
                  : formatCurrencyShort(displayStats?.total_expenditure || 0)
              }
              sub={`₹${formatNumber(displayStats?.total_expenditure || 0)}`}
              icon={TrendingDown}
              color="bg-red-600"
              onClick={() => navigate("/financial-report")}
            />
            <StatCard
              label="Net Balance"
              value={
                loading
                  ? "—"
                  : formatCurrencyShort(displayStats?.net_balance || 0)
              }
              sub={
                (displayStats?.net_balance || 0) >= 0
                  ? "✓ Surplus"
                  : "⚠ Deficit"
              }
              icon={Wallet}
              color={
                (displayStats?.net_balance || 0) >= 0
                  ? "bg-purple-600"
                  : "bg-orange-600"
              }
            />
          </div>
        </div>

        {/* Chart Section */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">
              {selectedBranch === "all"
                ? "Branch Performance — Income vs Expenditure"
                : "Income vs Expenditure"}
            </h2>
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 40 }}
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(v)}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#ffffff",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} iconType="square" />
                  <Bar
                    dataKey="Income"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                  <Bar
                    dataKey="Expenditure"
                    fill="#ef4444"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Branches Grid Section */}
        {selectedBranch === "all" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {displayTitle}
              </h2>
              {displayBranches.length > 8 && (
                <button
                  onClick={() => setShowAllBranches((p) => !p)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 transition-colors"
                >
                  {showAllBranches
                    ? "Show less"
                    : `Show all (${displayBranches.length})`}
                  <ArrowRight size={14} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse"
                  />
                ))}
              </div>
            ) : displayBranches.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">
                  No branch data found
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Add students and record payments to see branch-wise stats.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {visibleBranches.map((b) => (
                  <BranchCard
                    key={b._id}
                    branch={b.name}
                    income={b.total_income}
                    expenditure={b.total_expenditure}
                    net={b.net_balance}
                    students={b.students}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 gap-6">
          <button
            onClick={() => navigate("/financial-report")}
            className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl p-6 font-semibold hover:shadow-lg transition-all hover:-translate-y-1 text-left flex items-end justify-between min-h-24"
          >
            <div>
              <p className="text-sm opacity-90 mb-1">Manage Finances</p>
              <p className="text-lg">Track Expenses & Ledger</p>
            </div>
            <TrendingUp size={32} className="opacity-30" />
          </button>
        </div>
      </div>
    </div>
  );
}
