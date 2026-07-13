import { useState, useEffect } from 'react'
import { Plus, Printer, Trash2 } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, FormSection, FormField } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import EmptyState from '@/components/common/EmptyState'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import api from '@/lib/api'
import { generateHallTicketPDF } from '@/utils/pdfExport'

const CLASSES = ['LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
const EXAM_TYPES = ['Unit Test','Mid Term','Final','Annual']
const SUBJECTS = ['Maths','Science','English','Hindi','Social Studies','Computer']

const emptySubjectRow = () => ({ subject: 'Maths', date: '', time: '', duration: '3 Hours', max_marks: 100 })

const EMPTY = {
  exam_name: '', class: 'Class 10', section: '', academic_year: '2026-27',
  exam_type: 'Final', center: '', invigilator: '',
  subjects: [emptySubjectRow()]
}

export default function HallTicket() {
  const [schedules, setSchedules] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.get('/exam-schedules').then(d => setSchedules(Array.isArray(d) ? d : d.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const set = (k, v) => setDialog(p => ({ ...p, data: { ...p.data, [k]: v } }))
  const setSubRow = (i, k, v) => setDialog(p => {
    const subs = [...p.data.subjects]
    subs[i] = { ...subs[i], [k]: v }
    return { ...p, data: { ...p.data, subjects: subs } }
  })
  const addSubRow = () => setDialog(p => ({ ...p, data: { ...p.data, subjects: [...p.data.subjects, emptySubjectRow()] } }))
  const removeSubRow = (i) => setDialog(p => ({ ...p, data: { ...p.data, subjects: p.data.subjects.filter((_, j) => j !== i) } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialog.data.id) await api.put(`/exam-schedules/${dialog.data.id}`, dialog.data)
      else await api.post('/exam-schedules', dialog.data)
      fetch(); setDialog({ open: false, data: null })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const handleGenerate = async (schedule) => {
    try {
      const stus = await api.get('/students', { class: schedule.class, section: schedule.section || undefined })
      const stuList = Array.isArray(stus) ? stus : stus.data || []
      if (stuList.length === 0) { alert('No students found for this class'); return }
      generateHallTicketPDF(schedule, stuList)
    } catch (e) { alert('Error generating PDF: ' + e.message) }
  }

  return (
    <div>
      <TopBar title="Hall Tickets" subtitle="Create exam schedules & generate hall tickets" />
      <div className="page-content">
        <div className="flex justify-end mb-4">
          <Button onClick={() => setDialog({ open: true, data: { ...EMPTY, subjects: [emptySubjectRow()] } })}><Plus size={15} />Create Exam Schedule</Button>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : schedules.length === 0 ? <EmptyState message="No exam schedules created" /> : (
            <table className="data-table w-full">
              <thead><tr><th>Exam Name</th><th>Class</th><th>Type</th><th>Year</th><th>Center</th><th>Subjects</th><th>Actions</th></tr></thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-800">{s.exam_name}</td>
                    <td>{s.class}{s.section ? ` - ${s.section}` : ''}</td>
                    <td><span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{s.exam_type}</span></td>
                    <td>{s.academic_year}</td>
                    <td>{s.center || '—'}</td>
                    <td>{Array.isArray(s.subjects) ? s.subjects.length : '—'} subjects</td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleGenerate(s)} className="text-indigo-600"><Printer size={15} /></Button>
                        <Button variant="ghost" size="icon" onClick={async () => { if (!confirm('Delete?')) return; await api.delete(`/exam-schedules/${s.id}`).catch(() => {}); fetch() }} className="text-red-500"><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title="Exam Schedule" size="lg">
        {dialog.data && (
          <div className="space-y-4">
            <FormSection title="Exam Details">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Exam Name" required><Input value={dialog.data.exam_name} onChange={e => set('exam_name', e.target.value)} /></FormField>
                <FormField label="Academic Year"><Select value={dialog.data.academic_year} onChange={e => set('academic_year', e.target.value)} className="w-full"><option>2024-25</option><option>2025-26</option><option>2026-27</option></Select></FormField>
                <FormField label="Class" required><Select value={dialog.data.class} onChange={e => set('class', e.target.value)} className="w-full">{CLASSES.map(c => <option key={c}>{c}</option>)}</Select></FormField>
                <FormField label="Exam Type"><Select value={dialog.data.exam_type} onChange={e => set('exam_type', e.target.value)} className="w-full">{EXAM_TYPES.map(t => <option key={t}>{t}</option>)}</Select></FormField>
                <FormField label="Center"><Input value={dialog.data.center} onChange={e => set('center', e.target.value)} /></FormField>
                <FormField label="Invigilator"><Input value={dialog.data.invigilator} onChange={e => set('invigilator', e.target.value)} /></FormField>
              </div>
            </FormSection>

            <FormSection title="Subject Schedule">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 text-xs text-slate-500 font-medium w-32">Subject</th>
                      <th className="text-left py-2 text-xs text-slate-500 font-medium w-32">Date</th>
                      <th className="text-left py-2 text-xs text-slate-500 font-medium w-24">Time</th>
                      <th className="text-left py-2 text-xs text-slate-500 font-medium w-28">Duration</th>
                      <th className="text-left py-2 text-xs text-slate-500 font-medium w-20">Max Marks</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {dialog.data.subjects.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1 pr-2"><Select value={row.subject} onChange={e => setSubRow(i, 'subject', e.target.value)} className="w-full text-xs">{SUBJECTS.map(s => <option key={s}>{s}</option>)}</Select></td>
                        <td className="py-1 pr-2"><Input type="date" value={row.date || ''} onChange={e => setSubRow(i, 'date', e.target.value)} className="text-xs" /></td>
                        <td className="py-1 pr-2"><Input value={row.time} onChange={e => setSubRow(i, 'time', e.target.value)} placeholder="9:00 AM" className="text-xs" /></td>
                        <td className="py-1 pr-2"><Input value={row.duration} onChange={e => setSubRow(i, 'duration', e.target.value)} className="text-xs" /></td>
                        <td className="py-1 pr-2"><Input type="number" value={row.max_marks} onChange={e => setSubRow(i, 'max_marks', parseInt(e.target.value))} className="text-xs" /></td>
                        <td className="py-1"><button onClick={() => removeSubRow(i)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addSubRow} className="mt-2"><Plus size={13} />Add Subject</Button>
            </FormSection>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false, data: null })}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save Schedule</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
