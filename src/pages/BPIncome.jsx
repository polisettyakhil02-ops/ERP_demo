import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ChevronDown, ChevronUp, Printer, CheckCircle2, User } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/dialog'
import api from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import { generateReceiptPDF } from '@/utils/pdfExport'
import { CLASS_LIST } from '@/lib/constants'

const today = new Date().toISOString().split('T')[0]
const EXP_CATEGORIES = ['Salaries', 'Utilities', 'Maintenance', 'Supplies', 'Events', 'Misc']
const BANK_MODES = ['Cheque', 'Swipe machine', 'Paytm', 'GooglePay', 'PhonePay', 'OnlineTransfer', 'Others']
const AUTO_BANK = {
  'Swipe machine': { bankName: 'Online', bankBranch: 'Swipe Machine' },
  'Paytm': { bankName: 'Online', bankBranch: 'Paytm' },
  'GooglePay': { bankName: 'Online', bankBranch: 'GooglePay' },
  'PhonePay': { bankName: 'Online', bankBranch: 'PhonePay' },
}
const genReceiptNo = () => `MV${Date.now().toString().slice(-8)}`
const currentAcYear = () => {
  const y = new Date().getFullYear()
  return `${y}-${String(y + 1).slice(-2)}`
}

function buildFeeRows(report) {
  if (!report) return []
  const rows = []
  const termCommitted = report.net_term_fee ?? (report.gross_term_fee - report.term_concession)
  const termPending = report.balance_term_fee ?? (termCommitted - report.paid_term_fee)
  rows.push({
    id: 'school_fee', label: 'School Fee',
    actualFee: report.gross_term_fee || 0,
    concession: report.term_concession || 0,
    committedFee: termCommitted || 0,
    feePaid: report.paid_term_fee || 0,
    feePending: termPending || 0,
    amount: '', checked: false,
  })
  if ((report.adm_gross_fee || 0) > 0) {
    const admCommitted = report.net_adm_fee ?? (report.adm_gross_fee - report.adm_concession)
    const admPending = report.balance_adm_fee ?? (admCommitted - report.paid_adm_fee)
    rows.push({
      id: 'admission_fee', label: 'Admission Fee',
      actualFee: report.adm_gross_fee || 0,
      concession: report.adm_concession || 0,
      committedFee: admCommitted || 0,
      feePaid: report.paid_adm_fee || 0,
      feePending: admPending || 0,
      amount: '', checked: false,
    })
  }
  if ((report.old_fee || 0) > 0) {
    rows.push({
      id: 'previous_due', label: 'Previous Due',
      actualFee: report.old_fee || 0,
      concession: 0, committedFee: report.old_fee || 0,
      feePaid: 0, feePending: report.old_fee || 0,
      amount: '', checked: false,
    })
  }
  return rows
}

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3 bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition-colors"
      >
        <span className="flex items-center gap-2">💬 {title}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="bg-white">{children}</div>}
    </div>
  )
}

