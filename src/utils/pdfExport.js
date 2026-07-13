import jsPDF from 'jspdf'

const LOGO_URL = 'https://media.base44.com/images/public/69fd69a017bf1eb27462604f/280b8ac37_logo.jpg'

// Indian number-to-words (Rupees)
const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

function numToWords(n) {
  if (n === 0) return 'Zero'
  if (n < 0) return 'Minus ' + numToWords(-n)
  let w = ''
  if (n >= 10000000) { w += numToWords(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000 }
  if (n >= 100000) { w += numToWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000 }
  if (n >= 1000) { w += numToWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000 }
  if (n >= 100) { w += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100 }
  if (n >= 20) { w += tens[Math.floor(n / 10)] + ' '; n %= 10 }
  if (n > 0) w += ones[n] + ' '
  return w.trim()
}

export function amountInWords(amount) {
  const rounded = Math.round(amount)
  return `Rupees ${numToWords(rounded)} Only`
}

function drawReceiptBlock(doc, x, y, w, data) {
  const { student, fees, totals, receiptNo, receiptDate, payMode, academicYear, copyLabel } = data
  const pad = 8
  let cy = y + pad

  // Header with logo placeholder
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('MasterMinds School', x + w / 2, cy, { align: 'center' })
  cy += 5
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text('Dominare Group', x + w / 2, cy, { align: 'center' })
  cy += 5
  doc.setDrawColor(200)
  doc.line(x + pad, cy, x + w - pad, cy)
  cy += 4

  // Copy label
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120)
  doc.text(copyLabel, x + w - pad, y + 5, { align: 'right' })

  // Title
  doc.setFontSize(11)
  doc.setTextColor(0)
  doc.text('FEE RECEIPT', x + w / 2, cy, { align: 'center' })
  cy += 5

  // Receipt details
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Receipt No: ${receiptNo || '—'}`, x + pad, cy)
  doc.text(`Date: ${receiptDate}`, x + w / 2, cy)
  doc.text(`Year: ${academicYear}`, x + w - pad, cy, { align: 'right' })
  cy += 4

  // Student info
  doc.setDrawColor(220)
  doc.line(x + pad, cy, x + w - pad, cy)
  cy += 4
  doc.setFont('helvetica', 'bold')
  doc.text(`Name: ${student.full_name}`, x + pad, cy)
  doc.text(`Class: ${student.class || '—'}`, x + w / 2, cy)
  doc.text(`Adm No: ${student.admission_no || '—'}`, x + w - pad, cy, { align: 'right' })
  cy += 5

  // Fee table
  doc.line(x + pad, cy, x + w - pad, cy)
  cy += 3.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Fee Type', x + pad, cy)
  doc.text('Total', x + w - 55, cy, { align: 'right' })
  doc.text('Paid', x + w - 30, cy, { align: 'right' })
  doc.text('Balance', x + w - pad, cy, { align: 'right' })
  cy += 3
  doc.line(x + pad, cy, x + w - pad, cy)
  cy += 3

  doc.setFont('helvetica', 'normal')
  fees.filter(f => f.totalFee > 0 || f.amountPaid > 0).forEach(f => {
    doc.text(f.label, x + pad, cy)
    doc.text(f.totalFee.toLocaleString('en-IN'), x + w - 55, cy, { align: 'right' })
    doc.text(f.amountPaid.toLocaleString('en-IN'), x + w - 30, cy, { align: 'right' })
    doc.text(f.balance.toLocaleString('en-IN'), x + w - pad, cy, { align: 'right' })
    cy += 4
  })

  doc.line(x + pad, cy, x + w - pad, cy)
  cy += 3.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('TOTAL', x + pad, cy)
  doc.text(totals.totalFee.toLocaleString('en-IN'), x + w - 55, cy, { align: 'right' })
  doc.text(totals.amountPaid.toLocaleString('en-IN'), x + w - 30, cy, { align: 'right' })
  doc.text(totals.balance.toLocaleString('en-IN'), x + w - pad, cy, { align: 'right' })
  cy += 5

  // Amount in words
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(60)
  doc.text(amountInWords(totals.amountPaid), x + pad, cy)
  cy += 4

  // Balance due
  if (totals.balance > 0) {
    doc.setFillColor(255, 245, 230)
    doc.roundedRect(x + pad, cy, w - pad * 2, 6, 1, 1, 'F')
    doc.setTextColor(180, 80, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(`Balance Due: ₹${totals.balance.toLocaleString('en-IN')}`, x + pad + 2, cy + 4)
    cy += 8
    doc.setTextColor(0)
  }

  // Payment mode
  cy += 2
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)
  doc.setFontSize(7)
  doc.text(`Payment Mode: ${payMode}`, x + pad, cy)
  cy += 8

  // Signature lines
  doc.setTextColor(0)
  doc.line(x + pad, cy, x + pad + 30, cy)
  doc.line(x + w - pad - 30, cy, x + w - pad, cy)
  cy += 3
  doc.text('Authorised Signatory', x + pad, cy)
  doc.text('Receiver', x + w - pad, cy, { align: 'right' })
  cy += 6

  // Footer
  doc.setFontSize(6.5)
  doc.setTextColor(160)
  doc.setFont('helvetica', 'italic')
  doc.text('This is a computer-generated receipt.', x + w / 2, cy, { align: 'center' })

  // Border
  doc.setDrawColor(200)
  doc.rect(x, y, w, cy - y + 4)
}

export async function generateReceiptPDF(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })

  const pageW = 297
  const pageH = 210
  const blockW = 135
  const gap = 7
  const startX = 10
  const startY = 10

  drawReceiptBlock(doc, startX, startY, blockW, { ...data, copyLabel: 'PARENT COPY' })
  drawReceiptBlock(doc, startX + blockW + gap, startY, blockW, { ...data, copyLabel: 'OFFICE COPY' })

  doc.save(`Receipt_${data.student.admission_no || 'student'}_${data.receiptDate}.pdf`)
}

export function generateHallTicketPDF(schedule, students) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  students.forEach((student, idx) => {
    if (idx > 0) doc.addPage()

    const pad = 15
    let y = pad

    // Header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('MasterMinds School', 105, y, { align: 'center' })
    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text('Hall Ticket — ' + schedule.exam_name, 105, y, { align: 'center' })
    y += 4
    doc.setDrawColor(180)
    doc.line(pad, y, 195, y)
    y += 6

    // Student info
    doc.setTextColor(0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Student Details', pad, y)
    y += 5
    doc.setFont('helvetica', 'normal')

    const info = [
      ['Name', student.full_name],
      ['Admission No', student.admission_no || '—'],
      ['Class', `${student.class}${student.section ? ' - ' + student.section : ''}`],
      ['Roll No', student.roll_no || '—'],
      ['Exam Center', schedule.center || 'School Campus'],
      ['Invigilator', schedule.invigilator || '—'],
    ]

    info.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}:`, pad, y)
      doc.setFont('helvetica', 'normal')
      doc.text(value, pad + 35, y)
      y += 5
    })

    y += 3
    doc.setDrawColor(200)
    doc.line(pad, y, 195, y)
    y += 5

    // Exam schedule table
    doc.setFont('helvetica', 'bold')
    doc.text('Examination Schedule', pad, y)
    y += 5

    // Table header
    doc.setFillColor(240, 242, 255)
    doc.rect(pad, y, 180, 7, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Subject', pad + 2, y + 5)
    doc.text('Date', pad + 50, y + 5)
    doc.text('Time', pad + 90, y + 5)
    doc.text('Duration', pad + 125, y + 5)
    doc.text('Max Marks', pad + 155, y + 5)
    y += 7

    const subjects = Array.isArray(schedule.subjects) ? schedule.subjects : []
    subjects.forEach(sub => {
      doc.setFont('helvetica', 'normal')
      doc.text(sub.subject || '', pad + 2, y + 5)
      doc.text(sub.date || '—', pad + 50, y + 5)
      doc.text(sub.time || '—', pad + 90, y + 5)
      doc.text(sub.duration || '—', pad + 125, y + 5)
      doc.text(String(sub.max_marks || '—'), pad + 155, y + 5)
      doc.setDrawColor(220)
      doc.line(pad, y + 7, pad + 180, y + 7)
      y += 7
    })

    y += 8

    // Instructions
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Instructions:', pad, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    const instructions = [
      '1. Students must carry this hall ticket to the examination hall.',
      '2. No electronic devices are permitted in the examination hall.',
      '3. Students must be present 15 minutes before the exam.',
      '4. This hall ticket must be produced on demand by the invigilator.',
    ]
    instructions.forEach(ins => {
      doc.text(ins, pad, y)
      y += 4
    })

    y += 10

    // Signature lines
    doc.setFontSize(8)
    doc.line(pad, y, pad + 40, y)
    doc.line(85, y, 125, y)
    doc.line(155, y, 195, y)
    y += 4
    doc.text('Student Signature', pad, y)
    doc.text('Parent Signature', 85, y)
    doc.text('Principal Signature', 155, y)
  })

  doc.save(`HallTickets_${schedule.class}_${schedule.exam_name}.pdf`)
}
