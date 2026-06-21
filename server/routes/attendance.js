const express = require('express')
const { z } = require('zod')

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

const bulkSchema = z.array(recordSchema).min(1)

router.get('/', requireRole(...READ_ROLES), async (req, res, next) => {
  try {
    const { student_id, date, class: cls, section } = req.query
    const where = {}
    if (student_id) where.student_id = student_id
    if (cls) where.class = cls
    if (section) where.section = section
    if (date) {
      const d = new Date(date)
      where.date = {
        gte: new Date(new Date(d).setHours(0, 0, 0, 0)),
        lt: new Date(new Date(d).setHours(23, 59, 59, 999)),
      }
    }
    const items = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' } })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/', requireRole(...WRITE_ROLES), validate(recordSchema), async (req, res, next) => {
  try {
    const item = await prisma.attendance.create({ data: { ...req.body, date: new Date(req.body.date) } })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.post('/bulk', requireRole(...WRITE_ROLES), validate(bulkSchema), async (req, res, next) => {
  try {
    const records = req.body
    if (!records.length) return res.json({ count: 0, records: [] })

    const dateObj = new Date(records[0].date)
    const dayStart = new Date(new Date(dateObj).setHours(0, 0, 0, 0))
    const dayEnd = new Date(new Date(dateObj).setHours(23, 59, 59, 999))

    const existing = await prisma.attendance.findMany({
      where: {
        student_id: { in: records.map(r => r.student_id) },
        date: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true, student_id: true },
    })
    const existingMap = new Map(existing.map(r => [r.student_id, r.id]))

    const toCreate = []
    const toUpdate = []
    for (const r of records) {
      if (existingMap.has(r.student_id)) {
        toUpdate.push({ id: existingMap.get(r.student_id), status: r.status })
      } else {
        toCreate.push({ ...r, date: new Date(r.date) })
      }
    }

    const results = await prisma.$transaction([
      ...(toCreate.length ? [prisma.attendance.createMany({ data: toCreate, skipDuplicates: true })] : []),
      ...toUpdate.map(u => prisma.attendance.update({ where: { id: u.id }, data: { status: u.status } })),
    ])

    res.json({ count: records.length })
  } catch (err) { next(err) }
})

module.exports = router
