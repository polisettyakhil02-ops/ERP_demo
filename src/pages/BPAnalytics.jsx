import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import StatCard from '@/components/common/StatCard'
import { Users, UserCheck, DollarSign, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

export default function BPAnalytics() {
  const [students, setStudents] = useState([])
  const [staff, setStaff] = useState([])
  const [fees, setFees] = useState([])

  useEffect(() => {
    api.get('/students').then(d => setStudents(Array.isArray(d) ? d : d.data || [])).catch(() => {})
    api.get('/staff').then(d => setStaff(Array.isArray(d) ? d : d.data || [])).catch(() => {})
    api.get('/fee-payments').then(d => setFees(Array.isArray(d) ? d : d.data || [])).catch(() => {})
  }, [])

  const paid = fees.filter(f => f.status === 'Paid')
  const pending = fees.filter(f => f.status === 'Pending')
  const collectionRate = fees.length ? Math.round((paid.length / fees.length) * 100) : 0

  const classDist = Object.entries(
    students.reduce((acc, s) => { acc[s.class] = (acc[s.class] || 0) + 1; return acc }, {})
  ).sort().map(([name, value]) => ({ name, value }))

  const feeStatusData = [
    { name: 'Collected', value: paid.reduce((s, f) => s + (f.amount || 0), 0) },
    { name: 'Pending', value: pending.reduce((s, f) => s + (f.amount || 0), 0) },
  ]

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthlyFees = MONTHS.map((m, i) => ({
    month: m,
    Collected: paid.filter(f => new Date(f.payment_date).getMonth() === i).reduce((s, f) => s + (f.amount || 0), 0),
  }))

  return (
    <div>
      <TopBar title="Analytics" subtitle="School performance metrics" />
      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={students.length.toString()} change={8} icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
          <StatCard label="Total Staff" value={staff.length.toString()} change={2} icon={UserCheck} iconBg="bg-teal-50" iconColor="text-teal-600" />
          <StatCard label="Fee Collection Rate" value={`${collectionRate}%`} change={3} icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Revenue (Collected)" value={formatCurrency(paid.reduce((s, f) => s + (f.amount || 0), 0))} change={12} icon={TrendingUp} iconBg="bg-amber-50" iconColor="text-amber-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Enrollment by Class</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={classDist.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[3,3,0,0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fee Collection Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={feeStatusData} cx="50%" cy="50%" outerRadius={85} dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {feeStatusData.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b'][i]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Monthly Fee Collection</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyFees}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Collected" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
