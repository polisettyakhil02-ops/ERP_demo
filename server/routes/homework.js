const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const { class: cls, subject, status } = req.query
    const where = {}
    if (cls) where.class = cls
    if (subject) where.subject = subject
    if (status) where.status = status
    const items = await prisma.homework.findMany({ where, orderBy: { due_date: 'desc' } })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', async (req, res) => {
  try {
    const item = await prisma.homework.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.homework.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.homework.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Notify students in the homework's class
router.post('/:id/notify', async (req, res) => {
  try {
    const hw = await prisma.homework.findUnique({ where: { id: req.params.id } })
    if (!hw) return res.status(404).json({ error: 'Homework not found' })

    const students = await prisma.student.findMany({
      where: { class: hw.class, status: 'Active' },
      select: { id: true }
    })

    const notifications = []
    for (const s of students) {
      const existing = await prisma.homeworkNotification.findFirst({
        where: { homework_id: hw.id, student_id: s.id }
      })
      if (!existing) {
        const n = await prisma.homeworkNotification.create({
          data: { homework_id: hw.id, student_id: s.id, is_read: false }
        })
        notifications.push(n)
      }
    }

    await prisma.homework.update({ where: { id: hw.id }, data: { status: 'Notified' } })
    res.json({ count: notifications.length, notifications })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
