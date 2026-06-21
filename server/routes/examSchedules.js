const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const { class: cls, exam_type, academic_year } = req.query
    const where = {}
    if (cls) where.class = cls
    if (exam_type) where.exam_type = exam_type
    if (academic_year) where.academic_year = academic_year
    const items = await prisma.examSchedule.findMany({ where, orderBy: { start_date: 'desc' } })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.examSchedule.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ error: 'Not found' })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', async (req, res) => {
  try {
    const item = await prisma.examSchedule.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.examSchedule.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.examSchedule.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
