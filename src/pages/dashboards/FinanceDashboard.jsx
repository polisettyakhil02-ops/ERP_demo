import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Clock, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/common/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const CHART_DATA = [
  { month: 'Jan', Income: 1850000, Expenditure: 1200000 },
  { month: 'Feb', Income: 2100000, Expenditure: 1350000 },
  { month: 'Mar', Income: 1950000, Expenditure: 1280000 },
  { month: 'Apr', Income: 2400000, Expenditure: 1450000 },
  { month: 'May', Income: 2250000, Expenditure: 1380000 },
  { month: 'Jun', Income: 2800000, Expenditure: 1550000 },
]

export default function FinanceDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ collected: 0, expenditure: 0, pending: 0, net: 0 })
  const [recent, setRecent] = useState([])

  useEffect(() => {
    Promise.all([
      api.get('/fee-payments').catch(() => ({ data: [] })),
      api.get('/expenditure').catch(() => ({ data: [] })),
    ]).then(([fees, exp]) => {
      const feeList = Array.isArray(fees) ? fees : fees.data || []
      const expList = Array.isArray(exp) ? exp : exp.data || []
      const collected = feeList.filter(f => f.status === 'Paid').reduce((s, f) => s + (f.amount || 0), 0)
      const pending = feeList.filter(f => f.status === 'Pending').reduce((s, f) => s + (f.amount || 0), 0)
      const expenditure = expList.reduce((s, e) => s + (e.amount || 0), 0)
      setStats({ collected, expenditure, pending, net: collected - expenditure })
      setRecent(feeList.slice(0, 6))
    }).catch(() => {})
  }, [])

  return (
    <div>
      <TopBar title="Finance Dashboard" subtitle="Admin Officer Overview" />
      <div className="page-content">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Fee Collected" value={formatCurrency(stats.collected)} change={12} icon={DollarSign} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
          <StatCard label="Total Expenditure" value={formatCurrency(stats.expenditure)} change={-5} icon={TrendingDown} iconBg="bg-red-50" iconColor="text-red-500" />
          <StatCard label="Net Balance" value={formatCurrency(stats.net)} change={8} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Pending Fees" value={formatCurrency(stats.pending)} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" />
        </div>

        {/* Chart + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Income vs Expenditure (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={CHART_DATA} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Income" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expenditure" fill="#f87171" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <button onClick={() => navigate('/fees')} className="text-xs text-indigo-600 flex items-center gap-1 hover:text-indigo-700">
                View all <ArrowRight size={12} />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              {recent.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">No transactions yet</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recent.map(r => (
                    <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-800 font-medium truncate max-w-[120px]">{r.student_name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{r.fee_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(r.amount)}</p>
                        <Badge status={r.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Manage Fees', path: '/fees', color: 'bg-indigo-600' },
            { label: 'Expenditure', path: '/expenditure', color: 'bg-red-500' },
            { label: 'Fee Report', path: '/student-fee-report', color: 'bg-emerald-600' },
            { label: 'Analytics', path: '/analytics', color: 'bg-amber-600' },
          ].map(({ label, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`${color} text-white rounded-xl p-4 text-sm font-medium hover:opacity-90 transition-opacity text-left`}
            >
              {label} <ArrowRight size={14} className="inline ml-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
