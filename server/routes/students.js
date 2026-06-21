const express = require('express')
const { z } = require('zod')
const paginate = require('../lib/paginate')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const STAFF_ROLES = ['finance', 'teacher', 'principal', 'consultant']
const WRITE_ROLES = ['finance', 'principal']

const studentSchema = z.object({
  admission_no: z.string().min(1),
  full_name: z.string().min(1),
  class: z.string().min(1),
  dob: z.string().datetime({ offset: true }).optional().or(z.string().optional()).transform(v => v ? new Date(v) : undefined),
  gender: z.string().optional(),
  blood_group: z.string().optional(),
  section: z.string().optional(),
  roll_no: z.string().optional(),
  parent_name: z.string().optional(),
  parent_phone: z.string().optional(),
  parent_email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  joining_date: z.string().optional().transform(v => v ? new Date(v) : undefined),
  status: z.enum(['Active', 'Inactive', 'Transferred']).optional(),
  photo_url: z.string().url().optional().or(z.literal('')),
})

const updateSchema = studentSchema.partial()

router.get('/', requireRole(...STAFF_ROLES), async (req, res, next) => {
  try {
    const { class: cls, section, status, search } = req.query
    const where = {}
    if (cls) where.class = cls
    if (section) where.section = section
    if (status) where.status = status
    if (search) where.OR = [
      { full_name: { contains: search, mode: 'insensitive' } },
      { admission_no: { contains: search, mode: 'insensitive' } },
    ]
    const students = await prisma.student.findMany({
      where,
      orderBy: { full_name: 'asc' },
      ...paginate(req.query),
    })
    res.json(students)
  } catch (err) { next(err) }
})

router.get('/:id', requireRole(...STAFF_ROLES), async (req, res, next) => {
  try {
    const s = await prisma.student.findUnique({ where: { id: req.params.id } })
    if (!s) return res.status(404).json({ error: 'Student not found' })
    res.json(s)
  } catch (err) { next(err) }
})

router.post('/', requireRole(...WRITE_ROLES), validate(studentSchema), async (req, res, next) => {
  try {
    const s = await prisma.student.create({ data: req.body })
    res.status(201).json(s)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole(...WRITE_ROLES, 'teacher'), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const s = await prisma.student.update({ where: { id: req.params.id }, data })
    res.json(s)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('principal'), async (req, res, next) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
