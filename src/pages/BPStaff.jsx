import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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

const EMPTY = { full_name:'', role:'Teacher', subject_taught:'', qualification:'', phone:'', email:'', address:'', joining_date:'', salary:'', status:'Active' }

export default function BPStaff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.get('/staff').then(d => setStaff(Array.isArray(d) ? d : d.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    return (!q || s.full_name?.toLowerCase().includes(q)) && (!filterRole || s.role === filterRole)
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search staff..." />
          <Select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="w-36">
            <option value="">All Roles</option>
            <option>Teacher</option><option>Admin</option><option>Support</option>
          </Select>
          <Button onClick={() => setDialog({ open: true, data: { ...EMPTY } })} className="ml-auto"><Plus size={15} />Add Staff</Button>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState /> : (
            <table className="data-table w-full">
              <thead><tr><th>Name</th><th>Role</th><th>Subject</th><th>Phone</th><th>Email</th><th>Salary</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-800">{s.full_name}</td>
                    <td><span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{s.role}</span></td>
                    <td>{s.subject_taught || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td className="text-xs">{s.email || '—'}</td>
                    <td>{s.salary ? formatCurrency(s.salary) : '—'}</td>
                    <td>{formatDate(s.joining_date)}</td>
                    <td>
                      <button onClick={() => toggleStatus(s)}>
                        <Badge status={s.status} />
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, data: { ...s } })}><Pencil size={14} /></Button>
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

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title={dialog.data?.id ? 'Edit Staff' : 'Add Staff Member'}>
        {dialog.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Full Name" required><Input value={dialog.data.full_name} onChange={e => set('full_name', e.target.value)} /></FormField>
              <FormField label="Role" required><Select value={dialog.data.role} onChange={e => set('role', e.target.value)} className="w-full"><option>Teacher</option><option>Admin</option><option>Support</option></Select></FormField>
              <FormField label="Subject Taught"><Input value={dialog.data.subject_taught} onChange={e => set('subject_taught', e.target.value)} /></FormField>
              <FormField label="Qualification"><Input value={dialog.data.qualification} onChange={e => set('qualification', e.target.value)} /></FormField>
              <FormField label="Phone"><Input value={dialog.data.phone} onChange={e => set('phone', e.target.value)} /></FormField>
              <FormField label="Email"><Input type="email" value={dialog.data.email} onChange={e => set('email', e.target.value)} /></FormField>
              <FormField label="Salary (₹)"><Input type="number" value={dialog.data.salary} onChange={e => set('salary', e.target.value)} /></FormField>
              <FormField label="Joining Date"><Input type="date" value={dialog.data.joining_date || ''} onChange={e => set('joining_date', e.target.value)} /></FormField>
              <FormField label="Status"><Select value={dialog.data.status} onChange={e => set('status', e.target.value)} className="w-full"><option>Active</option><option>Inactive</option></Select></FormField>
            </div>
            <FormField label="Address"><textarea value={dialog.data.address} onChange={e => set('address', e.target.value)} className="w-full h-20 rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" /></FormField>
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
