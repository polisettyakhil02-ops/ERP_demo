const express = require('express')
const { z } = require('zod')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const READ_ROLES = ['teacher', 'principal', 'finance']
const WRITE_ROLES = ['teacher', 'principal']

const scheduleSchema = z.object({
  exam_name: z.string().min(1),
  class: z.string().min(1),
  academic_year: z.string().min(1),
  exam_type: z.string().min(1),
  subjects: z.array(z.record(z.any())).min(1),
  section: z.string().optional(),
  center: z.string().optional(),
  invigilator: z.string().optional(),
})

const updateSchema = scheduleSchema.partial()

router.get('/', requireRole(...READ_ROLES), async (req, res, next) => {
  try {
    const { class: cls, exam_type, academic_year } = req.query
    const where = {}
    if (cls) where.class = cls
    if (exam_type) where.exam_type = exam_type
    if (academic_year) where.academic_year = academic_year
    const items = await prisma.examSchedule.findMany({ where, orderBy: { created_date: 'desc' } })
    res.json(items)
  } catch (err) { next(err) }
})

router.get('/:id', requireRole(...READ_ROLES), async (req, res, next) => {
  try {
    const item = await prisma.examSchedule.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ error: 'Exam schedule not found' })
    res.json(item)
  } catch (err) { next(err) }
})

router.post('/', requireRole(...WRITE_ROLES), validate(scheduleSchema), async (req, res, next) => {
  try {
    const item = await prisma.examSchedule.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole(...WRITE_ROLES), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.examSchedule.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('principal'), async (req, res, next) => {
  try {
    await prisma.examSchedule.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
