const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err.code || err.message)

  if (err.code === 'P2002') return res.status(409).json({ error: 'A record with that value already exists.' })
  if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found.' })
  if (err.code === 'P2003') return res.status(400).json({ error: 'Related record not found.' })

  const status = err.status || 500
  const message = err.expose ? err.message : 'Internal server error'
  res.status(status).json({ error: message })
}

module.exports = errorHandler
