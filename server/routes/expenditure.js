const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const { category, search, from_date, to_date } = req.query
    const where = {}
    if (category) where.category = category
    if (search) where.description = { contains: search, mode: 'insensitive' }
    if (from_date || to_date) {
      where.date = {}
      if (from_date) where.date.gte = new Date(from_date)
      if (to_date) where.date.lte = new Date(to_date)
    }
    const items = await prisma.expenditure.findMany({ where, orderBy: { date: 'desc' } })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', async (req, res) => {
  try {
    const item = await prisma.expenditure.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.expenditure.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.expenditure.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
