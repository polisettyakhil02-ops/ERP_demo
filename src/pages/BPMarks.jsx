import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, FormField } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import EmptyState from '@/components/common/EmptyState'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import api from '@/lib/api'
import { calcGrade } from '@/lib/utils'

const CLASSES = ['LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
const EXAM_TYPES = ['Unit Test','Mid Term','Final']
const SUBJECTS = ['Maths','Science','English','Hindi','Social Studies','Computer']

const GRADE_COLORS = { 'A+':'bg-emerald-100 text-emerald-700', A:'bg-blue-100 text-blue-700', B:'bg-indigo-100 text-indigo-700', C:'bg-yellow-100 text-yellow-700', D:'bg-orange-100 text-orange-700', F:'bg-red-100 text-red-700' }

const EMPTY = { student_id:'', student_name:'', class:'Class 1', exam_type:'Unit Test', subject:'Maths', marks_obtained:'', max_marks:'100' }

export default function BPMarks() {
  const [marks, setMarks] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterClass, setFilterClass] = useState('Class 1')
  const [filterExam, setFilterExam] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    Promise.all([
      api.get('/marks', { class: filterClass }),
      api.get('/students', { class: filterClass }),
    ]).then(([m, s]) => {
      setMarks(Array.isArray(m) ? m : m.data || [])
      setStudents(Array.isArray(s) ? s : s.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [filterClass])

  const filtered = filterExam ? marks.filter(m => m.exam_type === filterExam) : marks

  const studentMarks = students.map(s => {
    const sm = filtered.filter(m => m.student_id === s.id)
    const total = sm.reduce((t, m) => t + (m.marks_obtained || 0), 0)
    const maxTotal = sm.reduce((t, m) => t + (m.max_marks || 0), 0)
    const pct = maxTotal ? Math.round((total / maxTotal) * 100) : 0
    const subjectMap = sm.reduce((acc, m) => { acc[m.subject] = m; return acc }, {})
    return { ...s, subjectMap, total, maxTotal, pct, grade: calcGrade(total, maxTotal) }
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...dialog.data,
        marks_obtained: parseFloat(dialog.data.marks_obtained),
        max_marks: parseFloat(dialog.data.max_marks),
        grade: calcGrade(dialog.data.marks_obtained, dialog.data.max_marks),
      }
      if (dialog.data.id) await api.put(`/marks/${dialog.data.id}`, payload)
      else await api.post('/marks', payload)
      fetch(); setDialog({ open: false, data: null })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const set = (k, v) => setDialog(p => ({ ...p, data: { ...p.data, [k]: v } }))
  const selectStudent = (id) => {
    const s = students.find(s => s.id === id)
    setDialog(p => ({ ...p, data: { ...p.data, student_id: id, student_name: s?.full_name || '', class: filterClass } }))
  }

  return (
    <div>
      <TopBar title="Marks" subtitle="View and manage student marks" />
      <div className="page-content">
        <div className="flex gap-3 flex-wrap mb-4">
          <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-36">
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </Select>
          <Select value={filterExam} onChange={e => setFilterExam(e.target.value)} className="w-36">
            <option value="">All Exams</option>
            {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
          </Select>
          <Button onClick={() => setDialog({ open: true, data: { ...EMPTY, class: filterClass } })} className="ml-auto"><Plus size={15} />Add Marks</Button>
        </div>

        <div className="data-table-container overflow-x-auto">
          {loading ? <LoadingSpinner /> : studentMarks.length === 0 ? <EmptyState /> : (
            <table className="data-table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Student</th>
                  {SUBJECTS.map(s => <th key={s} className="text-center">{s}</th>)}
                  <th className="text-center">Total</th>
                  <th className="text-center">%</th>
                  <th className="text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {studentMarks.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-800">{s.full_name}</td>
                    {SUBJECTS.map(sub => {
                      const m = s.subjectMap[sub]
                      return <td key={sub} className="text-center text-xs">{m ? `${m.marks_obtained}/${m.max_marks}` : '—'}</td>
                    })}
                    <td className="text-center font-semibold">{s.total}/{s.maxTotal}</td>
                    <td className="text-center">{s.pct}%</td>
                    <td className="text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GRADE_COLORS[s.grade] || 'bg-gray-100 text-gray-600'}`}>{s.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title="Add Marks">
        {dialog.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Student" required>
                <Select value={dialog.data.student_id} onChange={e => selectStudent(e.target.value)} className="w-full">
                  <option value="">Select Student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </Select>
              </FormField>
              <FormField label="Exam Type" required><Select value={dialog.data.exam_type} onChange={e => set('exam_type', e.target.value)} className="w-full">{EXAM_TYPES.map(t => <option key={t}>{t}</option>)}</Select></FormField>
              <FormField label="Subject" required><Select value={dialog.data.subject} onChange={e => set('subject', e.target.value)} className="w-full">{SUBJECTS.map(s => <option key={s}>{s}</option>)}</Select></FormField>
              <FormField label="Marks Obtained" required><Input type="number" value={dialog.data.marks_obtained} onChange={e => set('marks_obtained', e.target.value)} /></FormField>
              <FormField label="Max Marks"><Input type="number" value={dialog.data.max_marks} onChange={e => set('max_marks', e.target.value)} /></FormField>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false, data: null })}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save Marks</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