function PaymentModeFields({ isBank, bankMode, setBankMode, chequeNo, setChequeNo, chequeDate, setChequeDate, bankName, setBankName, bankBranch, setBankBranch, transactionNo, setTransactionNo, transactionDate, setTransactionDate }) {
  const isAuto = !!AUTO_BANK[bankMode]
  const autoBn = AUTO_BANK[bankMode]?.bankName || ''
  const autoBb = AUTO_BANK[bankMode]?.bankBranch || ''

  if (!isBank) return null

  return (
    <div className="mt-3 space-y-3">
      {/* Bank mode radio */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {BANK_MODES.map(m => (
          <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input
              type="radio" name="bankMode" value={m}
              checked={bankMode === m}
              onChange={() => {
                setBankMode(m)
                if (AUTO_BANK[m]) { setBankName(AUTO_BANK[m].bankName); setBankBranch(AUTO_BANK[m].bankBranch) }
                else { setBankName(''); setBankBranch('') }
              }}
              className="accent-purple-700"
            />
            <span className={bankMode === m ? 'text-purple-700 font-medium' : 'text-slate-600'}>{m}</span>
          </label>
        ))}
      </div>

      {/* Cheque fields */}
      {bankMode === 'Cheque' && (
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cheque Number">
            <Input value={chequeNo} onChange={e => setChequeNo(e.target.value)} placeholder="Enter cheque number" />
          </FormField>
          <FormField label="Cheque Date">
            <Input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} />
          </FormField>
          <FormField label="Bank Name">
            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" />
          </FormField>
          <FormField label="Branch Name">
            <Input value={bankBranch} onChange={e => setBankBranch(e.target.value)} placeholder="Branch name" />
          </FormField>
        </div>
      )}

      {/* Online / UPI / others */}
      {bankMode !== 'Cheque' && (
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Transaction No">
            <Input value={transactionNo} onChange={e => setTransactionNo(e.target.value)} placeholder="Transaction / UTR number" />
          </FormField>
          <FormField label="Transaction Date">
            <Input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
          </FormField>
          <FormField label="Bank Name">
            <Input value={isAuto ? autoBn : bankName} onChange={e => setBankName(e.target.value)} readOnly={isAuto} className={isAuto ? 'bg-slate-50 text-slate-500' : ''} />
          </FormField>
          <FormField label="Branch Name">
            <Input value={isAuto ? autoBb : bankBranch} onChange={e => setBankBranch(e.target.value)} readOnly={isAuto} className={isAuto ? 'bg-slate-50 text-slate-500' : ''} />
          </FormField>
        </div>
      )}
    </div>
  )
}

