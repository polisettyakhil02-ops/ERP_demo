function paginate(query, defaultLimit = 100) {
  const limit = Math.min(500, Math.max(1, parseInt(query.limit) || defaultLimit))
  const skip = Math.max(0, (parseInt(query.page) || 1) - 1) * limit
  return { take: limit, skip }
}

module.exports = paginate
