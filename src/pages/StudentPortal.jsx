import { useState, useEffect } from 'react'
import { Loader2, BookOpen, ClipboardList, BarChart2, Home, LogOut, Zap } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { formatDate, calcGrade } from '@/lib/utils'

const SCHOOL_LOGO = 'https://media.base44.com/images/public/69fd69a017bf1eb27462604f/280b8ac37_logo.jpg'

function LoginScreen({ onLogin }) {
  const [admNo, setAdmNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(admNo.trim())
    } catch {
      setError('Student not found. Please check your admission number.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 to-slate-900 px-4">
      <div className="bg-white/10 backdrop-blur rounded-2xl p-8 w-full max-w-sm border border-white/20">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-white font-bold text-xl">Student Portal</h1>
          <p className="text-blue-200 text-sm mt-1">MasterMinds ERP</p>
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-blue-200 mb-1 block font-medium">Admission Number</label>
            <input
              value={admNo}
              onChange={e => setAdmNo(e.target.value)}
              placeholder="e.g. ADM001"
              className="w-full h-10 bg-white/10 border border-white/20 text-white rounded-lg px-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Access Portal
          </button>
        </form>
      </div>
    </div>
  )
}

function HomeworkTab({ student }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/homework-notifications', { student_id: student.id })
      .then(d => setItems(Array.isArray(d) ? d : d.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [student.id])

  const markRead = async (id) => {
    await api.put(`/homework-notifications/${id}`, { status: 'Read' })
    setItems(p => p.map(i => i.id === id ? { ...i, status: 'Read' } : i))
  }

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-center text-slate-400 py-10 text-sm">No homework assigned</p>
      ) : (
        items.map(hw => (
          <div key={hw.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-slate-800 text-sm">{hw.title}</p>
                  {hw.status === 'Unread' && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                </div>
                <p className="text-xs text-slate-500">{hw.subject} · Due: {formatDate(hw.due_date)}</p>
                {hw.description && <p className="text-xs text-slate-600 mt-2">{hw.description}</p>}
              </div>
              {hw.status === 'Unread' && (
                <button
                  onClick={() => markRead(hw.id)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Mark Read
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function AttendanceTab({ student }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/attendance', { student_id: student.id })
      .then(d => setRecords(Array.isArray(d) ? d : d.data || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [student.id])

  const present = records.filter(r => r.status === 'Present').length
  const pct = records.length ? Math.round((present / records.length) * 100) : 0

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Overall Attendance</p>
          <p className="text-lg font-bold text-slate-800">{pct}%</p>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">{present} present out of {records.length} days</p>
      </div>
      <div className="space-y-2">
        {records.slice(0, 20).map(r => (
          <div key={r.id} className="flex items-center justify-between bg-white rounded-lg border border-slate-100 px-4 py-2.5">
            <p className="text-sm text-slate-700">{formatDate(r.date)}</p>
            <Badge status={r.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MarksTab({ student }) {
  const [marks, setMarks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/marks', { student_id: student.id })
      .then(d => setMarks(Array.isArray(d) ? d : d.data || []))
      .catch(() => setMarks([]))
      .finally(() => setLoading(false))
  }, [student.id])

  const grouped = marks.reduce((acc, m) => {
    if (!acc[m.exam_type]) acc[m.exam_type] = []
    acc[m.exam_type].push(m)
    return acc
  }, {})

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([examType, rows]) => {
        const total = rows.reduce((s, r) => s + r.marks_obtained, 0)
        const maxTotal = rows.reduce((s, r) => s + r.max_marks, 0)
        const pct = maxTotal ? Math.round((total / maxTotal) * 100) : 0
        return (
          <div key={examType} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="font-semibold text-slate-800 text-sm">{examType}</p>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{pct}%</p>
                <p className="text-xs text-slate-500">{total}/{maxTotal}</p>
              </div>
            </div>
            <div className="h-1.5 bg-slate-100">
              <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 text-xs text-slate-500 font-medium">Subject</th>
                  <th className="text-center px-3 py-2.5 text-xs text-slate-500 font-medium">Marks</th>
                  <th className="text-center px-3 py-2.5 text-xs text-slate-500 font-medium">Max</th>
                  <th className="text-center px-5 py-2.5 text-xs text-slate-500 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(m => (
                  <tr key={m.id} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 text-slate-700">{m.subject}</td>
                    <td className="px-3 py-2.5 text-center font-medium text-slate-800">{m.marks_obtained}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{m.max_marks}</td>
                    <td className="px-5 py-2.5 text-center">
                      <Badge status={calcGrade(m.marks_obtained, m.max_marks)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'homework', label: 'Homework', icon: BookOpen },
  { key: 'attendance', label: 'Attendance', icon: ClipboardList },
  { key: 'marks', label: 'Marks', icon: BarChart2 },
]

export default function StudentPortal() {
  const [student, setStudent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('studentData') || 'null') } catch { return null }
  })
  const [activeTab, setActiveTab] = useState('home')
  const { studentLogin } = { studentLogin: async (no) => {
    const data = await api.post('/auth/student-login', { admission_no: no })
    localStorage.setItem('token', data.token)
    localStorage.setItem('studentData', JSON.stringify(data.student))
    return data.student
  }}

  const handleLogin = async (admNo) => {
    const s = await studentLogin(admNo)
    setStudent(s)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('studentData')
    setStudent(null)
  }

  if (!student) return <LoginScreen onLogin={handleLogin} />

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-slate-800 text-sm">MasterMinds</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-800">{student.full_name}</p>
              <p className="text-xs text-slate-500">Class {student.class}{student.section ? ` - ${student.section}` : ''}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pb-10">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white sticky top-14 z-10 -mx-4 px-4">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {activeTab === 'home' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-5 text-white">
                <p className="text-indigo-200 text-xs mb-1">Welcome back</p>
                <p className="text-xl font-bold">{student.full_name}</p>
                <p className="text-indigo-200 text-sm mt-0.5">
                  Class {student.class}{student.section ? ` · Section ${student.section}` : ''}
                  {student.roll_no ? ` · Roll No. ${student.roll_no}` : ''}
                </p>
                <div className="mt-3 pt-3 border-t border-indigo-500 flex gap-4 text-xs">
                  <div><p className="text-indigo-200">Admission No</p><p className="font-medium">{student.admission_no}</p></div>
                  {student.parent_name && <div><p className="text-indigo-200">Parent</p><p className="font-medium">{student.parent_name}</p></div>}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'homework' && <HomeworkTab student={student} />}
          {activeTab === 'attendance' && <AttendanceTab student={student} />}
          {activeTab === 'marks' && <MarksTab student={student} />}
        </div>
      </div>
    </div>
  )
}
