import { useState, useEffect } from 'react'
import { Search, Download } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { generateReceiptPDF } from '@/utils/pdfExport'

const FEE_FIELDS = [
  { key: 'old_fee', label: 'Old Fee' },
  { key: 'application_fee', label: 'Application Fee' },
  { key: 'admission_fee', label: 'Admission Fee' },
  { key: 'term_fee', label: 'Term Fee' },
  { key: 'transport_fee', label: 'Transport Fee' },
  { key: 'kit_fee', label: 'Kit Fee' },
  { key: 'textbook_fee', label: 'Textbook Fee' },
]

export default function StudentReceipt() {
  const [students, setStudents] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [fees, setFees] = useState(FEE_FIELDS.map(f => ({ ...f, totalFee: 0, amountPaid: 0, balance: 0 })))
  const [receiptNo, setReceiptNo] = useState('')
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [payMode, setPayMode] = useState('Cash')
  const [academicYear, setAcademicYear] = useState('2026-27')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    api.get('/students').then(d => setStudents(Array.isArray(d) ? d : d.data || [])).catch(() => {})
  }, [])

  const filtered = query.length > 1
    ? students.filter(s =>
        s.full_name?.toLowerCase().includes(query.toLowerCase()) ||
        s.admission_no?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  const selectStudent = async (s) => {
    setSelected(s)
    setQuery(s.full_name)
    setShowDropdown(false)
    try {
      const fp = await api.get('/fee-payments', { student_id: s.id, academic_year: academicYear })
      const feeList = Array.isArray(fp) ? fp : fp.data || []
      const TYPE_MAP = { Tuition: 'term_fee', Transport: 'transport_fee', Annual: 'admission_fee', Exam: 'application_fee', Other: 'old_fee' }
      const newFees = FEE_FIELDS.map(f => {
        const match = feeList.find(p => TYPE_MAP[p.fee_type] === f.key)
        return match
          ? { ...f, totalFee: match.amount, amountPaid: match.status === 'Paid' ? match.amount : 0, balance: match.status === 'Paid' ? 0 : match.amount }
          : { ...f, totalFee: 0, amountPaid: 0, balance: 0 }
      })
      setFees(newFees)
    } catch { setFees(FEE_FIELDS.map(f => ({ ...f, totalFee: 0, amountPaid: 0, balance: 0 }))) }
  }

  const updateFee = (i, field, value) => {
    setFees(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], [field]: parseFloat(value) || 0 }
      if (field === 'totalFee' || field === 'amountPaid') {
        updated[i].balance = updated[i].totalFee - updated[i].amountPaid
      }
      return updated
    })
  }

  const totals = fees.reduce((acc, f) => ({
    totalFee: acc.totalFee + f.totalFee,
    amountPaid: acc.amountPaid + f.amountPaid,
    balance: acc.balance + f.balance,
  }), { totalFee: 0, amountPaid: 0, balance: 0 })

  const handlePDF = async () => {
    if (!selected) { alert('Please select a student'); return }
    setGenerating(true)
    try {
      const receiptData = { receiptNo, receiptDate, academicYear, payMode, student: selected, fees, totals }
      await generateReceiptPDF(receiptData)
    } catch (e) { alert('PDF generation error: ' + e.message) } finally { setGenerating(false) }
  }

  return (
    <div>
      <TopBar title="Student Receipt" subtitle="Generate fee receipts" />
      <div className="page-content">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Student Search */}
          <div className="relative">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Search Student</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search by name or admission no..."
                className="pl-9 h-9 w-full rounded-md border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {showDropdown && filtered.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                {filtered.map(s => (
                  <button key={s.id} onClick={() => selectStudent(s)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <p className="text-sm font-medium text-slate-800">{s.full_name}</p>
                    <p className="text-xs text-slate-400">{s.admission_no} · Class {s.class}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Receipt No</label>
              <Input value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="RCP-001" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
              <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Academic Year</label>
              <Select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="w-full">
                <option>2024-25</option><option>2025-26</option><option>2026-27</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Payment Mode</label>
              <Select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full">
                <option>Cash</option><option>Online</option><option>Cheque</option>
              </Select>
            </div>
          </div>
        </div>

        {selected && (
          <Card>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{selected.full_name}</p>
                <p className="text-xs text-slate-500">{selected.admission_no} · Class {selected.class}{selected.section ? ` - ${selected.section}` : ''}</p>
              </div>
              <Button onClick={handlePDF} loading={generating}><Download size={15} />Export PDF</Button>
            </div>
            <CardContent className="p-0">
              <table className="data-table w-full">
                <thead>
                  <tr><th>Fee Type</th><th className="text-right">Total Fee (₹)</th><th className="text-right">Amount Paid (₹)</th><th className="text-right">Balance (₹)</th></tr>
                </thead>
                <tbody>
                  {fees.map((f, i) => (
                    <tr key={f.key}>
                      <td className="font-medium">{f.label}</td>
                      <td className="text-right">
                        <input type="number" value={f.totalFee} onChange={e => updateFee(i, 'totalFee', e.target.value)} className="w-28 text-right h-7 rounded border border-slate-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      </td>
                      <td className="text-right">
                        <input type="number" value={f.amountPaid} onChange={e => updateFee(i, 'amountPaid', e.target.value)} className="w-28 text-right h-7 rounded border border-slate-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      </td>
                      <td className={`text-right font-semibold ${f.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatCurrency(f.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totals.totalFee)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(totals.amountPaid)}</td>
                    <td className={`px-4 py-3 text-right ${totals.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(totals.balance)}</td>
                  </tr>
                </tfoot>
              </table>
              {totals.balance > 0 && (
                <div className="mx-5 my-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  ⚠️ Balance Due: <strong>{formatCurrency(totals.balance)}</strong>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
