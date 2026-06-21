const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const { student_id, date, class: cls, section } = req.query
    const where = {}
    if (student_id) where.student_id = student_id
    if (cls) where.class = cls
    if (section) where.section = section
    if (date) {
      const d = new Date(date)
      where.date = { gte: new Date(d.setHours(0,0,0,0)), lt: new Date(d.setHours(23,59,59,999)) }
    }
    const items = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' } })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', async (req, res) => {
  try {
    const item = await prisma.attendance.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Bulk save attendance for a class on a date
router.post('/bulk', async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : []
    const results = []
    for (const r of records) {
      const dateObj = new Date(r.date)
      const dayStart = new Date(dateObj.setHours(0,0,0,0))
      const dayEnd = new Date(dateObj.setHours(23,59,59,999))
      const existing = await prisma.attendance.findFirst({
        where: { student_id: r.student_id, date: { gte: dayStart, lt: dayEnd } }
      })
      if (existing) {
        const updated = await prisma.attendance.update({ where: { id: existing.id }, data: { status: r.status } })
        results.push(updated)
      } else {
        const created = await prisma.attendance.create({ data: { ...r, date: new Date(r.date) } })
        results.push(created)
      }
    }
    res.json({ count: results.length, records: results })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
