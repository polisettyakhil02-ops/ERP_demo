const express = require('express')

const prisma = require('../lib/prisma')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

// Students and teachers can both access notifications
const ALLOWED = ['student', 'teacher', 'principal', 'finance', 'consultant']

router.get('/', requireRole(...ALLOWED), async (req, res, next) => {
  try {
    const { student_id, is_read } = req.query
    const where = {}

    // Students can only see their own notifications
    if (req.user.role === 'student') {
      where.student_id = req.user.id
    } else if (student_id) {
      where.student_id = student_id
    }

    if (is_read !== undefined) where.is_read = is_read === 'true'

    const items = await prisma.homeworkNotification.findMany({
      where,
      orderBy: { created_date: 'desc' },
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.put('/:id/read', requireRole(...ALLOWED), async (req, res, next) => {
  try {
    const item = await prisma.homeworkNotification.update({
      where: { id: req.params.id },
      data: { is_read: true },
    })
    res.json(item)
  } catch (err) { next(err) }
})

module.exports = router
