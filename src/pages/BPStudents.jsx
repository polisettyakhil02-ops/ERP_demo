import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, UserCircle } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, FormSection, FormField } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import SearchInput from '@/components/common/SearchInput'
import EmptyState from '@/components/common/EmptyState'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

const CLASSES = ['LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
const SECTIONS = ['A','B','C','D']
const GENDERS = ['Male','Female','Other']
const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-']

const EMPTY = { admission_no:'', full_name:'', dob:'', gender:'Male', blood_group:'', class:'Class 1', section:'A', roll_no:'', parent_name:'', parent_phone:'', parent_email:'', address:'', city:'', joining_date:'', status:'Active' }

export default function BPStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.get('/students').then(d => setStudents(Array.isArray(d) ? d : d.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch(); const t = setInterval(fetch, 10000); return () => clearInterval(t) }, [])

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchQ = !q || s.full_name?.toLowerCase().includes(q) || s.admission_no?.toLowerCase().includes(q)
    const matchC = !filterClass || s.class === filterClass
    const matchS = !filterStatus || s.status === filterStatus
    return matchQ && matchC && matchS
  })

  const openAdd = () => setDialog({ open: true, data: { ...EMPTY } })
  const openEdit = (s) => setDialog({ open: true, data: { ...s } })
  const closeDialog = () => setDialog({ open: false, data: null })

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialog.data.id) await api.put(`/students/${dialog.data.id}`, dialog.data)
      else await api.post('/students', dialog.data)
      fetch(); closeDialog()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this student?')) return
    await api.delete(`/students/${id}`).catch(() => {})
    fetch()
  }

  const set = (k, v) => setDialog(p => ({ ...p, data: { ...p.data, [k]: v } }))

  return (
    <div>
      <TopBar title="Students" subtitle={`${students.length} students enrolled`} />
      <div className="page-content">
        <div className="filter-bar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or admission no..." />
          <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-36">
            <option value="">All Classes</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-32">
            <option value="">All Status</option>
            <option>Active</option><option>Inactive</option>
          </Select>
          <Button onClick={openAdd} className="ml-auto"><Plus size={15} />Add Student</Button>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState /> : (
            <table className="data-table w-full">
              <thead>
                <tr><th>Student</th><th>Adm. No</th><th>Class</th><th>Roll No</th><th>Parent Phone</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          {s.photo_url ? <img src={s.photo_url} className="w-8 h-8 rounded-full object-cover" alt="" /> : <UserCircle size={18} className="text-indigo-400" />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{s.full_name}</p>
                          <p className="text-xs text-slate-400">{s.gender}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs">{s.admission_no || '—'}</td>
                    <td>{s.class}{s.section ? `-${s.section}` : ''}</td>
                    <td>{s.roll_no || '—'}</td>
                    <td>{s.parent_phone || '—'}</td>
                    <td>{formatDate(s.joining_date)}</td>
                    <td><Badge status={s.status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-600"><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={closeDialog} title={dialog.data?.id ? 'Edit Student' : 'Add Student'} size="md">
        {dialog.data && (
          <div className="space-y-4">
            <FormSection title="Basic Information">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Full Name" required><Input value={dialog.data.full_name} onChange={e => set('full_name', e.target.value)} /></FormField>
                <FormField label="Admission No"><Input value={dialog.data.admission_no} onChange={e => set('admission_no', e.target.value)} /></FormField>
                <FormField label="Date of Birth"><Input type="date" value={dialog.data.dob || ''} onChange={e => set('dob', e.target.value)} /></FormField>
                <FormField label="Gender"><Select value={dialog.data.gender} onChange={e => set('gender', e.target.value)} className="w-full">{GENDERS.map(g => <option key={g}>{g}</option>)}</Select></FormField>
                <FormField label="Blood Group"><Select value={dialog.data.blood_group} onChange={e => set('blood_group', e.target.value)} className="w-full"><option value="">Select</option>{BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}</Select></FormField>
                <FormField label="Status"><Select value={dialog.data.status} onChange={e => set('status', e.target.value)} className="w-full"><option>Active</option><option>Inactive</option></Select></FormField>
              </div>
            </FormSection>
            <FormSection title="Class Details">
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Class" required><Select value={dialog.data.class} onChange={e => set('class', e.target.value)} className="w-full">{CLASSES.map(c => <option key={c}>{c}</option>)}</Select></FormField>
                <FormField label="Section"><Select value={dialog.data.section} onChange={e => set('section', e.target.value)} className="w-full"><option value="">—</option>{SECTIONS.map(s => <option key={s}>{s}</option>)}</Select></FormField>
                <FormField label="Roll No"><Input value={dialog.data.roll_no} onChange={e => set('roll_no', e.target.value)} /></FormField>
              </div>
            </FormSection>
            <FormSection title="Parent / Contact">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Parent Name"><Input value={dialog.data.parent_name} onChange={e => set('parent_name', e.target.value)} /></FormField>
                <FormField label="Parent Phone"><Input value={dialog.data.parent_phone} onChange={e => set('parent_phone', e.target.value)} /></FormField>
                <FormField label="Parent Email"><Input type="email" value={dialog.data.parent_email} onChange={e => set('parent_email', e.target.value)} /></FormField>
                <FormField label="Joining Date"><Input type="date" value={dialog.data.joining_date || ''} onChange={e => set('joining_date', e.target.value)} /></FormField>
                <FormField label="City"><Input value={dialog.data.city} onChange={e => set('city', e.target.value)} /></FormField>
              </div>
            </FormSection>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>{dialog.data.id ? 'Update' : 'Create'} Student</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
