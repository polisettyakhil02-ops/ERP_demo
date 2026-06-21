const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const { class: cls, student_type, status } = req.query
    const where = {}
    if (cls) where.class = cls
    if (student_type) where.student_type = student_type
    if (status) where.status = status
    const items = await prisma.studentFeeReport.findMany({ where, orderBy: { student_name: 'asc' } })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', async (req, res) => {
  try {
    const item = await prisma.studentFeeReport.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.studentFeeReport.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.studentFeeReport.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
