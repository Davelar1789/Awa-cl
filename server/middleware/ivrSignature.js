'use strict'

const crypto = require('crypto')
const AppError = require('../utils/AppError')
const { config } = require('../config/arkesel')

/**
 * Validates the `X-Arkesel-Signature` header Arkesel sends on every IVR
 * webhook, using a constant-time comparison against the configured shared
 * secret so a timing attack can't be used to guess it byte-by-byte.
 *
 * In mock mode (no real Arkesel account wired up yet) this is a no-op so
 * local/dev testing against the webhook routes doesn't require a real
 * signature — it still refuses to run that way in production.
 */
function verifyIvrSignature(req, res, next) {
  if (config.mockMode && process.env.NODE_ENV !== 'production') {
    return next()
  }

  const secret = config.webhookSecret
  if (!secret) {
    return next(new AppError('IVR webhook secret is not configured.', 500))
  }

  const signature = req.headers['x-arkesel-signature']
  if (!signature || typeof signature !== 'string') {
    return next(new AppError('Missing X-Arkesel-Signature header.', 401))
  }

  const expected = Buffer.from(secret)
  const received = Buffer.from(signature)

  const valid =
    expected.length === received.length && crypto.timingSafeEqual(expected, received)

  if (!valid) {
    return next(new AppError('Invalid webhook signature.', 401))
  }

  next()
}

module.exports = { verifyIvrSignature }
