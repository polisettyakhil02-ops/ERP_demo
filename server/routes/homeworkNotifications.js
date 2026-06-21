const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const { student_id, is_read } = req.query
    const where = {}
    if (student_id) where.student_id = student_id
    if (is_read !== undefined) where.is_read = is_read === 'true'
    const items = await prisma.homeworkNotification.findMany({
      where,
      include: { homework: true },
      orderBy: { created_date: 'desc' }
    })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id/read', async (req, res) => {
  try {
    const item = await prisma.homeworkNotification.update({
      where: { id: req.params.id },
      data: { is_read: true }
    })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
