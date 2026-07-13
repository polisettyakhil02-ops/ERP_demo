import { useState } from 'react'
import { CheckCircle2, UserPlus, RotateCcw } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/dialog'
import api from '@/lib/api'
import { BRANCHES, SUBJECTS, CLASS_LIST, TEACHER_ROLES } from '@/lib/constants'

const EMPTY = {
  full_name: '',
  branch: '',
  phone: '',
  subject_taught: '',
  classes_taught: [],
  aadhar_number: '',
  role: 'Teacher',
  email: '',
  qualification: '',
}

function validate(form) {
  const errors = {}
  if (!form.full_name.trim()) errors.full_name = 'Name is required'
  if (!form.branch) errors.branch = 'Branch is required'
  if (!form.phone) {
    errors.phone = 'Phone number is required'
  } else if (!/^\d{10}$/.test(form.phone)) {
    errors.phone = 'Must be exactly 10 digits'
  }
  if (!form.subject_taught) errors.subject_taught = 'Subject is required'
  if (!form.classes_taught.length) errors.classes_taught = 'Select at least one class'
  if (!form.aadhar_number) {
    errors.aadhar_number = 'Aadhar number is required'
  } else if (!/^\d{12}$/.test(form.aadhar_number)) {
    errors.aadhar_number = 'Must be exactly 12 digits'
  }
  return errors
}

