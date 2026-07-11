import { useState, useCallback, useRef, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Download, Upload, ChevronDown, ChevronUp,
  RefreshCw, AlertCircle, CheckCircle2, X, Users,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Legend, Tooltip as RechartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BRANCHES, INCOME_HEADS, EXPENDITURE_HEADS } from '@/lib/constants'

const todayStr = () => new Date().toISOString().split('T')[0]
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

// ── CSV helpers ────────────────────────────────────────────────────────────────
function csvEscape(v) {
  const s = String(v ?? '')
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s
}

function makeCSV(headers, rows) {
  const BOM = '﻿'
  return BOM + [headers.join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n')
}

function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function parseCSVLine(line) {
  const result = []; let inQuotes = false; let current = ''
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else current += line[i]
  }
  result.push(current.trim())
  return result
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseCSVLine(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  }).filter(r => Object.values(r).some(v => v.trim()))
  return { headers, rows }
}

// ── Collapsible wrapper ────────────────────────────────────────────────────────
function Section({ title, badge, color = 'bg-indigo-700', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center justify-between px-5 py-3 ${color} text-white text-sm font-semibold hover:opacity-90 transition-opacity`}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge != null && (
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="bg-white">{children}</div>}
    </div>
  )
}

// ── Analytics panel ────────────────────────────────────────────────────────────
function AnalyticsPanel({ feePayments, incomeEntries, expenditureEntries, onClose }) {
  const modeMap = {}
  feePayments.forEach(p => {
    const m = p.payment_mode || 'Cash'
    modeMap[m] = (modeMap[m] || 0) + (p.amount || 0)
  })
  const modePie = Object.entries(modeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const incomeByHead = {}
  incomeEntries.forEach(i => { const k = i.category || i.title || 'Other'; incomeByHead[k] = (incomeByHead[k] || 0) + (i.amount || 0) })
  feePayments.forEach(p => { const k = p.fee_type || 'Fee'; incomeByHead[k] = (incomeByHead[k] || 0) + (p.amount || 0) })
  const incomeBar = Object.entries(incomeByHead).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))

  const expByHead = {}
  expenditureEntries.forEach(e => { const k = e.category || 'Other'; expByHead[k] = (expByHead[k] || 0) + (e.amount || 0) })
  const expBar = Object.entries(expByHead).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-700">Financial Analytics</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
          <X size={16} className="text-slate-500" />
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Payment mode pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Payment Mode Distribution</p>
          {modePie.length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-8">No fee payments in range</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={modePie} cx="50%" cy="50%" outerRadius={65} dataKey="value"
                  label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                  {modePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <RechartTooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Income by head */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Income by Head (Top 10)</p>
          {incomeBar.length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-8">No income data in range</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={incomeBar} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <RechartTooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expenditure by head */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Expenditure by Head (Top 10)</p>
          {expBar.length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-8">No expenditure data in range</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={expBar} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <RechartTooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" fill="#f87171" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Bulk upload section ────────────────────────────────────────────────────────
function BulkUpload({ onSuccess }) {
  const [bulkType, setBulkType] = useState('Income')
  const [preview, setPreview] = useState([])
  const [headers, setHeaders] = useState([])
  const [saving, setBulkSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const INCOME_TEMPLATE_HEADERS = ['title', 'amount', 'date', 'category', 'received_from', 'payment_method', 'branch', 'notes']
  const EXP_TEMPLATE_HEADERS = ['category', 'amount', 'date', 'description', 'paid_to', 'approved_by', 'branch']

  const downloadTemplate = () => {
    const tHeaders = bulkType === 'Income' ? INCOME_TEMPLATE_HEADERS : EXP_TEMPLATE_HEADERS
    const sampleRow = bulkType === 'Income'
      ? ['Term Fee Collection', '5000', '2025-07-01', 'Term Fee', 'Student Name', 'Cash', 'Hyderabad - KPHB', 'Notes here']
      : ['Salaries and Wages', '150000', '2025-07-01', 'Monthly salary', 'Staff Name', 'Principal Name', 'Hyderabad - KPHB']
    const headDropdown = bulkType === 'Income'
      ? `# Valid categories: ${INCOME_HEADS.join(' | ')}`
      : `# Valid categories: ${EXPENDITURE_HEADS.join(' | ')}`
    const csv = makeCSV(tHeaders, [sampleRow, [headDropdown]])
    downloadCSV(`${bulkType}_Template.csv`, csv)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError(''); setResult(null); setPreview([])
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { headers: h, rows } = parseCSV(ev.target.result)
      setHeaders(h)
      setPreview(rows.slice(0, 5))
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleSubmit = async () => {
    const { rows } = parseCSV(fileRef.current?.files[0] ? '' : '')
    // Re-parse from file
    const file = fileRef.current?.files[0]
    if (!file) { setError('Please select a file first.'); return }
    setBulkSaving(true); setError(''); setResult(null)
    const text = await file.text()
    const { rows: allRows } = parseCSV(text)
    if (allRows.length === 0) { setError('No data rows found in file.'); setBulkSaving(false); return }

    try {
      const endpoint = bulkType === 'Income' ? '/income/bulk' : '/expenditure/bulk'
      const res = await api.post(endpoint, { records: allRows })
      setResult(`Successfully imported ${res.inserted} records.`)
      setPreview([]); if (fileRef.current) fileRef.current.value = ''
      onSuccess()
    } catch (e) { setError(e.message) } finally { setBulkSaving(false) }
  }

  return (
    <div className="p-5">
      {/* Type selector */}
      <div className="flex gap-2 mb-4">
        {['Income', 'Expenditure'].map(t => (
          <button
            key={t}
            onClick={() => { setBulkType(t); setPreview([]); setError(''); setResult(null) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${bulkType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}
          >{t}</button>
        ))}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" onClick={downloadTemplate} className="gap-2 text-sm">
          <Download size={14} /> Download {bulkType} Template
        </Button>
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
          <Upload size={14} />
          Select CSV File
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {/* Validation info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700 mb-4">
        <strong>Required fields: </strong>
        {bulkType === 'Income' ? 'title, amount, date (YYYY-MM-DD)' : 'category, amount, date (YYYY-MM-DD)'}
        &nbsp;— Max 500 rows per upload. Download the template to see all valid category/head values.
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <p className="text-xs text-slate-500 mb-1">Preview (first 5 rows):</p>
          <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                {headers.filter(h => !h.startsWith('#')).map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.filter(r => !Object.values(r)[0]?.startsWith('#')).map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {headers.filter(h => !h.startsWith('#')).map(h => (
                    <td key={h} className="px-3 py-2 text-slate-600 max-w-[120px] truncate">{row[h]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 mb-3">
          <CheckCircle2 size={15} /> {result}
        </div>
      )}

      {preview.length > 0 && (
        <Button onClick={handleSubmit} loading={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          Import {bulkType} Records
        </Button>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function BPTrackingExpenses() {
  const [fromDate, setFromDate] = useState(firstOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [branchFilter, setBranchFilter] = useState('')
  const [sourceType, setSourceType] = useState('All')
  const [incomeHead, setIncomeHead] = useState('')
  const [expHead, setExpHead] = useState('')

  const [feePayments, setFeePayments] = useState([])
  const [incomeEntries, setIncomeEntries] = useState([])
  const [expenditureEntries, setExpenditureEntries] = useState([])
  const [activityData, setActivityData] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState(null)

  const applyFilters = useCallback(async () => {
    setLoading(true)
    setAppliedFilters({ fromDate, toDate, branchFilter, sourceType })
    try {
      const baseParams = {
        from_date: fromDate,
        to_date: toDate,
        ...(branchFilter && { branch: branchFilter }),
        limit: 500,
      }

      const [fees, inc, exp, activity] = await Promise.all([
        sourceType !== 'Expenditure'
          ? api.get('/fee-payments', { ...baseParams, status: 'Paid', ...(incomeHead && { fee_type: incomeHead }) })
              .catch(() => [])
          : [],
        sourceType !== 'Expenditure'
          ? api.get('/income', { ...baseParams, ...(incomeHead && { type: incomeHead }) }).catch(() => [])
          : [],
        sourceType !== 'Income'
          ? api.get('/expenditure', { ...baseParams, ...(expHead && { category: expHead }) }).catch(() => [])
          : [],
        api.get('/admin/activity', { from_date: fromDate, to_date: toDate }).catch(() => []),
      ])

      setFeePayments(Array.isArray(fees) ? fees : [])
      setIncomeEntries(Array.isArray(inc) ? inc : [])
      setExpenditureEntries(Array.isArray(exp) ? exp : [])
      setActivityData(Array.isArray(activity) ? activity : [])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, branchFilter, sourceType, incomeHead, expHead])

  // auto-load on mount
  useEffect(() => { applyFilters() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalFeeIncome = feePayments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalOtherIncome = incomeEntries.reduce((s, i) => s + (i.amount || 0), 0)
  const totalIncome = totalFeeIncome + totalOtherIncome
  const totalExpenditure = expenditureEntries.reduce((s, e) => s + (e.amount || 0), 0)
  const netBalance = totalIncome - totalExpenditure

  const exportLedger = () => {
    const dateLabel = `${fromDate}_to_${toDate}`

    // Income sheet
    const incomeRows = [
      ...feePayments.map(p => [
        formatDate(p.payment_date), p.fee_type, `₹${p.amount}`, p.student_name || '',
        p.payment_mode || 'Cash', p.receipt_no || '', 'Fee Payment',
      ]),
      ...incomeEntries.map(i => [
        formatDate(i.date), i.category || i.title, `₹${i.amount}`, i.received_from || '',
        i.payment_method || '', '', 'Income Entry',
      ]),
    ]
    const expRows = expenditureEntries.map(e => [
      formatDate(e.date), e.category, `₹${e.amount}`, e.description || '',
      e.paid_to || '', e.approved_by || '', e.branch || '',
    ])

    downloadCSV(
      `Income_Ledger_${dateLabel}.csv`,
      makeCSV(['Date', 'Head', 'Amount', 'From/Student', 'Payment Mode', 'Receipt No', 'Type'], incomeRows),
    )
    setTimeout(() => {
      downloadCSV(
        `Expenditure_Ledger_${dateLabel}.csv`,
        makeCSV(['Date', 'Head', 'Amount', 'Description', 'Paid To', 'Approved By', 'Branch'], expRows),
      )
    }, 500)
  }

  const sSelect = 'w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div>
      <TopBar title="Track Expenses" subtitle="Full financial ledger with analytics and bulk tools">
        <Button variant="outline" onClick={exportLedger} className="gap-2 text-sm">
          <Download size={14} /> Export Ledger
        </Button>
      </TopBar>

      <div className="page-content">
        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">FROM</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">TO</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Branch</label>
              <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className={sSelect}>
                <option value="">All Branches</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Source</label>
              <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={sSelect}>
                {['All', 'Income', 'Expenditure'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Income Head</label>
              <select value={incomeHead} onChange={e => setIncomeHead(e.target.value)} className={sSelect}
                disabled={sourceType === 'Expenditure'}>
                <option value="">All Heads</option>
                {INCOME_HEADS.map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Expense Head</label>
              <select value={expHead} onChange={e => setExpHead(e.target.value)} className={sSelect}
                disabled={sourceType === 'Income'}>
                <option value="">All Heads</option>
                {EXPENDITURE_HEADS.map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={applyFilters} loading={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <RefreshCw size={14} /> Apply Filters
            </Button>
          </div>
        </div>

        {/* Summary stats — clickable to open analytics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Total Income', value: totalIncome, icon: TrendingUp, color: 'bg-emerald-500', sub: `${feePayments.length} fee + ${incomeEntries.length} other` },
            { label: 'Total Expenditure', value: totalExpenditure, icon: TrendingDown, color: 'bg-red-500', sub: `${expenditureEntries.length} entries` },
            { label: netBalance >= 0 ? 'Surplus' : 'Deficit', value: Math.abs(netBalance), icon: Wallet, color: netBalance >= 0 ? 'bg-purple-600' : 'bg-orange-500', sub: netBalance >= 0 ? '▲ Positive' : '▼ Negative' },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <button
              key={label}
              onClick={() => setShowAnalytics(p => !p)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon size={15} className="text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(value)}</p>
              <p className="text-xs text-slate-400 mt-1">{sub} · click for charts</p>
            </button>
          ))}
        </div>

        {/* Analytics panel */}
        {showAnalytics && (
          <AnalyticsPanel
            feePayments={feePayments}
            incomeEntries={incomeEntries}
            expenditureEntries={expenditureEntries}
            onClose={() => setShowAnalytics(false)}
          />
        )}

        {/* Income Ledger */}
        {sourceType !== 'Expenditure' && (
          <Section title="Income Ledger" badge={feePayments.length + incomeEntries.length} color="bg-emerald-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Date', 'Head / Category', 'Amount', 'From / Student', 'Mode', 'Receipt / Ref', 'Branch', 'Type'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feePayments.length === 0 && incomeEntries.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">No income records found. Adjust filters and click Apply.</td></tr>
                  ) : (
                    <>
                      {feePayments.map(p => (
                        <tr key={`fp-${p.id}`} className="border-b border-slate-50 hover:bg-emerald-50/40">
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.payment_date)}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{p.fee_type}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{p.student_name || '—'}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{p.payment_mode || 'Cash'}</span></td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">{p.receipt_no || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">—</td>
                          <td className="px-4 py-3"><span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Fee</span></td>
                        </tr>
                      ))}
                      {incomeEntries.map(i => (
                        <tr key={`inc-${i.id}`} className="border-b border-slate-50 hover:bg-blue-50/40">
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(i.date)}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{i.category || i.title}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(i.amount)}</td>
                          <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{i.received_from || '—'}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{i.payment_method || '—'}</span></td>
                          <td className="px-4 py-3 text-xs text-slate-500">—</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{i.branch || '—'}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Income</span></td>
                        </tr>
                      ))}
                    </>
                  )}
                  {(feePayments.length + incomeEntries.length) > 0 && (
                    <tr className="bg-emerald-50 font-bold">
                      <td colSpan={2} className="px-4 py-3 text-right text-sm text-slate-600">Total Income</td>
                      <td className="px-4 py-3 text-emerald-700">{formatCurrency(totalIncome)}</td>
                      <td colSpan={5} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Expenditure Ledger */}
        {sourceType !== 'Income' && (
          <Section title="Expenditure Ledger" badge={expenditureEntries.length} color="bg-red-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Date', 'Head / Category', 'Amount', 'Description', 'Paid To', 'Approved By', 'Branch'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenditureEntries.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">No expenditure records found. Adjust filters and click Apply.</td></tr>
                  ) : (
                    <>
                      {expenditureEntries.map(e => (
                        <tr key={e.id} className="border-b border-slate-50 hover:bg-red-50/40">
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{e.category}</td>
                          <td className="px-4 py-3 font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                          <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{e.description || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{e.paid_to || '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{e.approved_by || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{e.branch || '—'}</td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 font-bold">
                        <td colSpan={2} className="px-4 py-3 text-right text-sm text-slate-600">Total Expenditure</td>
                        <td className="px-4 py-3 text-red-700">{formatCurrency(totalExpenditure)}</td>
                        <td colSpan={4} />
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Net Summary */}
        {(feePayments.length + incomeEntries.length + expenditureEntries.length) > 0 && (
          <div className={`rounded-xl border-2 px-6 py-4 mb-4 ${netBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-center text-sm font-medium text-slate-600">
              {formatCurrency(totalIncome)} &nbsp;−&nbsp; {formatCurrency(totalExpenditure)} &nbsp;=&nbsp;
              <span className={`text-lg font-bold ml-1 ${netBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCurrency(Math.abs(netBalance))} {netBalance >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </p>
          </div>
        )}

        {/* Activity Monitor */}
        <Section title="Account Manager Activity" badge={activityData.length} color="bg-slate-700" defaultOpen={false}>
          <div className="p-4">
            <p className="text-xs text-slate-500 mb-3">
              Showing activity for the selected date range ({fromDate} to {toDate}).
              Re-apply filters to refresh.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Account Manager', 'Role', 'Branch', 'Fee Receipts', 'Total Amount', 'Income Entries', 'Exp. Entries', 'Total Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activityData.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">No activity data for this date range.</td></tr>
                  ) : activityData.map(a => (
                    <tr key={a.userId} className="border-b border-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                            {a.userName[0] || 'U'}
                          </div>
                          <span className="font-medium text-slate-700">{a.userName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full capitalize">{a.role}</span></td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{a.branch}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-600">{a.feeReceipts}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(a.feeAmount)}</td>
                      <td className="px-4 py-3 text-slate-600">{a.incomeEntries}</td>
                      <td className="px-4 py-3 text-slate-600">{a.expEntries}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${a.totalActions > 10 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {a.totalActions}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* Bulk Upload */}
        <Section title="Bulk Upload" color="bg-amber-700" defaultOpen={false}>
          <BulkUpload onSuccess={applyFilters} />
        </Section>
      </div>
    </div>
  )
}
