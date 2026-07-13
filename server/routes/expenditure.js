const express = require('express')
const { z } = require('zod')
const paginate = require('../lib/paginate')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const expenditureSchema = z.object({
  category: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(1).transform(v => new Date(v)),
  description: z.string().optional(),
  paid_to: z.string().optional(),
  approved_by: z.string().optional(),
  branch: z.string().optional(),
})

const updateSchema = expenditureSchema.partial()

const bulkItemSchema = z.object({
  category: z.string().min(1),
  amount: z.preprocess(v => parseFloat(v), z.number().positive()),
  date: z.string().min(1).transform(v => new Date(v)),
  description: z.string().optional(),
  paid_to: z.string().optional(),
  approved_by: z.string().optional(),
  branch: z.string().optional(),
})

router.get('/', requireRole('finance', 'consultant'), async (req, res, next) => {
  try {
    const { category, search, from_date, to_date, branch } = req.query
    const where = {}
    if (category) where.category = category
    if (search) where.description = { contains: search, mode: 'insensitive' }
    if (branch) where.branch = branch
    if (from_date || to_date) {
      where.date = {}
      if (from_date) where.date.gte = new Date(from_date)
      if (to_date) { const d = new Date(to_date); d.setHours(23, 59, 59, 999); where.date.lte = d }
    }
    const items = await prisma.expenditure.findMany({
      where,
      orderBy: { date: 'desc' },
      ...paginate(req.query),
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/', requireRole('finance', 'consultant'), validate(expenditureSchema), async (req, res, next) => {
  try {
    const branch = req.body.branch || req.user.branch || undefined
    const item = await prisma.expenditure.create({ data: { ...req.body, branch, created_by: req.user.id } })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.post('/bulk', requireRole('finance'), async (req, res, next) => {
  try {
    const { records } = req.body
    if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ error: 'records array required' })
    if (records.length > 500) return res.status(400).json({ error: 'Maximum 500 records per bulk upload' })

    const parsed = []
    const errors = []
    records.forEach((r, i) => {
      const result = bulkItemSchema.safeParse(r)
      if (result.success) parsed.push({ ...result.data, branch: r.branch || req.user.branch || undefined, created_by: req.user.id })
      else errors.push({ row: i + 2, issues: result.error.issues.map(e => e.message).join('; ') })
    })

    if (errors.length > 0) return res.status(422).json({ error: 'Validation failed', errors })

    const created = await prisma.expenditure.createMany({ data: parsed })
    res.status(201).json({ inserted: created.count })
  } catch (err) { next(err) }
})

router.put('/:id', requireRole('finance'), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.expenditure.update({ where: { id: req.params.id }, data: { ...data, updated_by: req.user.id } })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('finance'), async (req, res, next) => {
  try {
    await prisma.expenditure.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