function ClassCheckboxGrid({ selected, onChange }) {
  const groups = [
    { label: 'Pre-Primary', classes: CLASS_LIST.slice(0, 3) },
    { label: 'Primary (I–V)', classes: CLASS_LIST.slice(3, 8) },
    { label: 'Middle (VI–VIII)', classes: CLASS_LIST.slice(8, 11) },
    { label: 'Secondary (IX–X)', classes: CLASS_LIST.slice(11, 13) },
    { label: 'Senior Secondary (XI–XII)', classes: CLASS_LIST.slice(13) },
  ]

  const toggle = (cls) => {
    onChange(selected.includes(cls) ? selected.filter(c => c !== cls) : [...selected, cls])
  }

  const toggleGroup = (classes) => {
    const allSelected = classes.every(c => selected.includes(c))
    if (allSelected) {
      onChange(selected.filter(c => !classes.includes(c)))
    } else {
      const toAdd = classes.filter(c => !selected.includes(c))
      onChange([...selected, ...toAdd])
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50">
      {groups.map(g => (
        <div key={g.label}>
          <button
            type="button"
            onClick={() => toggleGroup(g.classes)}
            className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 hover:text-indigo-600 transition-colors flex items-center gap-1"
          >
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-white ${
              g.classes.every(c => selected.includes(c))
                ? 'bg-indigo-600 border-indigo-600'
                : g.classes.some(c => selected.includes(c))
                ? 'bg-indigo-300 border-indigo-300'
                : 'border-slate-300 bg-white'
            }`}>
              {g.classes.every(c => selected.includes(c)) ? '✓' : g.classes.some(c => selected.includes(c)) ? '–' : ''}
            </span>
            {g.label}
          </button>
          <div className="flex flex-wrap gap-2">
            {g.classes.map(cls => (
              <button
                key={cls}
                type="button"
                onClick={() => toggle(cls)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selected.includes(cls)
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TeacherForm() {
  const [form, setForm] = useState({ ...EMPTY })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      await api.post('/staff', { ...form, status: 'Active', joining_date: new Date().toISOString().split('T')[0] })
      setSuccess(form.full_name)
      setForm({ ...EMPTY })
      setErrors({})
    } catch (err) {
      setErrors({ _global: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => { setForm({ ...EMPTY }); setErrors({}); setSuccess(null) }

  return (
    <div>
      <TopBar title="Teacher Registration" subtitle="Register new teaching staff members" />
      <div className="page-content">
        <div className="max-w-3xl mx-auto">

          {success && (
            <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
              <CheckCircle2 size={20} className="text-green-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">{success} registered successfully!</p>
                <p className="text-xs text-green-600 mt-0.5">You can now register another teacher below.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset} className="text-green-700 border-green-300 hover:bg-green-100">
                <RotateCcw size={13} /> Clear
              </Button>
            </div>
          )}

          {errors._global && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors._global}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Personal Details */}
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Personal Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormField label="Full Name" required>
                    <Input
                      value={form.full_name}
                      onChange={e => set('full_name', e.target.value)}
                      placeholder="Enter teacher's full name"
                      className={errors.full_name ? 'border-red-400 focus:ring-red-400' : ''}
                    />
                    {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
                  </FormField>
                </div>

                <FormField label="Branch" required>
                  <select
                    value={form.branch}
                    onChange={e => set('branch', e.target.value)}
                    className={`w-full h-9 rounded-md border px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.branch ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    <option value="">— Select branch —</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  {errors.branch && <p className="text-xs text-red-500 mt-1">{errors.branch}</p>}
                </FormField>

                <FormField label="Teacher Role" required>
                  <select
                    value={form.role}
                    onChange={e => set('role', e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {TEACHER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>

                <FormField label="Phone Number" required>
                  <Input
                    value={form.phone}
                    onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    maxLength={10}
                    className={errors.phone ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {errors.phone
                      ? <p className="text-xs text-red-500">{errors.phone}</p>
                      : <span />}
                    <span className={`text-xs ${form.phone.length === 10 ? 'text-green-600' : 'text-slate-400'}`}>
                      {form.phone.length}/10
                    </span>
                  </div>
                </FormField>

                <FormField label="Aadhar Number" required>
                  <Input
                    value={form.aadhar_number}
                    onChange={e => set('aadhar_number', e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="12-digit Aadhar number"
                    inputMode="numeric"
                    maxLength={12}
                    className={errors.aadhar_number ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {errors.aadhar_number
                      ? <p className="text-xs text-red-500">{errors.aadhar_number}</p>
                      : <span />}
                    <span className={`text-xs ${form.aadhar_number.length === 12 ? 'text-green-600' : 'text-slate-400'}`}>
                      {form.aadhar_number.length}/12
                    </span>
                  </div>
                </FormField>

                <FormField label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="Optional"
                  />
                </FormField>

                <FormField label="Qualification">
                  <Input
                    value={form.qualification}
                    onChange={e => set('qualification', e.target.value)}
                    placeholder="e.g. B.Ed, M.Sc"
                  />
                </FormField>
              </div>
            </div>

            {/* Teaching Details */}
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Teaching Assignment</h3>
              <div className="space-y-4">
                <FormField label="Subject" required>
                  <select
                    value={form.subject_taught}
                    onChange={e => set('subject_taught', e.target.value)}
                    className={`w-full h-9 rounded-md border px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.subject_taught ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    <option value="">— Select subject —</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.subject_taught && <p className="text-xs text-red-500 mt-1">{errors.subject_taught}</p>}
                </FormField>

                <FormField label="Classes Taught" required>
                  <ClassCheckboxGrid
                    selected={form.classes_taught}
                    onChange={v => set('classes_taught', v)}
                  />
                  <div className="flex items-center justify-between mt-2">
                    {errors.classes_taught
                      ? <p className="text-xs text-red-500">{errors.classes_taught}</p>
                      : <span />}
                    {form.classes_taught.length > 0 && (
                      <span className="text-xs text-indigo-600 font-medium">
                        {form.classes_taught.length} class{form.classes_taught.length !== 1 ? 'es' : ''} selected
                      </span>
                    )}
                  </div>
                </FormField>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl">
              <button type="button" onClick={handleReset} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                Clear form
              </button>
              <Button type="submit" loading={saving} className="gap-2">
                <UserPlus size={15} />
                Register Teacher
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
