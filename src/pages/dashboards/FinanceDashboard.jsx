import { useEffect, useState } from 'react'
import { Building2, TrendingUp, TrendingDown, Wallet, ArrowRight, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

function StatCard({ label, value, sub, icon: Icon, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-2 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function BranchCard({ branch, income, expenditure, net, students }) {
  const isPositive = net >= 0
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <p className="font-semibold text-slate-800 text-sm truncate mb-3" title={branch}>{branch}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Students</span>
          <span className="font-medium text-slate-700">{students.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Income</span>
          <span className="font-semibold text-emerald-600">{formatCurrency(income)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Expenditure</span>
          <span className="font-semibold text-red-500">{formatCurrency(expenditure)}</span>
        </div>
        <div className="pt-1 border-t border-slate-100 flex justify-between text-xs">
          <span className="text-slate-500">Net</span>
          <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{formatCurrency(net)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function FinanceDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAllBranches, setShowAllBranches] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/admin/branch-stats')
      .then(d => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const branches = stats?.branches || []
  const visibleBranches = showAllBranches ? branches : branches.slice(0, 8)

  const chartData = branches
    .sort((a, b) => b.income - a.income)
    .slice(0, 10)
    .map(b => ({
      name: b.branch.split(' - ')[1] || b.branch.split(' ')[0],
      Income: b.income,
      Expenditure: b.expenditure,
    }))

  return (
    <div>
      <TopBar title="Admin Dashboard" subtitle="All-branch financial overview — MasterMinds ERP">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </TopBar>

      <div className="page-content">
        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Branches"
            value={loading ? '—' : (stats?.totalBranches || 0)}
            sub="Across all cities"
            icon={Building2}
            color="bg-indigo-500"
          />
          <StatCard
            label="Total Income"
            value={loading ? '—' : formatCurrency(stats?.totalIncome || 0)}
            sub="From all branches"
            icon={TrendingUp}
            color="bg-emerald-500"
            onClick={() => navigate('/tracking-expenses')}
          />
          <StatCard
            label="Total Expenditure"
            value={loading ? '—' : formatCurrency(stats?.totalExpenditure || 0)}
            sub="All heads combined"
            icon={TrendingDown}
            color="bg-red-500"
            onClick={() => navigate('/tracking-expenses')}
          />
          <StatCard
            label="Net Balance"
            value={loading ? '—' : formatCurrency(stats?.netBalance || 0)}
            sub={(stats?.netBalance || 0) >= 0 ? '▲ Surplus' : '▼ Deficit'}
            icon={Wallet}
            color={(stats?.netBalance || 0) >= 0 ? 'bg-purple-600' : 'bg-orange-500'}
          />
        </div>

        {/* Top branches bar chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Branches — Income vs Expenditure</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expenditure" fill="#f87171" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Branch cards grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Branch Overview {branches.length > 0 && <span className="text-slate-400 font-normal">({branches.length} branches)</span>}
            </h2>
            {branches.length > 8 && (
              <button
                onClick={() => setShowAllBranches(p => !p)}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {showAllBranches ? 'Show less' : `Show all ${branches.length}`}
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-slate-100 rounded-xl h-32 animate-pulse" />
              ))}
            </div>
          ) : branches.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
              No branch data found. Add students and record payments to see branch-wise stats.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleBranches.map(b => (
                <BranchCard key={b.branch} {...b} />
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/tracking-expenses')}
            className="bg-indigo-600 text-white rounded-xl p-4 text-sm font-semibold hover:bg-indigo-700 transition-colors text-left flex items-center justify-between"
          >
            <span>Track Expenses & Ledger</span>
            <TrendingUp size={18} />
          </button>
          <button
            onClick={() => navigate('/income')}
            className="bg-emerald-600 text-white rounded-xl p-4 text-sm font-semibold hover:bg-emerald-700 transition-colors text-left flex items-center justify-between"
          >
            <span>Record Income</span>
            <Wallet size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
