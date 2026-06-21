import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import StatCard from '@/components/common/StatCard'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

export default function BPTrackingExpenses() {
  const [fees, setFees] = useState([])
  const [expenses, setExpenses] = useState([])
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    api.get('/fee-payments').then(d => setFees(Array.isArray(d) ? d : d.data || [])).catch(() => {})
    api.get('/expenditure').then(d => setExpenses(Array.isArray(d) ? d : d.data || [])).catch(() => {})
    const t = setInterval(() => {
      api.get('/fee-payments').then(d => setFees(Array.isArray(d) ? d : d.data || [])).catch(() => {})
      api.get('/expenditure').then(d => setExpenses(Array.isArray(d) ? d : d.data || [])).catch(() => {})
    }, 10000)
    return () => clearInterval(t)
  }, [])

  const inRange = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d >= new Date(startDate) && d <= new Date(endDate)
  }

  const filteredFees = fees.filter(f => f.status === 'Paid' && inRange(f.payment_date))
  const filteredExp = expenses.filter(e => inRange(e.date))

  const totalIncome = filteredFees.reduce((s, f) => s + (f.amount || 0), 0)
  const totalExp = filteredExp.reduce((s, e) => s + (e.amount || 0), 0)
  const surplus = totalIncome - totalExp

  const incomeByType = filteredFees.reduce((acc, f) => {
    acc[f.fee_type] = (acc[f.fee_type] || 0) + (f.amount || 0)
    return acc
  }, {})

  const expByCategory = filteredExp.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0)
    return acc
  }, {})

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthlyData = MONTHS.map((m, i) => ({
    month: m,
    Income: fees.filter(f => f.status === 'Paid' && new Date(f.payment_date).getMonth() === i).reduce((s, f) => s + (f.amount || 0), 0),
    Expenses: expenses.filter(e => new Date(e.date).getMonth() === i).reduce((s, e) => s + (e.amount || 0), 0),
  }))

  return (
    <div>
      <TopBar title="Tracking Expenses" subtitle="Income vs Expenditure analysis" />
      <div className="page-content">
        {/* Date range */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-slate-500">Date Range:</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <span className="text-slate-400">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Income" value={formatCurrency(totalIncome)} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Total Expenses" value={formatCurrency(totalExp)} icon={TrendingDown} iconBg="bg-red-50" iconColor="text-red-500" />
          <StatCard label={surplus >= 0 ? 'Surplus' : 'Deficit'} value={formatCurrency(Math.abs(surplus))} icon={DollarSign} iconBg={surplus >= 0 ? 'bg-emerald-50' : 'bg-red-50'} iconColor={surplus >= 0 ? 'text-emerald-600' : 'text-red-500'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Income by Fee Type</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="data-table w-full">
                <thead><tr><th>Fee Type</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {Object.entries(incomeByType).map(([type, amount]) => (
                    <tr key={type}>
                      <td>{type}</td>
                      <td className="text-right font-semibold text-emerald-600">{formatCurrency(amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-emerald-50">
                    <td>Total</td>
                    <td className="text-right text-emerald-700">{formatCurrency(totalIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="data-table w-full">
                <thead><tr><th>Category</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {Object.entries(expByCategory).map(([cat, amount]) => (
                    <tr key={cat}>
                      <td>{cat}</td>
                      <td className="text-right font-semibold text-red-500">{formatCurrency(amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-red-50">
                    <td>Total</td>
                    <td className="text-right text-red-600">{formatCurrency(totalExp)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Monthly Comparison</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Income" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="Expenses" fill="#f87171" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
