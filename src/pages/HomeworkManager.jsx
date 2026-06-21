import { useState, useEffect } from 'react'
import { Plus, Trash2, Bell, CheckCircle } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, FormField } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import EmptyState from '@/components/common/EmptyState'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

const CLASSES = ['LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
const SUBJECTS = ['Maths','Science','English','Hindi','Social Studies','Computer']
const SECTIONS = ['A','B','C','D']

const EMPTY = { title:'', class:'Class 1', section:'', subject:'Maths', description:'', due_date:'', assigned_by:'', status:'Active' }

export default function HomeworkManager() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterClass, setFilterClass] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)
  const [notifying, setNotifying] = useState(null)

  const fetch = () => {
    setLoading(true)
    api.get('/homework').then(d => setItems(Array.isArray(d) ? d : d.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const filtered = items.filter(i =>
    (!filterClass || i.class === filterClass) &&
    (!filterSubject || i.subject === filterSubject) &&
    (!filterStatus || i.status === filterStatus)
  )

  const set = (k, v) => setDialog(p => ({ ...p, data: { ...p.data, [k]: v } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialog.data.id) await api.put(`/homework/${dialog.data.id}`, dialog.data)
      else await api.post('/homework', dialog.data)
      fetch(); setDialog({ open: false, data: null })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const handleNotify = async (hw) => {
    setNotifying(hw.id)
    try {
      await api.post(`/homework/${hw.id}/notify`)
      alert(`Notifications sent to students in ${hw.class}!`)
    } catch (e) { alert(e.message) } finally { setNotifying(null) }
  }

  const toggleStatus = async (hw) => {
    await api.put(`/homework/${hw.id}`, { ...hw, status: hw.status === 'Active' ? 'Completed' : 'Active' }).catch(() => {})
    fetch()
  }

  return (
    <div>
      <TopBar title="Homework Manager" subtitle="Assign and track homework" />
      <div className="page-content">
        <div className="flex gap-3 flex-wrap mb-4">
          <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-36">
            <option value="">All Classes</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </Select>
          <Select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="w-36">
            <option value="">All Subjects</option>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-32">
            <option value="">All Status</option>
            <option>Active</option><option>Completed</option>
          </Select>
          <Button onClick={() => setDialog({ open: true, data: { ...EMPTY } })} className="ml-auto"><Plus size={15} />Assign Homework</Button>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState /> : (
            <table className="data-table w-full">
              <thead><tr><th>Title</th><th>Class</th><th>Subject</th><th>Due Date</th><th>Assigned By</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(hw => (
                  <tr key={hw.id}>
                    <td>
                      <p className="font-medium text-slate-800">{hw.title}</p>
                      {hw.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{hw.description}</p>}
                    </td>
                    <td>{hw.class}{hw.section ? ` - ${hw.section}` : ''}</td>
                    <td><span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{hw.subject}</span></td>
                    <td>{formatDate(hw.due_date)}</td>
                    <td>{hw.assigned_by || '—'}</td>
                    <td>
                      <button onClick={() => toggleStatus(hw)}>
                        <Badge status={hw.status} />
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleNotify(hw)} loading={notifying === hw.id} className="text-indigo-600">
                          <Bell size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={async () => { if (!confirm('Delete?')) return; await api.delete(`/homework/${hw.id}`).catch(() => {}); fetch() }} className="text-red-500">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title="Assign Homework">
        {dialog.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Title" required><Input value={dialog.data.title} onChange={e => set('title', e.target.value)} /></FormField>
              <FormField label="Subject" required><Select value={dialog.data.subject} onChange={e => set('subject', e.target.value)} className="w-full">{SUBJECTS.map(s => <option key={s}>{s}</option>)}</Select></FormField>
              <FormField label="Class" required><Select value={dialog.data.class} onChange={e => set('class', e.target.value)} className="w-full">{CLASSES.map(c => <option key={c}>{c}</option>)}</Select></FormField>
              <FormField label="Section"><Select value={dialog.data.section} onChange={e => set('section', e.target.value)} className="w-full"><option value="">All Sections</option>{SECTIONS.map(s => <option key={s}>{s}</option>)}</Select></FormField>
              <FormField label="Due Date" required><Input type="date" value={dialog.data.due_date || ''} onChange={e => set('due_date', e.target.value)} /></FormField>
              <FormField label="Assigned By"><Input value={dialog.data.assigned_by} onChange={e => set('assigned_by', e.target.value)} /></FormField>
            </div>
            <FormField label="Description">
              <textarea value={dialog.data.description} onChange={e => set('description', e.target.value)} className="w-full h-24 rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Homework description..." />
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false, data: null })}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Assign</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
