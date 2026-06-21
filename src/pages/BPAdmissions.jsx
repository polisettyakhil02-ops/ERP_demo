import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Eye, UserPlus } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, FormSection, FormField } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import SearchInput from '@/components/common/SearchInput'
import EmptyState from '@/components/common/EmptyState'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import StatCard from '@/components/common/StatCard'
import { Users } from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

const BRANCHES = ['Hyderabad','Secunderabad','Kukatpally','Miyapur']
const CLASSES = ['LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
const STATUSES = ['Enquiry','Applied','Under Review','Admitted','Rejected']
const YEARS = ['2024-25','2025-26','2026-27']

const EMPTY = {
  academic_year:'2026-27', application_no:'', student_name:'', gender:'Male', dob:'', class_sought:'Class 1',
  branch:'Hyderabad', state:'Telangana', form_status:'Enquiry',
  father_name:'', father_mobile:'', mother_name:'', mother_mobile:'',
  communication_address:'', fee_payable_amount:''
}

const STATUS_COLORS = { Enquiry:'yellow', Applied:'blue', 'Under Review':'amber', Admitted:'green', Rejected:'red' }

export default function BPAdmissions() {
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.get('/admissions').then(d => setAdmissions(Array.isArray(d) ? d : d.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const filtered = admissions.filter(a => {
    const q = search.toLowerCase()
    return (
      (!q || a.student_name?.toLowerCase().includes(q) || a.application_no?.toLowerCase().includes(q)) &&
      (!filterBranch || a.branch === filterBranch) &&
      (!filterStatus || a.form_status === filterStatus) &&
      (!filterYear || a.academic_year === filterYear)
    )
  })

  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: admissions.filter(a => a.form_status === s).length }), {})

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialog.data.id) await api.put(`/admissions/${dialog.data.id}`, dialog.data)
      else await api.post('/admissions', dialog.data)
      fetch(); setDialog({ open: false, data: null })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const handleConvert = async (id) => {
    if (!confirm('Convert this admission to a student record?')) return
    try { await api.post(`/admissions/${id}/convert`); alert('Converted to student!'); fetch() } catch (e) { alert(e.message) }
  }

  const set = (k, v) => setDialog(p => ({ ...p, data: { ...p.data, [k]: v } }))

  return (
    <div>
      <TopBar title="Admissions" subtitle={`${admissions.length} applications`} />
      <div className="page-content">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total" value={admissions.length.toString()} icon={Users} iconBg="bg-slate-50" iconColor="text-slate-600" />
          <StatCard label="Enquiry" value={counts.Enquiry?.toString() || '0'} icon={Users} iconBg="bg-yellow-50" iconColor="text-yellow-600" />
          <StatCard label="Applied" value={counts.Applied?.toString() || '0'} icon={Users} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <StatCard label="Admitted" value={counts.Admitted?.toString() || '0'} icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Rejected" value={counts.Rejected?.toString() || '0'} icon={Users} iconBg="bg-red-50" iconColor="text-red-500" />
        </div>

        <div className="filter-bar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or app no..." />
          <Select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="w-36">
            <option value="">All Branches</option>
            {BRANCHES.map(b => <option key={b}>{b}</option>)}
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-36">
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </Select>
          <Select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-28">
            <option value="">All Years</option>
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </Select>
          <Button onClick={() => setDialog({ open: true, data: { ...EMPTY } })} className="ml-auto"><Plus size={15} />New Admission</Button>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState /> : (
            <table className="data-table w-full">
              <thead><tr><th>App No</th><th>Student</th><th>Class</th><th>Branch</th><th>Year</th><th>Fee Payable</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs">{a.application_no || '—'}</td>
                    <td>
                      <p className="font-medium text-slate-800">{a.student_name}</p>
                      <p className="text-xs text-slate-400">{a.father_name}</p>
                    </td>
                    <td>{a.class_sought}</td>
                    <td>{a.branch || '—'}</td>
                    <td>{a.academic_year}</td>
                    <td>₹{(a.fee_payable_amount || 0).toLocaleString('en-IN')}</td>
                    <td><Badge status={a.form_status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, data: { ...a } })}><Pencil size={14} /></Button>
                        {a.form_status === 'Admitted' && (
                          <Button variant="ghost" size="icon" onClick={() => handleConvert(a.id)} className="text-emerald-600"><UserPlus size={14} /></Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={async () => { if (!confirm('Delete?')) return; await api.delete(`/admissions/${a.id}`).catch(() => {}); fetch() }} className="text-red-500"><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title={dialog.data?.id ? 'Edit Admission' : 'New Admission'} size="lg">
        {dialog.data && (
          <div className="space-y-4">
            <FormSection title="Student Information">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Student Name" required><Input value={dialog.data.student_name} onChange={e => set('student_name', e.target.value)} /></FormField>
                <FormField label="Application No"><Input value={dialog.data.application_no} onChange={e => set('application_no', e.target.value)} /></FormField>
                <FormField label="Gender" required><Select value={dialog.data.gender} onChange={e => set('gender', e.target.value)} className="w-full"><option>Male</option><option>Female</option></Select></FormField>
                <FormField label="Date of Birth"><Input type="date" value={dialog.data.dob || ''} onChange={e => set('dob', e.target.value)} /></FormField>
                <FormField label="Class Sought" required><Select value={dialog.data.class_sought} onChange={e => set('class_sought', e.target.value)} className="w-full">{CLASSES.map(c => <option key={c}>{c}</option>)}</Select></FormField>
                <FormField label="Academic Year" required><Select value={dialog.data.academic_year} onChange={e => set('academic_year', e.target.value)} className="w-full">{YEARS.map(y => <option key={y}>{y}</option>)}</Select></FormField>
                <FormField label="Branch"><Select value={dialog.data.branch} onChange={e => set('branch', e.target.value)} className="w-full">{BRANCHES.map(b => <option key={b}>{b}</option>)}</Select></FormField>
                <FormField label="Status"><Select value={dialog.data.form_status} onChange={e => set('form_status', e.target.value)} className="w-full">{STATUSES.map(s => <option key={s}>{s}</option>)}</Select></FormField>
              </div>
            </FormSection>
            <FormSection title="Parent Information">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Father Name"><Input value={dialog.data.father_name} onChange={e => set('father_name', e.target.value)} /></FormField>
                <FormField label="Father Mobile" required><Input value={dialog.data.father_mobile} onChange={e => set('father_mobile', e.target.value)} /></FormField>
                <FormField label="Mother Name"><Input value={dialog.data.mother_name} onChange={e => set('mother_name', e.target.value)} /></FormField>
                <FormField label="Mother Mobile" required><Input value={dialog.data.mother_mobile} onChange={e => set('mother_mobile', e.target.value)} /></FormField>
              </div>
            </FormSection>
            <FormSection title="Fee Details">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Fee Payable (₹)" required><Input type="number" value={dialog.data.fee_payable_amount} onChange={e => set('fee_payable_amount', e.target.value)} /></FormField>
                <FormField label="Communication Address" required>
                  <textarea value={dialog.data.communication_address} onChange={e => set('communication_address', e.target.value)} className="w-full h-16 rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </FormField>
              </div>
            </FormSection>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false, data: null })}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>{dialog.data.id ? 'Update' : 'Submit'} Admission</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
