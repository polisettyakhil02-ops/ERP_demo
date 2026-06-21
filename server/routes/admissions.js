const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
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
    const items = await prisma.admission.findMany({ where, orderBy: { created_date: 'desc' } })
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.admission.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ error: 'Not found' })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', async (req, res) => {
  try {
    const item = await prisma.admission.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const { id, created_date, updated_date, ...data } = req.body
    const item = await prisma.admission.update({ where: { id: req.params.id }, data })
    res.json(item)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.admission.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Convert admission to student
router.post('/:id/convert', async (req, res) => {
  try {
    const adm = await prisma.admission.findUnique({ where: { id: req.params.id } })
    if (!adm) return res.status(404).json({ error: 'Admission not found' })
    const adm_no = adm.admission_no || `ADM${Date.now()}`
    const student = await prisma.student.create({
      data: {
        admission_no: adm_no,
        full_name: adm.student_name,
        gender: adm.gender,
        dob: adm.dob,
        class: adm.class_sought,
        parent_name: adm.father_name,
        parent_phone: adm.father_mobile,
        status: 'Active',
        joining_date: new Date(),
      }
    })
    await prisma.admission.update({ where: { id: req.params.id }, data: { form_status: 'Admitted', admission_no: adm_no } })
    res.json(student)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
