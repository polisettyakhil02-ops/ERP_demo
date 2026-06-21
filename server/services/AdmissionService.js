const prisma = require('../lib/prisma')

async function convertToStudent(admissionId) {
  const adm = await prisma.admission.findUnique({ where: { id: admissionId } })
  if (!adm) {
    const err = new Error('Admission not found')
    err.status = 404; err.expose = true
    throw err
  }

  if (adm.form_status === 'Admitted') {
    const err = new Error('This admission has already been converted to a student')
    err.status = 409; err.expose = true
    throw err
  }

  const adm_no = adm.admission_no || `ADM${Date.now()}`

  const [student] = await prisma.$transaction([
    prisma.student.create({
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
      },
    }),
    prisma.admission.update({
      where: { id: admissionId },
      data: { form_status: 'Admitted', admission_no: adm_no },
    }),
  ])

  return student
}

module.exports = { convertToStudent }
