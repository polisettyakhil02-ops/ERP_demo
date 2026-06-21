const express = require('express')
const { z } = require('zod')

const prisma = require('../lib/prisma')
const validate = require('../lib/validate')
const { requireRole } = require('../middleware/auth')
const { notifyStudents } = require('../services/HomeworkService')

const router = express.Router()

const homeworkSchema = z.object({
  title: z.string().min(1),
  class: z.string().min(1),
  subject: z.string().min(1),
  due_date: z.string().min(1).transform(v => new Date(v)),
  section: z.string().optional(),
  description: z.string().optional(),
  assigned_by: z.string().optional(),
  status: z.string().optional(),
})

const updateSchema = homeworkSchema.partial()

router.get('/', requireRole('teacher', 'principal'), async (req, res, next) => {
  try {
    const { class: cls, subject, status } = req.query
    const where = {}
    if (cls) where.class = cls
    if (subject) where.subject = subject
    if (status) where.status = status
    const items = await prisma.homework.findMany({ where, orderBy: { due_date: 'desc' } })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/', requireRole('teacher', 'principal'), validate(homeworkSchema), async (req, res, next) => {
  try {
    const item = await prisma.homework.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

router.put('/:id', requireRole('teacher', 'principal'), validate(updateSchema), async (req, res, next) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.homework.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('teacher', 'principal'), async (req, res, next) => {
  try {
    await prisma.homework.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/:id/notify', requireRole('teacher', 'principal'), async (req, res, next) => {
  try {
    const result = await notifyStudents(req.params.id)
    res.json(result)
  } catch (err) { next(err) }
})

module.exports = router
