const express = require('express')
const { z } = require('zod')
const paginate = require('../lib/paginate')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const staffSchema = z.object({
  full_name: z.string().min(1),
  role: z.string().min(1),
  subject_taught: z.string().optional(),
  qualification: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  joining_date: z.string().optional().transform(v => v ? new Date(v) : undefined),
  salary: z.number().nonnegative().optional(),
  status: z.enum(['Active', 'Inactive', 'On Leave']).optional(),
})

const updateSchema = staffSchema.partial()

router.get('/', requireRole('principal', 'finance'), async (req, res, next) => {
  try {
    const { role, status, search } = req.query
    const where = {}
    if (role) where.role = role
    if (status) where.status = status
    if (search) where.OR = [
      { full_name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
    const items = await prisma.staff.findMany({
      where,
      orderBy: { full_name: 'asc' },
      ...paginate(req.query),
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.get('/:id', requireRole('principal', 'finance'), async (req, res, next) => {
  try {
    const item = await prisma.staff.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ error: 'Staff member not found' })
    res.json(item)
  } catch (err) { next(err) }
})

router.post('/', requireRole('principal'), validate(staffSchema), async (req, res, next) => {
  try {
    const item = await prisma.staff.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole('principal'), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.staff.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('principal'), async (req, res, next) => {
  try {
    await prisma.staff.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
