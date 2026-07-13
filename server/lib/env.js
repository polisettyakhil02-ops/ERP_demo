const REQUIRED = ['DATABASE_URL', 'JWT_SECRET']

function validateEnv() {
  const missing = REQUIRED.filter(key => !process.env[key])
  if (missing.length) {
    console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`)
    console.error('[startup] Copy server/.env.example to server/.env and fill in the values.')
    process.exit(1)
  }
}

module.exports = validateEnv
