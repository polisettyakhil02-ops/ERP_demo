import { useState, useEffect } from 'react'
import { Plus, CheckCircle } from 'lucide-react'
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
import { formatDate, formatCurrency } from '@/lib/utils'

const FEE_TYPES = ['Tuition','Annual','Transport','Exam','Other']
const PAY_MODES = ['Cash','Online','Cheque']
const EMPTY = { student_id:'', student_name:'', academic_year:'2026-27', fee_type:'Tuition', amount:'', payment_date:'', payment_mode:'Cash', receipt_no:'', status:'Pending' }

export default function BPFees() {
  const [fees, setFees] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    Promise.all([
      api.get('/fee-payments'),
      api.get('/students'),
    ]).then(([f, s]) => {
      setFees(Array.isArray(f) ? f : f.data || [])
      setStudents(Array.isArray(s) ? s : s.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch(); const t = setInterval(fetch, 10000); return () => clearInterval(t) }, [])

  const filtered = fees.filter(f => {
    const q = search.toLowerCase()
    return (!q || f.student_name?.toLowerCase().includes(q)) && (!filterType || f.fee_type === filterType) && (!filterStatus || f.status === filterStatus)
  })

  const collected = fees.filter(f => f.status === 'Paid').reduce((s, f) => s + (f.amount || 0), 0)
  const pending = fees.filter(f => f.status === 'Pending').reduce((s, f) => s + (f.amount || 0), 0)
  const thisMonth = fees.filter(f => {
    const d = new Date(f.payment_date)
    const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() && f.status === 'Paid'
  }).reduce((s, f) => s + (f.amount || 0), 0)

  const markPaid = async (id) => {
    await api.put(`/fee-payments/${id}`, { status: 'Paid', payment_date: new Date().toISOString().split('T')[0] }).catch(() => {})
    fetch()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...dialog.data, amount: parseFloat(dialog.data.amount) }
      if (dialog.data.id) await api.put(`/fee-payments/${dialog.data.id}`, payload)
      else await api.post('/fee-payments', payload)
      fetch(); setDialog({ open: false, data: null })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const set = (k, v) => setDialog(p => ({ ...p, data: { ...p.data, [k]: v } }))

  const selectStudent = (id) => {
    const s = students.find(s => s.id === id)
    setDialog(p => ({ ...p, data: { ...p.data, student_id: id, student_name: s?.full_name || '' } }))
  }

  return (
    <div>
      <TopBar title="Fee Payments" subtitle="Track and manage fee collection" />
      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Collected" value={formatCurrency(collected)} change={10} icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Pending" value={formatCurrency(pending)} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" />
          <StatCard label="This Month" value={formatCurrency(thisMonth)} change={5} icon={TrendingUp} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        </div>

        <div className="filter-bar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search student..." />
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-36">
            <option value="">All Types</option>
            {FEE_TYPES.map(t => <option key={t}>{t}</option>)}
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-32">
            <option value="">All Status</option>
            <option>Paid</option><option>Pending</option>
          </Select>
          <Button onClick={() => setDialog({ open: true, data: { ...EMPTY } })} className="ml-auto"><Plus size={15} />Add Payment</Button>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState /> : (
            <table className="data-table w-full">
              <thead><tr><th>Student</th><th>Fee Type</th><th>Amount</th><th>Date</th><th>Mode</th><th>Receipt</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.id}>
                    <td className="font-medium text-slate-800">{f.student_name || '—'}</td>
                    <td><span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{f.fee_type}</span></td>
                    <td className="font-semibold">{formatCurrency(f.amount)}</td>
                    <td>{formatDate(f.payment_date)}</td>
                    <td>{f.payment_mode}</td>
                    <td className="font-mono text-xs">{f.receipt_no || '—'}</td>
                    <td><Badge status={f.status} /></td>
                    <td>
                      <div className="flex gap-1">
                        {f.status === 'Pending' && (
                          <Button variant="ghost" size="icon" onClick={() => markPaid(f.id)} className="text-emerald-600"><CheckCircle size={15} /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title="Record Fee Payment">
        {dialog.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Student" required>
                <Select value={dialog.data.student_id} onChange={e => selectStudent(e.target.value)} className="w-full">
                  <option value="">Select Student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </Select>
              </FormField>
              <FormField label="Academic Year"><Select value={dialog.data.academic_year} onChange={e => set('academic_year', e.target.value)} className="w-full"><option>2024-25</option><option>2025-26</option><option>2026-27</option></Select></FormField>
              <FormField label="Fee Type" required><Select value={dialog.data.fee_type} onChange={e => set('fee_type', e.target.value)} className="w-full">{FEE_TYPES.map(t => <option key={t}>{t}</option>)}</Select></FormField>
              <FormField label="Amount (₹)" required><Input type="number" value={dialog.data.amount} onChange={e => set('amount', e.target.value)} /></FormField>
              <FormField label="Payment Date"><Input type="date" value={dialog.data.payment_date || ''} onChange={e => set('payment_date', e.target.value)} /></FormField>
              <FormField label="Payment Mode"><Select value={dialog.data.payment_mode} onChange={e => set('payment_mode', e.target.value)} className="w-full">{PAY_MODES.map(m => <option key={m}>{m}</option>)}</Select></FormField>
              <FormField label="Receipt No"><Input value={dialog.data.receipt_no} onChange={e => set('receipt_no', e.target.value)} /></FormField>
              <FormField label="Status"><Select value={dialog.data.status} onChange={e => set('status', e.target.value)} className="w-full"><option>Pending</option><option>Paid</option></Select></FormField>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false, data: null })}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save Payment</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
