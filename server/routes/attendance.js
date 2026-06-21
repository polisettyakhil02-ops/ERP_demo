const express = require('express')
const { z } = require('zod')
const paginate = require('../lib/paginate')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const READ_ROLES = ['teacher', 'principal', 'finance']
const WRITE_ROLES = ['teacher', 'principal']

const recordSchema = z.object({
  student_id: z.string().uuid(),
  date: z.string().min(1),
  status: z.enum(['Present', 'Absent', 'Late']),
  student_name: z.string().optional(),
  class: z.string().optional(),
  section: z.string().optional(),
  marked_by: z.string().optional(),
})

const bulkSchema = z.array(recordSchema).min(1).max(100)

function toMidnightUTC(dateStr) {
  const d = new Date(dateStr)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

router.get('/', requireRole(...READ_ROLES), async (req, res, next) => {
  try {
    const { student_id, date, class: cls, section } = req.query
    const where = {}
    if (student_id) where.student_id = student_id
    if (cls) where.class = cls
    if (section) where.section = section
    if (date) {
      const midnight = toMidnightUTC(date)
      where.date = { gte: midnight, lt: new Date(midnight.getTime() + 86_400_000) }
    }
    const items = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' }, ...paginate(req.query) })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/', requireRole(...WRITE_ROLES), validate(recordSchema), async (req, res, next) => {
  try {
    const date = toMidnightUTC(req.body.date)
    const markedBy = req.user.id
    const item = await prisma.attendance.upsert({
      where: { student_id_date: { student_id: req.body.student_id, date } },
      update: { status: req.body.status, marked_by: markedBy },
      create: { ...req.body, date, marked_by: markedBy },
    })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.post('/bulk', requireRole(...WRITE_ROLES), validate(bulkSchema), async (req, res, next) => {
  try {
    const records = req.body

    const markedBy = req.user.id
    const results = await prisma.$transaction(
      records.map(r => {
        const date = toMidnightUTC(r.date)
        return prisma.attendance.upsert({
          where: { student_id_date: { student_id: r.student_id, date } },
          update: { status: r.status, marked_by: markedBy },
          create: { ...r, date, marked_by: markedBy },
        })
      })
    )

    res.json({ count: results.length })
  } catch (err) { next(err) }
})

module.exports = router
