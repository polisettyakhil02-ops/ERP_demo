import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Save } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import api from '@/lib/api'

const CLASSES = ['LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
const SECTIONS = ['A','B','C','D']

const STATUS_CYCLE = { Present: 'Absent', Absent: 'Late', Late: 'Present' }
const STATUS_ICON = { Present: CheckCircle, Absent: XCircle, Late: Clock }
const STATUS_COLOR = { Present: 'text-emerald-600', Absent: 'text-red-500', Late: 'text-amber-500' }

export default function BPAttendance() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [filterClass, setFilterClass] = useState('Class 1')
  const [filterSection, setFilterSection] = useState('')
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/students', { class: filterClass, section: filterSection || undefined })
      .then(d => {
        const list = Array.isArray(d) ? d : d.data || []
        setStudents(list)
        const init = {}
        list.forEach(s => { init[s.id] = 'Present' })
        setAttendance(init)
      }).catch(() => setStudents([]))
      .finally(() => setLoading(false))
  }, [filterClass, filterSection])

  useEffect(() => {
    if (!students.length) return
    api.get('/attendance', { date, class: filterClass }).then(d => {
      const records = Array.isArray(d) ? d : d.data || []
      const map = {}
      records.forEach(r => { if (r.student_id) map[r.student_id] = r.status })
      if (Object.keys(map).length > 0) {
        setAttendance(prev => ({ ...prev, ...map }))
      }
    }).catch(() => {})
  }, [date, students, filterClass])

  const toggle = (id) => setAttendance(p => ({ ...p, [id]: STATUS_CYCLE[p[id]] || 'Present' }))
  const markAllPresent = () => {
    const all = {}
    students.forEach(s => { all[s.id] = 'Present' })
    setAttendance(all)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = students.map(s => ({
        student_id: s.id,
        student_name: s.full_name,
        class: s.class,
        section: s.section,
        date,
        status: attendance[s.id] || 'Present',
      }))
      await api.post('/attendance/bulk', payload)
      alert('Attendance saved!')
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const present = Object.values(attendance).filter(v => v === 'Present').length
  const absent = Object.values(attendance).filter(v => v === 'Absent').length
  const late = Object.values(attendance).filter(v => v === 'Late').length

  return (
    <div>
      <TopBar title="Attendance" subtitle="Mark daily attendance" />
      <div className="page-content">
        {/* Filters */}
        <div className="filter-bar">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-36">
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </Select>
          <Select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="w-28">
            <option value="">All Sections</option>
            {SECTIONS.map(s => <option key={s}>{s}</option>)}
          </Select>
          <Button variant="outline" onClick={markAllPresent} className="ml-auto">Mark All Present</Button>
          <Button onClick={handleSave} loading={saving}><Save size={15} />Save Attendance</Button>
        </div>

        {/* Summary */}
        <div className="flex gap-4">
          <div className="bg-emerald-50 text-emerald-700 rounded-lg px-4 py-2 text-sm font-medium">✓ Present: {present}</div>
          <div className="bg-red-50 text-red-600 rounded-lg px-4 py-2 text-sm font-medium">✗ Absent: {absent}</div>
          <div className="bg-amber-50 text-amber-700 rounded-lg px-4 py-2 text-sm font-medium">⏱ Late: {late}</div>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : students.length === 0 ? <EmptyState message="No students found for this class" /> : (
            <table className="data-table w-full">
              <thead><tr><th>#</th><th>Student Name</th><th>Roll No</th><th>Status</th><th>Toggle</th></tr></thead>
              <tbody>
                {students.map((s, i) => {
                  const status = attendance[s.id] || 'Present'
                  const Icon = STATUS_ICON[status]
                  return (
                    <tr key={s.id}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td className="font-medium text-slate-800">{s.full_name}</td>
                      <td>{s.roll_no || '—'}</td>
                      <td><Badge status={status} /></td>
                      <td>
                        <button onClick={() => toggle(s.id)} className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${STATUS_COLOR[status]}`}>
                          <Icon size={20} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
