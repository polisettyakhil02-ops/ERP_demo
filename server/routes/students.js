const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

// GET /api/students
router.get('/', async (req, res) => {
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
    const students = await prisma.student.findMany({ where, orderBy: { full_name: 'asc' } })
    res.json(students)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/students/:id
router.get('/:id', async (req, res) => {
  try {
    const s = await prisma.student.findUnique({ where: { id: req.params.id } })
    if (!s) return res.status(404).json({ error: 'Not found' })
    res.json(s)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/students
router.post('/', async (req, res) => {
  try {
    const s = await prisma.student.create({ data: req.body })
    res.status(201).json(s)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/students/:id
router.put('/:id', async (req, res) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const s = await prisma.student.update({ where: { id: req.params.id }, data })
    res.json(s)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/students/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
