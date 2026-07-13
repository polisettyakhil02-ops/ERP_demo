const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    const details = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    return res.status(400).json({ error: 'Validation failed', details })
  }
  req.body = result.data
  next()
}

module.exports = validate
