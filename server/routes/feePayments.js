const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const { student_id, academic_year, fee_type, status } = req.query
    const where = {}
    if (student_id) where.student_id = student_id
    if (academic_year) where.academic_year = academic_year
    if (fee_type) where.fee_type = fee_type
    if (status) where.status = status
    const items = await prisma.feePayment.findMany({ where, orderBy: { created_date: 'desc' } })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', async (req, res) => {
  try {
    const item = await prisma.feePayment.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const { id, created_date, updated_date, student, ...data } = req.body
    const item = await prisma.feePayment.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.feePayment.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
