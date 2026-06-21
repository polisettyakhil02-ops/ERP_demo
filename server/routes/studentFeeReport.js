const express = require('express')
const { z } = require('zod')
const paginate = require('../lib/paginate')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const feeReportSchema = z.object({
  student_name: z.string().min(1),
  father_name: z.string().min(1),
  mob_number: z.string().min(1),
  class: z.string().min(1),
  student_type: z.string().min(1),
  student_id: z.string().uuid().optional(),
  old_fee: z.number().nonnegative().optional(),
  adm_gross_fee: z.number().nonnegative().optional(),
  adm_concession: z.number().nonnegative().optional(),
  net_adm_fee: z.number().nonnegative().optional(),
  paid_adm_fee: z.number().nonnegative().optional(),
  balance_adm_fee: z.number().optional(),
  gross_term_fee: z.number().nonnegative().optional(),
  term_concession: z.number().nonnegative().optional(),
  net_term_fee: z.number().nonnegative().optional(),
  paid_term_fee: z.number().nonnegative().optional(),
  balance_term_fee: z.number().optional(),
  remarks: z.string().optional(),
  status: z.string().optional(),
})

const updateSchema = feeReportSchema.partial()

router.get('/', requireRole('finance', 'consultant'), async (req, res, next) => {
  try {
    const { class: cls, student_type, status } = req.query
    const where = {}
    if (cls) where.class = cls
    if (student_type) where.student_type = student_type
    if (status) where.status = status
    const items = await prisma.studentFeeReport.findMany({
      where,
      orderBy: { student_name: 'asc' },
      ...paginate(req.query),
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/', requireRole('finance'), validate(feeReportSchema), async (req, res, next) => {
  try {
    const item = await prisma.studentFeeReport.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole('finance'), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.studentFeeReport.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('finance'), async (req, res, next) => {
  try {
    await prisma.studentFeeReport.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
