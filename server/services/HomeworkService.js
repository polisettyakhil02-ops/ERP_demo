const prisma = require('../lib/prisma')

async function notifyStudents(homeworkId) {
  const hw = await prisma.homework.findUnique({ where: { id: homeworkId } })
  if (!hw) {
    const err = new Error('Homework not found')
    err.status = 404; err.expose = true
    throw err
  }

  const [students, existing] = await Promise.all([
    prisma.student.findMany({
      where: { class: hw.class, status: 'Active' },
      select: { id: true },
    }),
    prisma.homeworkNotification.findMany({
      where: { homework_id: hw.id },
      select: { student_id: true },
    }),
  ])

  const alreadyNotified = new Set(existing.map(n => n.student_id))
  const toCreate = students
    .filter(s => !alreadyNotified.has(s.id))
    .map(s => ({
      homework_id: hw.id,
      student_id: s.id,
      title: hw.title,
      subject: hw.subject,
      class: hw.class,
      section: hw.section,
      description: hw.description,
      due_date: hw.due_date,
      assigned_by: hw.assigned_by,
      is_read: false,
    }))

  await prisma.$transaction([
    ...(toCreate.length ? [prisma.homeworkNotification.createMany({ data: toCreate })] : []),
    prisma.homework.update({ where: { id: hw.id }, data: { status: 'Notified' } }),
  ])

  return { count: toCreate.length }
}

module.exports = { notifyStudents }
