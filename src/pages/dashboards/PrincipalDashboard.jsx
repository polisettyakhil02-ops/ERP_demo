import { useEffect, useState } from 'react'
import { Users, UserCheck, BookOpen, Award } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/common/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

export default function PrincipalDashboard() {
  const [students, setStudents] = useState([])
  const [staff, setStaff] = useState([])
  const [activeTab, setActiveTab] = useState('staff')

  useEffect(() => {
    api.get('/students').then(d => setStudents(Array.isArray(d) ? d : d.data || [])).catch(() => {})
    api.get('/staff').then(d => setStaff(Array.isArray(d) ? d : d.data || [])).catch(() => {})
  }, [])

  const activeStaff = staff.filter(s => s.status === 'Active')
  const teachers = staff.filter(s => s.role === 'Teacher')

  const classSummary = students.reduce((acc, s) => {
    const key = `Class ${s.class}`
    if (!acc[key]) acc[key] = 0
    acc[key]++
    return acc
  }, {})

  return (
    <div>
      <TopBar title="Principal Dashboard" subtitle="School Overview" />
      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={students.length.toString()} icon={Users} iconBg="bg-purple-50" iconColor="text-purple-600" />
          <StatCard label="Total Staff" value={staff.length.toString()} icon={UserCheck} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
          <StatCard label="Active Teachers" value={teachers.filter(t => t.status === 'Active').length.toString()} icon={BookOpen} iconBg="bg-teal-50" iconColor="text-teal-600" />
          <StatCard label="Active Staff" value={activeStaff.length.toString()} icon={Award} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex gap-4">
              {['staff', 'classes'].map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors capitalize ${
                    activeTab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500'
                  }`}
                >
                  {t === 'staff' ? 'Staff Directory' : 'Class Summary'}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activeTab === 'staff' ? (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Name</th><th>Role</th><th>Subject</th><th>Phone</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.slice(0, 10).map(s => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.full_name}</td>
                      <td>{s.role}</td>
                      <td>{s.subject_taught || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td><Badge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="data-table w-full">
                <thead><tr><th>Class</th><th>Students</th></tr></thead>
                <tbody>
                  {Object.entries(classSummary).sort().map(([cls, count]) => (
                    <tr key={cls}><td className="font-medium">{cls}</td><td>{count}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
