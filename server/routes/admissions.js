const express = require('express')
const { z } = require('zod')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')
const { convertToStudent } = require('../services/AdmissionService')

const router = express.Router()

const READ_ROLES = ['finance', 'principal', 'consultant']
const WRITE_ROLES = ['finance', 'principal']

const admissionSchema = z.object({
  academic_year: z.string().min(1),
  application_no: z.string().min(1),
  class_sought: z.string().min(1),
  student_name: z.string().min(1),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  dob: z.string().optional().transform(v => v ? new Date(v) : undefined),
  father_name: z.string().optional(),
  father_mobile: z.string().optional(),
  mother_name: z.string().optional(),
  mother_mobile: z.string().optional(),
  communication_address: z.string().optional(),
  branch: z.string().optional(),
  state: z.string().optional(),
  form_status: z.string().optional(),
  admission_no: z.string().optional(),
  fee_payable_amount: z.number().nonnegative().optional(),
  passport_photo: z.string().optional(),
})

const updateSchema = admissionSchema.partial()

function paginate(query) {
  const limit = Math.min(500, Math.max(1, parseInt(query.limit) || 100))
  const skip = Math.max(0, (parseInt(query.page) || 1) - 1) * limit
  return { take: limit, skip }
}

router.get('/', requireRole(...READ_ROLES), async (req, res, next) => {
  try {
    const { branch, status, class: cls, year, search } = req.query
    const where = {}
    if (branch) where.branch = branch
    if (status) where.form_status = status
    if (cls) where.class_sought = cls
    if (year) where.academic_year = year
    if (search) where.OR = [
      { student_name: { contains: search, mode: 'insensitive' } },
      { application_no: { contains: search, mode: 'insensitive' } },
    ]
    const items = await prisma.admission.findMany({
      where,
      orderBy: { created_date: 'desc' },
      ...paginate(req.query),
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.get('/:id', requireRole(...READ_ROLES), async (req, res, next) => {
  try {
    const item = await prisma.admission.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ error: 'Admission not found' })
    res.json(item)
  } catch (err) { next(err) }
})

router.post('/', requireRole(...WRITE_ROLES), validate(admissionSchema), async (req, res, next) => {
  try {
    const item = await prisma.admission.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole(...WRITE_ROLES), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.admission.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    await prisma.admission.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/:id/convert', requireRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const student = await convertToStudent(req.params.id)
    res.json(student)
  } catch (err) { next(err) }
})

module.exports = router
