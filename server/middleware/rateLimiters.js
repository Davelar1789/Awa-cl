'use strict'

const rateLimit = require('express-rate-limit')

const baseOpts = {
  standardHeaders: true,
  legacyHeaders: false,
}

// Login: brute-force protection at the network layer, on top of the
// per-account lockout enforced in the login handler itself.
const loginLimiter = rateLimit({
  ...baseOpts,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
})

// Refresh: generous but bounded, matches README (10/hr/user would need a
// keyed limiter; IP-based is the practical proxy here).
const refreshLimiter = rateLimit({
  ...baseOpts,
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Too many refresh attempts. Try again later.' },
})

// Forgot-password / OTP flows: strict, since each attempt sends a real SMS.
const otpRequestLimiter = rateLimit({
  ...baseOpts,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many password reset requests. Try again in 15 minutes.' },
})

const otpVerifyLimiter = rateLimit({
  ...baseOpts,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many OTP attempts. Try again in 15 minutes.' },
})

// IVR webhooks: generous (real call traffic) but still capped against abuse
// of the public endpoint.
const ivrLimiter = rateLimit({
  ...baseOpts,
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many requests.' },
})

// GPS ping: allow well above the expected 1 ping / 10s cadence per driver,
// enough headroom for retry storms without being wide open.
const pingLimiter = rateLimit({
  ...baseOpts,
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many GPS pings. Slow down.' },
})

// General API surface — generous ceiling as a last line of defence.
const generalLimiter = rateLimit({
  ...baseOpts,
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { message: 'Too many requests. Please slow down.' },
})

module.exports = {
  loginLimiter,
  refreshLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  ivrLimiter,
  pingLimiter,
  generalLimiter,
}
