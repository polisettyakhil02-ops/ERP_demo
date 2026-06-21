require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authMiddleware = require('./middleware/auth')

const authRoutes = require('./routes/auth')
const studentRoutes = require('./routes/students')
const admissionRoutes = require('./routes/admissions')
const feePaymentRoutes = require('./routes/feePayments')
const studentFeeReportRoutes = require('./routes/studentFeeReport')
const attendanceRoutes = require('./routes/attendance')
const marksRoutes = require('./routes/marks')
const homeworkRoutes = require('./routes/homework')
const homeworkNotificationRoutes = require('./routes/homeworkNotifications')
const examScheduleRoutes = require('./routes/examSchedules')
const staffRoutes = require('./routes/staff')
const expenditureRoutes = require('./routes/expenditure')
const incomeRoutes = require('./routes/income')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

// Public routes
app.use('/api/auth', authRoutes)

// Protected routes
app.use('/api/students', authMiddleware, studentRoutes)
app.use('/api/admissions', authMiddleware, admissionRoutes)
app.use('/api/fee-payments', authMiddleware, feePaymentRoutes)
app.use('/api/student-fee-report', authMiddleware, studentFeeReportRoutes)
app.use('/api/attendance', authMiddleware, attendanceRoutes)
app.use('/api/marks', authMiddleware, marksRoutes)
app.use('/api/homework', authMiddleware, homeworkRoutes)
app.use('/api/homework-notifications', authMiddleware, homeworkNotificationRoutes)
app.use('/api/exam-schedules', authMiddleware, examScheduleRoutes)
app.use('/api/staff', authMiddleware, staffRoutes)
app.use('/api/expenditure', authMiddleware, expenditureRoutes)
app.use('/api/income', authMiddleware, incomeRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