function ExpenditurePanel() {
  const [form, setForm] = useState({ category: 'Salaries', description: '', amount: '', date: today, paid_to: '', approved_by: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.amount || !form.date) return alert('Amount and Date are required')
    setSaving(true)
    try {
      await api.post('/expenditure', { ...form, amount: parseFloat(form.amount) })
      setSuccess(true)
      setForm({ category: 'Salaries', description: '', amount: '', date: today, paid_to: '', approved_by: '' })
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl">
      {success && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> Expenditure recorded successfully.
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Add Expenditure</h3>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Category" required>
          <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {EXP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label="Amount (₹)" required>
          <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
        </FormField>
        <FormField label="Date" required>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </FormField>
        <FormField label="Paid To">
          <Input value={form.paid_to} onChange={e => set('paid_to', e.target.value)} placeholder="Payee name" />
        </FormField>
        <FormField label="Approved By">
          <Input value={form.approved_by} onChange={e => set('approved_by', e.target.value)} />
        </FormField>
      </div>
      <FormField label="Description">
        <textarea value={form.description} onChange={e => set('description', e.target.value)} className="w-full h-20 mt-1 rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </FormField>
      <div className="flex justify-end mt-4">
        <Button onClick={handleSave} loading={saving}>Save Expenditure</Button>
      </div>
    </div>
  )
}

export default function BPIncome() {
  const [feeType, setFeeType] = useState('Income')

  // Student lookup
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [classStudents, setClassStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  // Fee data
  const [feeReport, setFeeReport] = useState(null)
  const [feePayments, setFeePayments] = useState([])
  const [feeRows, setFeeRows] = useState([])

  // Payment form
  const [academicYear, setAcademicYear] = useState(currentAcYear())
  const [payAmount, setPayAmount] = useState('')
  const [voucherType, setVoucherType] = useState('MvNo')
  const [voucherNo, setVoucherNo] = useState('')
  const [mvDate, setMvDate] = useState(today)
  const [isBank, setIsBank] = useState(false)
  const [bankMode, setBankMode] = useState('Cheque')
  const [chequeNo, setChequeNo] = useState('')
  const [chequeDate, setChequeDate] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankBranch, setBankBranch] = useState('')
  const [transactionNo, setTransactionNo] = useState('')
  const [transactionDate, setTransactionDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [lastInserted, setLastInserted] = useState(null)
  const [insertError, setInsertError] = useState('')

  // Dismiss suggestions on outside click
  useEffect(() => {
    const fn = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // Debounced student name search
  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setShowSuggestions(true)
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get('/students', { search: val, limit: 10 })
        setSuggestions(Array.isArray(data) ? data : data.data || [])
      } catch { setSuggestions([]) }
    }, 300)
  }

  // Class change → load students for roll-no dropdown
  const handleClassChange = useCallback(async (cls) => {
    setSelectedClass(cls)
    setSelectedSection('')
    setClassStudents([])
    setSelectedStudent(null)
    setFeeReport(null)
    setFeePayments([])
    setFeeRows([])
    if (!cls) return
    try {
      const data = await api.get('/students', { class: cls, status: 'Active', limit: 200 })
      setClassStudents(Array.isArray(data) ? data : data.data || [])
    } catch { setClassStudents([]) }
  }, [])

  const filteredClassStudents = selectedSection
    ? classStudents.filter(s => s.section === selectedSection)
    : classStudents

  const sections = [...new Set(classStudents.map(s => s.section).filter(Boolean))].sort()

  const loadStudentData = useCallback(async (student) => {
    setSelectedStudent(student)
    setShowSuggestions(false)
    setSearchQuery(student.full_name)
    setSelectedClass(student.class || '')
    setSelectedSection(student.section || '')
    setPayAmount('')
    setLastInserted(null)
    setInsertError('')

    try {
      const [reports, payments] = await Promise.all([
        api.get('/student-fee-report', { student_id: student.id }),
        api.get('/fee-payments', { student_id: student.id }),
      ])
      const report = Array.isArray(reports) ? reports[0] : null
      const payments_ = Array.isArray(payments) ? payments : []
      setFeeReport(report || null)
      setFeePayments(payments_)
      setFeeRows(buildFeeRows(report))
    } catch { setFeeReport(null); setFeePayments([]) }
  }, [])

  const refreshPayments = async () => {
    if (!selectedStudent) return
    const payments = await api.get('/fee-payments', { student_id: selectedStudent.id }).catch(() => [])
    setFeePayments(Array.isArray(payments) ? payments : [])
  }

  // Toggle fee row checkbox
  const toggleRow = (id) => {
    setFeeRows(rows => rows.map(r => r.id === id
      ? { ...r, checked: !r.checked, amount: !r.checked ? String(r.feePending) : '' }
      : r
    ))
  }
  const setRowAmount = (id, val) => setFeeRows(rows => rows.map(r => r.id === id ? { ...r, amount: val } : r))

  // Auto-sum checked rows into payAmount
  useEffect(() => {
    const total = feeRows.filter(r => r.checked).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    if (total > 0) setPayAmount(String(total))
  }, [feeRows])

  const handleInsert = async () => {
    if (!selectedStudent) return setInsertError('Please select a student first.')
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) return setInsertError('Enter a valid amount.')
    setInsertError('')
    setSaving(true)

    const paymentMode = isBank ? bankMode : 'Cash'
    const receiptNo = voucherNo || genReceiptNo()
    const checkedRows = feeRows.filter(r => r.checked)
    const feeTypesLabel = checkedRows.length > 0 ? checkedRows.map(r => r.label).join(', ') : 'School Fee'

    const payload = {
      student_id: selectedStudent.id,
      student_name: selectedStudent.full_name,
      academic_year: academicYear,
      fee_type: feeTypesLabel,
      amount,
      status: 'Paid',
      payment_date: mvDate,
      payment_mode: paymentMode,
      receipt_no: receiptNo,
      voucher_type: voucherType,
      ...(isBank && bankMode === 'Cheque' && {
        transaction_no: chequeNo,
        cheque_date: chequeDate || undefined,
        bank_name: bankName,
        bank_branch: bankBranch,
      }),
      ...(isBank && bankMode !== 'Cheque' && {
        transaction_no: transactionNo,
        bank_name: AUTO_BANK[bankMode]?.bankName || bankName,
        bank_branch: AUTO_BANK[bankMode]?.bankBranch || bankBranch,
      }),
    }

    try {
      const created = await api.post('/fee-payments', payload)
      setLastInserted({ ...created, receipt_no: receiptNo, fee_type: feeTypesLabel })
      setVoucherNo('')
      setPayAmount('')
      setFeeRows(rows => rows.map(r => ({ ...r, checked: false, amount: '' })))
      await refreshPayments()
    } catch (e) { setInsertError(e.message) } finally { setSaving(false) }
  }

  const handlePrintReceipt = async () => {
    if (!selectedStudent || !lastInserted) return
    const checkedRows = feeRows.length > 0 ? feeRows : []
    const fees = [{ key: 'fee', label: lastInserted.fee_type, totalFee: lastInserted.amount, amountPaid: lastInserted.amount, balance: 0 }]
    const totals = { totalFee: lastInserted.amount, amountPaid: lastInserted.amount, balance: 0 }
    await generateReceiptPDF({
      student: selectedStudent,
      fees,
      totals,
      receiptNo: lastInserted.receipt_no,
      receiptDate: mvDate,
      academicYear,
      payMode: isBank ? bankMode : 'Cash',
    })
  }

  const paidVouchers = feePayments.filter(p => p.status === 'Paid')
  const cancelledVouchers = feePayments.filter(p => p.status === 'Cancelled')
  const paidTotal = paidVouchers.reduce((s, p) => s + (p.amount || 0), 0)

  const feeDetails = feeReport ? {
    actualFee: feeReport.gross_term_fee || 0,
    feePaid: feeReport.paid_term_fee || 0,
    concession: feeReport.term_concession || 0,
    sclFeeConcession: feeReport.adm_concession || 0,
    tFeePending: feeReport.balance_term_fee ?? ((feeReport.gross_term_fee - feeReport.term_concession) - feeReport.paid_term_fee),
    previousDue: feeReport.old_fee || 0,
  } : null

  const handleCancelVoucher = async (id) => {
    if (!confirm('Cancel this voucher?')) return
    try { await api.put(`/fee-payments/${id}`, { status: 'Cancelled' }); await refreshPayments() } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <TopBar title="Income" subtitle="Fee collection and payment recording" />
      <div className="page-content">

        {/* Fee Type selector */}
        <div className="mb-5 flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-600">Fee Type:</label>
          <div className="flex gap-2">
            {['Income', 'Expenditure'].map(t => (
              <button
                key={t}
                onClick={() => setFeeType(t)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  feeType === t
                    ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {feeType === 'Expenditure' ? (
          <ExpenditurePanel />
        ) : (
          <div className="flex gap-5">
            {/* Left column — main content */}
            <div className="flex-1 min-w-0">

              {/* Student Lookup */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Student Selection</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Class */}
                  <FormField label="Class Name">
                    <select
                      value={selectedClass}
                      onChange={e => handleClassChange(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">— Select Class —</option>
                      {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FormField>

                  {/* Section */}
                  <FormField label="Section Name">
                    <select
                      value={selectedSection}
                      onChange={e => setSelectedSection(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={!selectedClass}
                    >
                      <option value="">— All Sections —</option>
                      {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>

                  {/* Name search */}
                  <div className="relative col-span-2" ref={searchRef}>
                    <FormField label="Search Student Name">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={searchQuery}
                          onChange={e => handleSearchChange(e.target.value)}
                          onFocus={() => { if (suggestions.length) setShowSuggestions(true) }}
                          placeholder="Type student name to search..."
                          className="w-full h-9 pl-9 pr-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </FormField>
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                        {suggestions.map(s => (
                          <button
                            key={s.id}
                            onClick={() => loadStudentData(s)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 transition-colors flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-800">{s.full_name}</span>
                            <span className="text-xs text-slate-400">{s.class}{s.section ? ` - ${s.section}` : ''} • {s.admission_no}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Roll No & Name */}
                  <div className="col-span-2">
                    <FormField label="Roll No & Name">
                      <select
                        value={selectedStudent?.id || ''}
                        onChange={e => {
                          const s = filteredClassStudents.find(st => st.id === e.target.value)
                          if (s) loadStudentData(s)
                        }}
                        className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={!selectedClass}
                      >
                        <option value="">— Select Student —</option>
                        {filteredClassStudents.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.roll_no ? `${s.roll_no} - ` : ''}{s.full_name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                </div>
              </div>

              {/* Fee Particulars */}
              {selectedStudent && (
                <CollapsibleSection title="Fee Particulars">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="w-8 px-3 py-3"></th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fee Type</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actual Fee</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Concession</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Committed Fee</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Fee Paid</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Fee Pending</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase pr-4">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeRows.length === 0 ? (
                          <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">No fee structure found for this student. Please add a fee report first.</td></tr>
                        ) : feeRows.map(row => (
                          <tr key={row.id} className={`border-b border-slate-50 ${row.checked ? 'bg-purple-50' : ''}`}>
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={row.checked}
                                onChange={() => toggleRow(row.id)}
                                className="accent-purple-700 w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{row.actualFee.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{row.concession.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{row.committedFee.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-medium">{row.feePaid.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right text-red-600 font-medium">{row.feePending.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 pr-4">
                              <input
                                type="number"
                                value={row.amount}
                                onChange={e => setRowAmount(row.id, e.target.value)}
                                className="w-28 h-8 rounded border border-purple-200 px-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-400"
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}

              {/* Payment Form */}
              {selectedStudent && (
                <CollapsibleSection title="Payment Details">
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-4 items-end">
                      {/* Amount */}
                      <FormField label="Amount (₹)">
                        <input
                          type="number"
                          value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                          placeholder="0"
                          className="w-full h-9 rounded-md border border-purple-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </FormField>

                      {/* Voucher type + number */}
                      <FormField label="Voucher No">
                        <div className="flex gap-2 items-center">
                          <div className="flex gap-3">
                            {['MvNo', 'CvNo'].map(vt => (
                              <label key={vt} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input type="radio" name="voucherType" value={vt} checked={voucherType === vt} onChange={() => setVoucherType(vt)} className="accent-purple-700" />
                                <span className={voucherType === vt ? 'text-purple-700 font-medium' : 'text-slate-600'}>{vt}</span>
                              </label>
                            ))}
                          </div>
                          <input
                            value={voucherNo}
                            onChange={e => setVoucherNo(e.target.value)}
                            placeholder="Auto-generated"
                            className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                      </FormField>

                      {/* MV Date */}
                      <FormField label="MV Date">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={mvDate}
                            onChange={e => setMvDate(e.target.value)}
                            className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                      </FormField>
                    </div>

                    {/* Academic Year */}
                    <FormField label="Academic Year">
                      <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="w-40 h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                        {['2024-25', '2025-26', '2026-27', '2027-28'].map(y => <option key={y}>{y}</option>)}
                      </select>
                    </FormField>

                    {/* Bank checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer w-fit">
                      <input type="checkbox" checked={isBank} onChange={e => setIsBank(e.target.checked)} className="accent-purple-700 w-4 h-4" />
                      <span className="text-sm font-medium text-slate-700">Bank / Online Payment</span>
                    </label>

                    <PaymentModeFields
                      isBank={isBank} bankMode={bankMode} setBankMode={setBankMode}
                      chequeNo={chequeNo} setChequeNo={setChequeNo}
                      chequeDate={chequeDate} setChequeDate={setChequeDate}
                      bankName={bankName} setBankName={setBankName}
                      bankBranch={bankBranch} setBankBranch={setBankBranch}
                      transactionNo={transactionNo} setTransactionNo={setTransactionNo}
                      transactionDate={transactionDate} setTransactionDate={setTransactionDate}
                    />

                    {insertError && <p className="text-sm text-red-500">{insertError}</p>}

                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        onClick={handleInsert}
                        loading={saving}
                        className="bg-green-600 hover:bg-green-700 text-white px-8"
                      >
                        ⊕ Insert
                      </Button>
                      {lastInserted && (
                        <Button variant="outline" onClick={handlePrintReceipt} className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50">
                          <Printer size={15} /> Print Receipt
                        </Button>
                      )}
                      {lastInserted && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                          <CheckCircle2 size={15} /> Payment recorded — Receipt {lastInserted.receipt_no}
                        </span>
                      )}
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {/* Paid Vouchers */}
              {selectedStudent && (
                <CollapsibleSection title="Paid Vouchers">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['T_Date', 'Student Name', 'From', 'Head Type', 'Receipt No', 'Amount'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paidVouchers.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-5 text-center text-sm text-slate-400">No paid vouchers yet.</td></tr>
                        ) : paidVouchers.map(p => (
                          <tr key={p.id} className="border-b border-slate-50">
                            <td className="px-4 py-3">{formatDate(p.payment_date)}</td>
                            <td className="px-4 py-3 font-medium">{p.student_name}</td>
                            <td className="px-4 py-3 text-slate-500">{p.payment_mode}</td>
                            <td className="px-4 py-3">{p.fee_type}</td>
                            <td className="px-4 py-3 text-xs font-mono">{p.receipt_no || '—'}</td>
                            <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                          </tr>
                        ))}
                        {paidVouchers.length > 0 && (
                          <tr className="bg-slate-50 font-bold">
                            <td colSpan={5} className="px-4 py-3 text-right text-sm text-slate-600">Total</td>
                            <td className="px-4 py-3 text-green-700">{formatCurrency(paidTotal)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}

              {/* Cancel Vouchers */}
              {selectedStudent && cancelledVouchers.length >= 0 && (
                <CollapsibleSection title="Cancel Vouchers" defaultOpen={false}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['T_Date', 'Student Name', 'From', 'Head Type', 'Receipt No', 'Amount', 'Action'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cancelledVouchers.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-5 text-center text-sm text-slate-400">No cancelled vouchers.</td></tr>
                        ) : cancelledVouchers.map(p => (
                          <tr key={p.id} className="border-b border-slate-50">
                            <td className="px-4 py-3">{formatDate(p.payment_date)}</td>
                            <td className="px-4 py-3">{p.student_name}</td>
                            <td className="px-4 py-3 text-slate-500">{p.payment_mode}</td>
                            <td className="px-4 py-3">{p.fee_type}</td>
                            <td className="px-4 py-3 text-xs font-mono">{p.receipt_no || '—'}</td>
                            <td className="px-4 py-3 line-through text-slate-400">{formatCurrency(p.amount)}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Cancelled</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Paid vouchers: each row has cancel button */}
                  {paidVouchers.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                      To cancel a paid voucher, click the ✕ in the Paid Vouchers table row — feature coming in next update.
                    </div>
                  )}
                </CollapsibleSection>
              )}
            </div>

            {/* Right column — Fee Details panel */}
            {selectedStudent && (
              <div className="w-64 shrink-0">
                <div className="sticky top-4 rounded-xl overflow-hidden shadow-lg border border-slate-200">
                  {/* Header */}
                  <div className="bg-slate-700 text-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Fee Details Of</p>
                    <p className="text-sm font-bold mt-0.5 leading-tight">{selectedStudent.full_name}</p>
                  </div>

                  {/* Student photo placeholder */}
                  <div className="bg-blue-600 px-4 py-4 flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      {feeDetails ? (
                        <>
                          {[
                            ['Actual Fee', feeDetails.actualFee],
                            ['Fee Paid', feeDetails.feePaid],
                            ['Concession', feeDetails.concession],
                            ['SclFee Concession', feeDetails.sclFeeConcession],
                            ['T.Fee Pending', feeDetails.tFeePending],
                            ['Previous Due', feeDetails.previousDue],
                            ['F.Pend Till Date', feeDetails.tFeePending + feeDetails.previousDue],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between">
                              <span className="text-xs text-blue-100">{label}</span>
                              <span className="text-xs font-bold text-white">{(value || 0).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p className="text-xs text-blue-200">No fee structure on record.</p>
                      )}
                    </div>
                    <div className="w-12 h-14 rounded bg-blue-400 flex items-center justify-center shrink-0">
                      {selectedStudent.photo_url
                        ? <img src={selectedStudent.photo_url} alt="" className="w-full h-full object-cover rounded" />
                        : <User size={20} className="text-blue-100" />
                      }
                    </div>
                  </div>

                  {/* Quick info */}
                  <div className="bg-white px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Admission No</span>
                      <span className="font-mono font-medium text-slate-700">{selectedStudent.admission_no}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Class</span>
                      <span className="font-medium text-slate-700">{selectedStudent.class}{selectedStudent.section ? ` - ${selectedStudent.section}` : ''}</span>
                    </div>
                    {selectedStudent.parent_name && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Parent</span>
                        <span className="font-medium text-slate-700 truncate max-w-[120px]">{selectedStudent.parent_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
