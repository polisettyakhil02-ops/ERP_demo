const express = require('express')
const { z } = require('zod')
const paginate = require('../lib/paginate')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

const marksSchema = z.object({
  student_id: z.string().uuid(),
  exam_type: z.string().min(1),
  subject: z.string().min(1),
  marks_obtained: z.number().nonnegative(),
  max_marks: z.number().positive(),
  student_name: z.string().optional(),
  class: z.string().optional(),
  grade: z.string().optional(),
})

const updateSchema = marksSchema.partial()

router.get('/', requireRole('teacher', 'principal', 'consultant'), async (req, res, next) => {
  try {
    const { student_id, class: cls, exam_type } = req.query
    const where = {}
    if (student_id) where.student_id = student_id
    if (cls) where.class = cls
    if (exam_type) where.exam_type = exam_type
    const items = await prisma.marks.findMany({
      where,
      orderBy: { created_date: 'desc' },
      ...paginate(req.query),
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/', requireRole('teacher', 'principal'), validate(marksSchema), async (req, res, next) => {
  try {
    const item = await prisma.marks.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole('teacher', 'principal'), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, student, ...data } = req.body
    const item = await prisma.marks.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('teacher', 'principal'), async (req, res, next) => {
  try {
    await prisma.marks.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
