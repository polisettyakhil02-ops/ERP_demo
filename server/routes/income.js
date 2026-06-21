const express = require('express')
const { z } = require('zod')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const incomeSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(1).transform(v => new Date(v)),
  category: z.string().optional(),
  received_from: z.string().optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
})

const updateSchema = incomeSchema.partial()

function paginate(query) {
  const limit = Math.min(500, Math.max(1, parseInt(query.limit) || 100))
  const skip = Math.max(0, (parseInt(query.page) || 1) - 1) * limit
  return { take: limit, skip }
}

router.get('/', requireRole('finance', 'consultant'), async (req, res, next) => {
  try {
    const { type, from_date, to_date } = req.query
    const where = {}
    if (type) where.category = type
    if (from_date || to_date) {
      where.date = {}
      if (from_date) where.date.gte = new Date(from_date)
      if (to_date) where.date.lte = new Date(to_date)
    }
    const items = await prisma.income.findMany({
      where,
      orderBy: { date: 'desc' },
      ...paginate(req.query),
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/', requireRole('finance'), validate(incomeSchema), async (req, res, next) => {
  try {
    const item = await prisma.income.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole('finance'), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.income.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('finance'), async (req, res, next) => {
  try {
    await prisma.income.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
