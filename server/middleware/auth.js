const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // For staff users verify the token hasn't been revoked via logout
    if (decoded.role !== 'student' && decoded.version !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { token_version: true },
      })
      if (!user || user.token_version !== decoded.version) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' })
      }
    }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

module.exports = authMiddleware
module.exports.requireRole = requireRole
