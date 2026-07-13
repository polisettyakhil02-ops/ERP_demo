const express = require('express')
const prisma = require('../lib/prisma')
const { requireRole } = require('../middleware/auth')

const router = express.Router()

router.get('/branch-stats', requireRole('finance'), async (req, res, next) => {
  try {
    const [studentGroups, paidFees, expenditures] = await Promise.all([
      prisma.student.groupBy({
        by: ['branch'],
        where: { status: 'Active' },
        _count: { id: true },
      }),
      prisma.feePayment.findMany({
        where: { status: 'Paid' },
        select: { amount: true, student: { select: { branch: true } } },
        take: 10000,
      }),
      prisma.expenditure.groupBy({
        by: ['branch'],
        _sum: { amount: true },
      }),
    ])

    const studentMap = {}
    studentGroups.forEach(g => { if (g.branch) studentMap[g.branch] = g._count.id })

    const incomeMap = {}
    paidFees.forEach(f => {
      const b = f.student?.branch || 'Unassigned'
      incomeMap[b] = (incomeMap[b] || 0) + (f.amount || 0)
    })

    const expMap = {}
    expenditures.forEach(g => {
      if (g.branch) expMap[g.branch] = (g._sum.amount || 0)
    })

    const allBranches = new Set([
      ...Object.keys(studentMap),
      ...Object.keys(incomeMap),
      ...Object.keys(expMap),
    ])
    allBranches.delete('Unassigned')

    const branches = [...allBranches].map(branch => ({
      branch,
      students: studentMap[branch] || 0,
      income: incomeMap[branch] || 0,
      expenditure: expMap[branch] || 0,
      net: (incomeMap[branch] || 0) - (expMap[branch] || 0),
    })).sort((a, b) => b.income - a.income)

    const totalIncome = Object.values(incomeMap).reduce((s, v) => s + v, 0)
    const totalExpenditure = Object.values(expMap).reduce((s, v) => s + v, 0)

    res.json({
      totalBranches: allBranches.size,
      totalIncome,
      totalExpenditure,
      netBalance: totalIncome - totalExpenditure,
      branches,
    })
  } catch (err) { next(err) }
})

router.get('/activity', requireRole('finance'), async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query
    const fromDate = from_date ? new Date(from_date) : new Date(Date.now() - 7 * 86400000)
    const toDate = to_date ? new Date(to_date) : new Date()
    toDate.setHours(23, 59, 59, 999)

    const [feePayments, incomeEntries, expEntries] = await Promise.all([
      prisma.feePayment.findMany({
        where: { payment_date: { gte: fromDate, lte: toDate }, status: 'Paid' },
        select: { created_by: true, amount: true },
      }),
      prisma.income.findMany({
        where: { date: { gte: fromDate, lte: toDate } },
        select: { created_by: true, amount: true },
      }),
      prisma.expenditure.findMany({
        where: { date: { gte: fromDate, lte: toDate } },
        select: { created_by: true, amount: true },
      }),
    ])

    const userStats = {}
    const ensure = (id) => {
      if (!id) return null
      if (!userStats[id]) userStats[id] = { userId: id, feeReceipts: 0, feeAmount: 0, incomeEntries: 0, expEntries: 0 }
      return userStats[id]
    }

    feePayments.forEach(p => { const s = ensure(p.created_by); if (s) { s.feeReceipts++; s.feeAmount += p.amount || 0 } })
    incomeEntries.forEach(i => { const s = ensure(i.created_by); if (s) s.incomeEntries++ })
    expEntries.forEach(e => { const s = ensure(e.created_by); if (s) s.expEntries++ })

    const userIds = Object.keys(userStats).filter(Boolean)
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true, branch: true, role: true },
        })
      : []
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    const result = Object.values(userStats).map(s => ({
      ...s,
      userName: userMap[s.userId]?.full_name || 'Unknown',
      branch: userMap[s.userId]?.branch || '—',
      role: userMap[s.userId]?.role || '—',
      totalActions: s.feeReceipts + s.incomeEntries + s.expEntries,
    })).sort((a, b) => b.totalActions - a.totalActions)

    res.json(result)
  } catch (err) { next(err) }
})

module.exports = router
