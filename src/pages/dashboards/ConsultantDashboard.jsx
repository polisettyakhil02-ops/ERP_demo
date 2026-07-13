import { useEffect, useState } from 'react'
import { Users, DollarSign, Clock, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/common/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useRole } from '@/lib/RoleContext'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const BRANCHES = ['Hyderabad', 'Secunderabad', 'Kukatpally', 'Miyapur']
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444']

const BRANCH_DATA = BRANCHES.map((name, i) => ({
  name,
  Enrollment: [245, 187, 156, 134][i],
  Collected: [4500000, 3200000, 2800000, 2400000][i],
  Pending: [450000, 320000, 280000, 240000][i],
}))

export default function ConsultantDashboard() {
  const { branch, setBranch } = useRole()
  const [fees, setFees] = useState([])

  useEffect(() => {
    api.get('/fee-payments').then(d => setFees(Array.isArray(d) ? d : d.data || [])).catch(() => {})
  }, [])

  const totalCollected = fees.filter(f => f.status === 'Paid').reduce((s, f) => s + (f.amount || 0), 0)
  const totalPending = fees.filter(f => f.status === 'Pending').reduce((s, f) => s + (f.amount || 0), 0)

  const pieData = [
    { name: 'Collected', value: totalCollected || 4500000 },
    { name: 'Pending', value: totalPending || 450000 },
  ]

  return (
    <div>
      <TopBar title="Accounts Manager Dashboard" subtitle="Branch Analytics Overview" />
      <div className="page-content">
        {/* Branch switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500">Branch:</span>
          {BRANCHES.map(b => (
            <button
              key={b}
              onClick={() => setBranch(b)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                branch === b ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value="722" change={8} icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
          <StatCard label="Total Collected" value={formatCurrency(totalCollected || 12900000)} change={12} icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Total Pending" value={formatCurrency(totalPending || 1290000)} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" />
          <StatCard label="Collection Rate" value="90.9%" change={3} icon={TrendingUp} iconBg="bg-purple-50" iconColor="text-purple-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Enrollment by Branch</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={BRANCH_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="Enrollment" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fee Collection Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Branch cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BRANCH_DATA.map((b, i) => (
            <div key={b.name} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <p className="font-semibold text-slate-800 text-sm">{b.name}</p>
              </div>
              <p className="text-2xl font-bold text-slate-800">{b.Enrollment}</p>
              <p className="text-xs text-slate-500 mb-2">students enrolled</p>
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Collected</span><span className="text-emerald-600 font-medium">{formatCurrency(b.Collected)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Pending</span><span className="text-amber-600 font-medium">{formatCurrency(b.Pending)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
