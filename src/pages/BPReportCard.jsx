import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Printer } from 'lucide-react'
import api from '@/lib/api'
import { calcGrade, formatDate } from '@/lib/utils'

const GRADE_COLORS = { 'A+':'text-emerald-600', A:'text-blue-600', B:'text-indigo-600', C:'text-yellow-600', D:'text-orange-600', F:'text-red-600' }
const EXAM_TYPES = ['Unit Test','Mid Term','Final']
const SUBJECTS = ['Maths','Science','English','Hindi','Social Studies','Computer']

export default function BPReportCard() {
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [examType, setExamType] = useState('Final')
  const [marks, setMarks] = useState([])
  const [allMarks, setAllMarks] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/students').then(d => setStudents(Array.isArray(d) ? d : d.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedStudent) return
    setLoading(true)
    api.get('/marks', { student_id: selectedStudent })
      .then(d => setAllMarks(Array.isArray(d) ? d : d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedStudent])

  useEffect(() => {
    setMarks(allMarks.filter(m => m.exam_type === examType))
  }, [allMarks, examType])

  const student = students.find(s => s.id === selectedStudent)
  const total = marks.reduce((s, m) => s + (m.marks_obtained || 0), 0)
  const maxTotal = marks.reduce((s, m) => s + (m.max_marks || 0), 0)
  const pct = maxTotal ? Math.round((total / maxTotal) * 100) : 0
  const overallGrade = calcGrade(total, maxTotal)

  const allStudentMarks = allMarks.filter(m => m.exam_type === examType)
  const studentPcts = students.map(s => {
    const sm = allMarks.filter(m => m.student_id === s.id && m.exam_type === examType)
    const t = sm.reduce((a, m) => a + m.marks_obtained, 0)
    const mx = sm.reduce((a, m) => a + m.max_marks, 0)
    return mx ? (t / mx) * 100 : 0
  }).sort((a, b) => b - a)
  const rank = studentPcts.indexOf(pct) + 1

  return (
    <div>
      <TopBar title="Report Cards" subtitle="Generate student report cards" />
      <div className="page-content">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-56">
            <option value="">Select Student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
          <Select value={examType} onChange={e => setExamType(e.target.value)} className="w-36">
            {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
          </Select>
          {student && marks.length > 0 && (
            <Button variant="outline" onClick={() => window.print()} className="ml-auto"><Printer size={15} />Print / PDF</Button>
          )}
        </div>

        {selectedStudent && !loading && marks.length === 0 && (
          <div className="text-center py-12 text-slate-400">No marks found for this student and exam type.</div>
        )}

        {student && marks.length > 0 && (
          <Card className="max-w-2xl mx-auto print:shadow-none print:border-0">
            <div className="p-6 border-b border-slate-100 text-center">
              <img src="https://media.base44.com/images/public/69fd69a017bf1eb27462604f/280b8ac37_logo.jpg" alt="School Logo" className="h-16 mx-auto mb-2 object-contain" onError={e => e.target.style.display='none'} />
              <h2 className="text-lg font-bold text-slate-800">MasterMinds School</h2>
              <p className="text-sm text-slate-500">Report Card — {examType}</p>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                <div><p className="text-xs text-slate-500">Student Name</p><p className="font-semibold text-slate-800">{student.full_name}</p></div>
                <div><p className="text-xs text-slate-500">Admission No</p><p className="font-semibold text-slate-800">{student.admission_no}</p></div>
                <div><p className="text-xs text-slate-500">Class</p><p className="font-semibold text-slate-800">Class {student.class}{student.section ? ` - ${student.section}` : ''}</p></div>
                <div><p className="text-xs text-slate-500">Rank</p><p className="font-semibold text-indigo-600">#{rank}</p></div>
              </div>

              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-2 text-slate-600 font-semibold">Subject</th>
                    <th className="text-center py-2 text-slate-600 font-semibold">Marks</th>
                    <th className="text-center py-2 text-slate-600 font-semibold">Max</th>
                    <th className="text-center py-2 text-slate-600 font-semibold">%</th>
                    <th className="text-center py-2 text-slate-600 font-semibold">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SUBJECTS.map(sub => {
                    const m = marks.find(mk => mk.subject === sub)
                    if (!m) return null
                    const g = calcGrade(m.marks_obtained, m.max_marks)
                    const p = Math.round((m.marks_obtained / m.max_marks) * 100)
                    return (
                      <tr key={sub}>
                        <td className="py-2.5 font-medium text-slate-800">{sub}</td>
                        <td className="py-2.5 text-center font-bold text-slate-800">{m.marks_obtained}</td>
                        <td className="py-2.5 text-center text-slate-500">{m.max_marks}</td>
                        <td className="py-2.5 text-center text-slate-600">{p}%</td>
                        <td className="py-2.5 text-center font-bold"><span className={GRADE_COLORS[g] || ''}>{g}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="py-3 font-bold text-slate-800">TOTAL</td>
                    <td className="py-3 text-center font-bold text-slate-800">{total}</td>
                    <td className="py-3 text-center font-bold text-slate-800">{maxTotal}</td>
                    <td className="py-3 text-center font-bold text-indigo-600">{pct}%</td>
                    <td className="py-3 text-center font-bold text-2xl"><span className={GRADE_COLORS[overallGrade] || ''}>{overallGrade}</span></td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-slate-100">
                <div><div className="h-10 border-b border-slate-300 mb-1" /><p className="text-xs text-slate-400">Student Signature</p></div>
                <div><div className="h-10 border-b border-slate-300 mb-1" /><p className="text-xs text-slate-400">Parent Signature</p></div>
                <div><div className="h-10 border-b border-slate-300 mb-1" /><p className="text-xs text-slate-400">Principal Signature</p></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
