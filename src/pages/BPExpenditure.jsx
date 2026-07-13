import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, FormField } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import SearchInput from '@/components/common/SearchInput'
import EmptyState from '@/components/common/EmptyState'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import api from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'

const CATEGORIES = ['Salaries','Utilities','Maintenance','Supplies','Events','Misc']
const EMPTY = { category:'Salaries', description:'', amount:'', date:'', paid_to:'', approved_by:'' }

export default function BPExpenditure() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [dialog, setDialog] = useState({ open: false, data: null })
  const [saving, setSaving] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.get('/expenditure').then(d => setItems(Array.isArray(d) ? d : d.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const filtered = items.filter(i => (!search || i.description?.toLowerCase().includes(search.toLowerCase())) && (!filterCat || i.category === filterCat))
  const total = filtered.reduce((s, i) => s + (i.amount || 0), 0)
  const set = (k, v) => setDialog(p => ({ ...p, data: { ...p.data, [k]: v } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...dialog.data, amount: parseFloat(dialog.data.amount) }
      if (dialog.data.id) await api.put(`/expenditure/${dialog.data.id}`, payload)
      else await api.post('/expenditure', payload)
      fetch(); setDialog({ open: false, data: null })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div>
      <TopBar title="Expenditure" subtitle="Track all school expenses" />
      <div className="page-content">
        <div className="filter-bar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search description..." />
          <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="w-36">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </Select>
          <div className="ml-auto flex items-center gap-3">
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold">Total: {formatCurrency(total)}</div>
            <Button onClick={() => setDialog({ open: true, data: { ...EMPTY } })}><Plus size={15} />Add Expense</Button>
          </div>
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState /> : (
            <table className="data-table w-full">
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Paid To</th><th>Approved By</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id}>
                    <td>{formatDate(i.date)}</td>
                    <td><span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{i.category}</span></td>
                    <td>{i.description || '—'}</td>
                    <td className="font-semibold text-red-600">{formatCurrency(i.amount)}</td>
                    <td>{i.paid_to || '—'}</td>
                    <td>{i.approved_by || '—'}</td>
                    <td>
                      <Button variant="ghost" size="icon" onClick={async () => { if (!confirm('Delete?')) return; await api.delete(`/expenditure/${i.id}`).catch(() => {}); fetch() }} className="text-red-500"><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, data: null })} title="Add Expenditure">
        {dialog.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Category" required><Select value={dialog.data.category} onChange={e => set('category', e.target.value)} className="w-full">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></FormField>
              <FormField label="Amount (₹)" required><Input type="number" value={dialog.data.amount} onChange={e => set('amount', e.target.value)} /></FormField>
              <FormField label="Date" required><Input type="date" value={dialog.data.date || ''} onChange={e => set('date', e.target.value)} /></FormField>
              <FormField label="Paid To"><Input value={dialog.data.paid_to} onChange={e => set('paid_to', e.target.value)} /></FormField>
              <FormField label="Approved By"><Input value={dialog.data.approved_by} onChange={e => set('approved_by', e.target.value)} /></FormField>
            </div>
            <FormField label="Description"><textarea value={dialog.data.description} onChange={e => set('description', e.target.value)} className="w-full h-20 rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" /></FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false, data: null })}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
