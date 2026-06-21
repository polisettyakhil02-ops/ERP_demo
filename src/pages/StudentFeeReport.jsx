import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Download } from 'lucide-react'
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
import { DollarSign, Clock, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const CLASSES = ['LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
const EMPTY = {
  student_name:'', father_name:'', mob_number:'', class:'Class 1', student_type:'New',
  old_fee:0, adm_gross_fee:0, adm_concession:0, net_adm_fee:0, paid_adm_fee:0, balance_adm_fee:0,
  gross_term_fee:0, term_concession:0, net_term_fee:0, paid_term_fee:0, balance_term_fee:0,
  remarks:'', status:'Active'
}

const autoCalc = (d) => ({
  ...d,
  net_adm_fee: parseFloat(d.adm_gross_fee || 0) - parseFloat(d.adm_concession || 0),
  balance_adm_fee: (parseFloat(d.adm_gross_fee || 0) - parseFloat(d.adm_concession || 0)) - parseFloat(d.paid_adm_fee || 0),
  net_term_fee: parseFloat(d.gross_term_fee || 0) - parseFloat(d.term_concession || 0),
  balance_term_fee: (parseFloat(d.gross_term_fee || 0) - parseFloat(d.term_concession || 0)) - parseFloat(d.paid_term_fee || 0),
})

export default function StudentFeeReport() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.get('/student-fee-report').then(d => setRecords(Array.isArray(d) ? d : d.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch(); const t = setInterval(fetch, 10000); return () => clearInterval(t) }, [])

  const filtered = records.filter(r =>
    (!search || r.student_name?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterClass || r.class === filterClass) &&
    (!filterType || r.student_type === filterType) &&
    (!filterStatus || r.status === filterStatus)
  )

  const totalNet = filtered.reduce((s, r) => s + (r.net_adm_fee || 0) + (r.net_term_fee || 0), 0)
  const totalPaid = filtered.reduce((s, r) => s + (r.paid_adm_fee || 0) + (r.paid_term_fee || 0), 0)
  const totalBalance = filtered.reduce((s, r) => s + (r.balance_adm_fee || 0) + (r.balance_term_fee || 0), 0)

  const openDialog = (data = null) => setDialog({ open: true, data: data ? { ...data } : { ...EMPTY } })
  const set = (k, v) => setDialog(p => { const d = { ...p.data, [k]: v }; return { ...p, data: autoCalc(d) } })

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...dialog.data }
      Object.keys(payload).forEach(k => { if (typeof payload[k] === 'string' && !isNaN(payload[k]) && payload[k] !== '') payload[k] = parseFloat(payload[k]) })
      if (dialog.data.id) await api.put(`/student-fee-report/${dialog.data.id}`, payload)
      else await api.post('/student-fee-report', payload)
      fetch(); setDialog({ open: false, data: null })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const numField = (label, key) => (
    <FormField label={label}>
      <Input type="number" step="0.01" value={dialog.data?.[key] || 0} onChange={e => set(key, e.target.value)} />
    </FormField>
  )

  return (
    <div>
      <TopBar title="Student Fee Report" subtitle="Academic Year 2026-27" />
      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Net Fee" value={formatCurrency(totalNet)} icon={DollarSign} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
          <StatCard label="Total Paid" value={formatCurrency(totalPaid)} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Total Balance" value={formatCurrency(totalBalance)} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" />
        </div>

        <div className="filter-bar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search student..." />
          <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-36">
            <option value="">All Classes</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </Select>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-32">
            <option value="">All Types</option>
            <option>Existing</option><option>New</option>
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-28">
            <option value="">All</option>
            <option>Active</option><option>Inactive</option>
          </Select>
          <Button onClick={() => openDialog()} className="ml-auto"><Plus size={15} />Add Record</Button>
        </div>

        <div className="data-table-container overflow-x-auto">
          {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState /> : (
            <table className="data-table" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th>#</th><th>Student</th><th>Father</th><th>Phone</th><th>Class</th><th>Type</th>
                  <th>Adm Gross</th><th>Adm Conc.</th><th>Net Adm</th><th>Paid Adm</th><th>Bal Adm</th>
                  <th>Term Gross</th><th>Term Conc.</th><th>Net Term</th><th>Paid Term</th><th>Bal Term</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-800 whitespace-nowrap">{r.student_name}</td>
                    <td className="whitespace-nowrap">{r.father_name}</td>
                    <td>{r.mob_number}</td>
                    <td>{r.class}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-full ${r.student_type === 'New' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{r.student_type}</span></td>
                    {[r.adm_gross_fee, r.adm_concession, r.net_adm_fee, r.paid_adm_fee, r.balance_adm_fee,
                      r.gross_term_fee, r.term_concession, r.net_term_fee, r.paid_term_fee, r.balance_term_fee].map((v, j) => (
                      <td key={j} className={`text-right text-xs ${j === 4 || j === 9 ? 'font-semibold text-amber-600' : ''}`}>₹{(v || 0).toLocaleString('en-IN')}</td>
                    ))}
                    <td><Badge status={r.status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDialog(r)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="icon" onClick={async () => { if (!confirm('Delete?')) return; await api.delete(`/student-fee-report/${r.id}`).catch(() => {}); fetch() }} className="text-red-500"><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title={dialog.data?.id ? 'Edit Fee Record' : 'Add Fee Record'} size="lg">
        {dialog.data && (
          <div className="space-y-4">
            <FormSection title="Student Details">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Student Name" required><Input value={dialog.data.student_name} onChange={e => set('student_name', e.target.value)} /></FormField>
                <FormField label="Father Name" required><Input value={dialog.data.father_name} onChange={e => set('father_name', e.target.value)} /></FormField>
                <FormField label="Mobile" required><Input value={dialog.data.mob_number} onChange={e => set('mob_number', e.target.value)} /></FormField>
                <FormField label="Class" required><Select value={dialog.data.class} onChange={e => set('class', e.target.value)} className="w-full">{CLASSES.map(c => <option key={c}>{c}</option>)}</Select></FormField>
                <FormField label="Student Type" required><Select value={dialog.data.student_type} onChange={e => set('student_type', e.target.value)} className="w-full"><option>New</option><option>Existing</option></Select></FormField>
                <FormField label="Status"><Select value={dialog.data.status} onChange={e => set('status', e.target.value)} className="w-full"><option>Active</option><option>Inactive</option></Select></FormField>
              </div>
            </FormSection>
            <FormSection title="Admission Fee">
              <div className="grid grid-cols-3 gap-3">
                {numField('Gross Adm Fee', 'adm_gross_fee')}
                {numField('Concession', 'adm_concession')}
                <FormField label="Net Adm Fee (auto)"><Input value={dialog.data.net_adm_fee || 0} readOnly className="bg-slate-50" /></FormField>
                {numField('Paid Adm Fee', 'paid_adm_fee')}
                <FormField label="Balance Adm (auto)"><Input value={dialog.data.balance_adm_fee || 0} readOnly className="bg-slate-50" /></FormField>
              </div>
            </FormSection>
            <FormSection title="Term Fee">
              <div className="grid grid-cols-3 gap-3">
                {numField('Gross Term Fee', 'gross_term_fee')}
                {numField('Term Concession', 'term_concession')}
                <FormField label="Net Term (auto)"><Input value={dialog.data.net_term_fee || 0} readOnly className="bg-slate-50" /></FormField>
                {numField('Paid Term Fee', 'paid_term_fee')}
                <FormField label="Balance Term (auto)"><Input value={dialog.data.balance_term_fee || 0} readOnly className="bg-slate-50" /></FormField>
              </div>
            </FormSection>
            <FormField label="Remarks"><Input value={dialog.data.remarks} onChange={e => set('remarks', e.target.value)} maxLength={100} /></FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false, data: null })}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>{dialog.data.id ? 'Update' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
