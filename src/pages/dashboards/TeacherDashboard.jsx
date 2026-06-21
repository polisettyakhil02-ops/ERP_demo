import { useEffect, useState } from 'react'
import { Users, CheckCircle, XCircle, Calendar, Cake, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/common/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState([])
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    api.get('/students').then(d => setStudents(Array.isArray(d) ? d : d.data || [])).catch(() => {})
    api.get('/attendance', { date: today }).then(d => setAttendance(Array.isArray(d) ? d : d.data || [])).catch(() => {})
  }, [today])

  const todayBirthdays = students.filter(s => {
    if (!s.dob) return false
    const dob = new Date(s.dob)
    const now = new Date()
    return dob.getDate() === now.getDate() && dob.getMonth() === now.getMonth()
  })
  const present = attendance.filter(a => a.status === 'Present').length
  const absent = attendance.filter(a => a.status === 'Absent').length

  return (
    <div>
      <TopBar title="Teacher Dashboard" subtitle={`Today: ${formatDate(today)}`} />
      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={students.length.toString()} icon={Users} iconBg="bg-teal-50" iconColor="text-teal-600" />
          <StatCard label="Present Today" value={present.toString()} icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Absent Today" value={absent.toString()} icon={XCircle} iconBg="bg-red-50" iconColor="text-red-500" />
          <StatCard label="Today's Birthdays" value={todayBirthdays.length.toString()} icon={Cake} iconBg="bg-pink-50" iconColor="text-pink-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {todayBirthdays.length > 0 && (
            <Card>
              <CardHeader><CardTitle>🎂 Today's Birthdays</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {todayBirthdays.map(s => (
                    <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm">
                        {s.full_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{s.full_name}</p>
                        <p className="text-xs text-slate-500">Class {s.class}{s.section ? ` - ${s.section}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Today's Attendance</CardTitle>
              <button onClick={() => navigate('/attendance')} className="text-xs text-indigo-600 flex items-center gap-1">View <ArrowRight size={12} /></button>
            </CardHeader>
            <CardContent className="p-0">
              {attendance.length === 0
                ? <p className="text-center text-slate-400 text-sm py-8">No attendance marked today</p>
                : attendance.slice(0, 6).map(a => (
                  <div key={a.id} className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm text-slate-700">{a.student_name}</p>
                    <Badge status={a.status} />
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Mark Attendance', path: '/attendance', color: 'bg-teal-600' },
            { label: 'Enter Marks', path: '/marks', color: 'bg-indigo-600' },
            { label: 'Homework Manager', path: '/homework-manager', color: 'bg-purple-600' },
            { label: 'Hall Tickets', path: '/hall-ticket', color: 'bg-amber-600' },
          ].map(({ label, path, color }) => (
            <button key={path} onClick={() => navigate(path)} className={`${color} text-white rounded-xl p-4 text-sm font-medium hover:opacity-90 transition-opacity text-left`}>
              {label} <ArrowRight size={14} className="inline ml-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
