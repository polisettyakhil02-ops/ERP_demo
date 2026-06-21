const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, branch: user.branch },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    const { password: _, ...userSafe } = user
    res.json({ token, user: userSafe })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/student-login
router.post('/student-login', async (req, res) => {
  try {
    const { admission_no } = req.body
    if (!admission_no) return res.status(400).json({ error: 'Admission number required' })

    const student = await prisma.student.findUnique({ where: { admission_no } })
    if (!student) return res.status(404).json({ error: 'Student not found' })

    const token = jwt.sign(
      { id: student.id, role: 'student', admission_no: student.admission_no },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )

    res.json({ token, student })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    res.json({ user: decoded })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// POST /api/auth/invite — admin creates user
router.post('/invite', async (req, res) => {
  try {
    const { email, full_name, role, branch, password } = req.body
    const hashed = await bcrypt.hash(password || 'demo123', 10)
    const user = await prisma.user.create({
      data: { email, full_name, role, branch, password: hashed }
    })
    const { password: _, ...safe } = user
    res.json(safe)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/seed — seed demo users
router.post('/seed', async (req, res) => {
  try {
    const demoUsers = [
      { email: 'finance@mastermindserp.com', full_name: 'Finance Admin', role: 'finance', branch: 'Hyderabad' },
      { email: 'teacher@mastermindserp.com', full_name: 'Demo Teacher', role: 'teacher', branch: 'Hyderabad' },
      { email: 'principal@mastermindserp.com', full_name: 'School Principal', role: 'principal', branch: 'Hyderabad' },
      { email: 'consultant@mastermindserp.com', full_name: 'Accounts Manager', role: 'consultant', branch: null },
    ]
    const hashed = await bcrypt.hash('demo123', 10)
    const created = []
    for (const u of demoUsers) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } })
      if (!existing) {
        const user = await prisma.user.create({ data: { ...u, password: hashed } })
        const { password: _, ...safe } = user
        created.push(safe)
      }
    }
    res.json({ seeded: created.length, users: created })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
