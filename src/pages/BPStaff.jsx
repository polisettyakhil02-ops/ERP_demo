import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react'
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
import { formatDate, formatCurrency } from '@/lib/utils'
import { BRANCHES, SUBJECTS, CLASS_LIST, TEACHER_ROLES } from '@/lib/constants'

const EMPTY = { full_name:'', role:'Teacher', branch:'', subject_taught:'', classes_taught:[], aadhar_number:'', qualification:'', phone:'', email:'', address:'', joining_date:'', salary:'', status:'Active' }

export default function BPStaff() {
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.get('/staff').then(d => setStaff(Array.isArray(d) ? d : d.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    return (
      (!q || s.full_name?.toLowerCase().includes(q) || s.phone?.includes(q)) &&
      (!filterRole || s.role === filterRole) &&
      (!filterBranch || s.branch === filterBranch)
    )
  })

  const set = (k, v) => setDialog(p => ({ ...p, data: { ...p.data, [k]: v } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialog.data.id) await api.put(`/staff/${dialog.data.id}`, dialog.data)
      else await api.post('/staff', dialog.data)
      fetch(); setDialog({ open: false, data: null })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this staff member?')) return
    await api.delete(`/staff/${id}`).catch(() => {})
    fetch()
  }

  const toggleStatus = async (s) => {
    await api.put(`/staff/${s.id}`, { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' }).catch(() => {})
    fetch()
  }

  return (
    <div>
      <TopBar title="Staff" subtitle={`${staff.length} staff members`} />
      <div className="page-content">
        <div className="filter-bar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or phone..." />
          <Select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="w-40">
            <option value="">All Roles</option>
            {TEACHER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            <option>Admin</option><option>Support</option>
          </Select>
          <Select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="w-48">
            <option value="">All Branches</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => navigate('/teacher-form')}><UserPlus size={15} />Register Teacher</Button>
            <Button onClick={() => setDialog({ open: true, data: { ...EMPTY } })}><Plus size={15} />Quick Add</Button>
          </div>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState /> : (
            <table className="data-table w-full">
              <thead><tr><th>Name</th><th>Role</th><th>Branch</th><th>Subject</th><th>Classes</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-800">{s.full_name}</td>
                    <td><span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{s.role}</span></td>
                    <td className="text-xs text-slate-500">{s.branch || '—'}</td>
                    <td>{s.subject_taught || '—'}</td>
                    <td>
                      {Array.isArray(s.classes_taught) && s.classes_taught.length > 0
                        ? <span className="text-xs text-slate-600">{s.classes_taught.slice(0,3).join(', ')}{s.classes_taught.length > 3 ? ` +${s.classes_taught.length - 3}` : ''}</span>
                        : '—'}
                    </td>
                    <td>{s.phone || '—'}</td>
                    <td>
                      <button onClick={() => toggleStatus(s)}>
                        <Badge status={s.status} />
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, data: { ...s, classes_taught: s.classes_taught || [] } })}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-red-500"><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title={dialog.data?.id ? 'Edit Staff' : 'Quick Add Staff'} size="lg">
        {dialog.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Full Name" required><Input value={dialog.data.full_name} onChange={e => set('full_name', e.target.value)} /></FormField>
              <FormField label="Role" required>
                <select value={dialog.data.role} onChange={e => set('role', e.target.value)} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {TEACHER_ROLES.map(r => <option key={r}>{r}</option>)}
                  <option>Admin</option><option>Support</option>
                </select>
              </FormField>
              <FormField label="Branch">
                <select value={dialog.data.branch || ''} onChange={e => set('branch', e.target.value)} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Select branch —</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </FormField>
              <FormField label="Subject Taught">
                <select value={dialog.data.subject_taught || ''} onChange={e => set('subject_taught', e.target.value)} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Select subject —</option>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Phone"><Input value={dialog.data.phone} onChange={e => set('phone', e.target.value.replace(/\D/g,'').slice(0,10))} maxLength={10} placeholder="10-digit number" /></FormField>
              <FormField label="Aadhar Number"><Input value={dialog.data.aadhar_number || ''} onChange={e => set('aadhar_number', e.target.value.replace(/\D/g,'').slice(0,12))} maxLength={12} placeholder="12-digit Aadhar" /></FormField>
              <FormField label="Email"><Input type="email" value={dialog.data.email} onChange={e => set('email', e.target.value)} /></FormField>
              <FormField label="Qualification"><Input value={dialog.data.qualification} onChange={e => set('qualification', e.target.value)} /></FormField>
              <FormField label="Salary (₹)"><Input type="number" value={dialog.data.salary} onChange={e => set('salary', e.target.value)} /></FormField>
              <FormField label="Joining Date"><Input type="date" value={dialog.data.joining_date || ''} onChange={e => set('joining_date', e.target.value)} /></FormField>
              <FormField label="Status"><Select value={dialog.data.status} onChange={e => set('status', e.target.value)} className="w-full"><option>Active</option><option>Inactive</option><option>On Leave</option></Select></FormField>
            </div>
            <FormField label="Address"><textarea value={dialog.data.address} onChange={e => set('address', e.target.value)} className="w-full h-16 rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" /></FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false, data: null })}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>{dialog.data.id ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
