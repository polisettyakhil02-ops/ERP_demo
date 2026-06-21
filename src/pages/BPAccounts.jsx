import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import StatCard from '@/components/common/StatCard'
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function BPAccounts() {
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])

  useEffect(() => {
    api.get('/fee-payments').then(d => setIncome(Array.isArray(d) ? d.filter(f => f.status === 'Paid') : [])).catch(() => {})
    api.get('/expenditure').then(d => setExpenses(Array.isArray(d) ? d : d.data || [])).catch(() => {})
  }, [])

  const totalIncome = income.reduce((s, i) => s + (i.amount || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const netBalance = totalIncome - totalExpenses

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const chartData = MONTHS.map((m, i) => ({
    month: m,
    Income: income.filter(f => new Date(f.payment_date).getMonth() === i).reduce((s, f) => s + (f.amount || 0), 0),
    Expenses: expenses.filter(e => new Date(e.date).getMonth() === i).reduce((s, e) => s + (e.amount || 0), 0),
  }))

  const combined = [
    ...income.slice(0, 5).map(i => ({ ...i, type: 'Income', label: i.student_name, color: 'text-emerald-600' })),
    ...expenses.slice(0, 5).map(e => ({ ...e, type: 'Expense', label: e.description || e.category, color: 'text-red-500' })),
  ].sort((a, b) => new Date(b.payment_date || b.date) - new Date(a.payment_date || a.date))

  return (
    <div>
      <TopBar title="Accounts" subtitle="Income & Expenditure Ledger" />
      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Income" value={formatCurrency(totalIncome)} change={8} icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} iconBg="bg-red-50" iconColor="text-red-500" />
          <StatCard label="Net Balance" value={formatCurrency(netBalance)} change={netBalance >= 0 ? 5 : -5} icon={TrendingUp} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        </div>

        <Card>
          <CardHeader><CardTitle>Monthly P&L Summary</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="Income" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="Expenses" fill="#f87171" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Ledger Entries</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="data-table w-full">
              <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
              <tbody>
                {combined.map((entry, i) => (
                  <tr key={i}>
                    <td>{formatDate(entry.payment_date || entry.date)}</td>
                    <td>{entry.label || '—'}</td>
                    <td><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${entry.type === 'Income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{entry.type}</span></td>
                    <td className={`font-semibold ${entry.color}`}>{entry.type === 'Income' ? '+' : '-'}{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
