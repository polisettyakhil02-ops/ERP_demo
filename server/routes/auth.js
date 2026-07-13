const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { z } = require('zod')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const authMiddleware = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const studentLoginSchema = z.object({
  admission_no: z.string().min(1),
})

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(['finance', 'teacher', 'principal', 'consultant']),
  branch: z.string().optional(),
  password: z.string().min(8),
})

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user.id, role: user.role, branch: user.branch, version: user.token_version },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    const { password: _, token_version: __, ...userSafe } = user
    res.json({ token, user: userSafe })
  } catch (err) { next(err) }
})

router.post('/student-login', validate(studentLoginSchema), async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { admission_no: req.body.admission_no } })
    if (!student || student.status !== 'Active') {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: student.id, role: 'student', admission_no: student.admission_no },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )
    res.json({ token, student })
  } catch (err) { next(err) }
})

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { token_version: { increment: 1 } },
      })
    }
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/invite', authMiddleware, requireRole('principal'), validate(inviteSchema), async (req, res, next) => {
  try {
    const { email, full_name, role, branch, password } = req.body
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email, full_name, role, branch, password: hashed } })
    const { password: _, token_version: __, ...safe } = user
    res.json(safe)
  } catch (err) { next(err) }
})

router.post('/seed', (req, res, next) => {
  if (process.env.SEED_ENABLED !== 'true') {
    return res.status(403).json({ error: 'Seed endpoint is disabled.' })
  }
  next()
}, async (req, res, next) => {
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
        const { password: _, token_version: __, ...safe } = user
        created.push(safe)
      }
    }
    res.json({ seeded: created.length, users: created })
  } catch (err) { next(err) }
})

module.exports = router
