'use strict'

// Fails fast at boot if required environment variables are missing, instead
// of surfacing confusing errors deep inside a request handler later.
const REQUIRED = ['MONGO_URI', 'JWT_SECRET']

function assertEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key] || !process.env[key].trim())
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to .env and fill them in.`
    )
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production.')
    }
    if (!process.env.ARKESEL_WEBHOOK_SECRET) {
      throw new Error('ARKESEL_WEBHOOK_SECRET is required in production to validate IVR webhooks.')
    }
  }
}

module.exports = { assertEnv }
