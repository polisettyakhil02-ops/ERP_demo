const express = require('express')
const { z } = require('zod')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const feeSchema = z.object({
  student_id: z.string().uuid(),
  academic_year: z.string().min(1),
  fee_type: z.string().min(1),
  amount: z.number().nonnegative(),
  student_name: z.string().optional(),
  payment_date: z.string().optional().transform(v => v ? new Date(v) : undefined),
  payment_mode: z.enum(['Cash', 'Online', 'Cheque', 'DD', 'Card']).optional(),
  receipt_no: z.string().optional(),
  status: z.enum(['Paid', 'Pending', 'Partial']).optional(),
})

const updateSchema = feeSchema.partial()

function paginate(query) {
  const limit = Math.min(500, Math.max(1, parseInt(query.limit) || 100))
  const skip = Math.max(0, (parseInt(query.page) || 1) - 1) * limit
  return { take: limit, skip }
}

router.get('/', requireRole('finance', 'consultant'), async (req, res, next) => {
  try {
    const { student_id, academic_year, fee_type, status } = req.query
    const where = {}
    if (student_id) where.student_id = student_id
    if (academic_year) where.academic_year = academic_year
    if (fee_type) where.fee_type = fee_type
    if (status) where.status = status
    const items = await prisma.feePayment.findMany({
      where,
      orderBy: { created_date: 'desc' },
      ...paginate(req.query),
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/', requireRole('finance'), validate(feeSchema), async (req, res, next) => {
  try {
    const item = await prisma.feePayment.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole('finance'), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, student, ...data } = req.body
    const item = await prisma.feePayment.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('finance'), async (req, res, next) => {
  try {
    await prisma.feePayment.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
