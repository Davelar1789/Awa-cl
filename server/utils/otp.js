'use strict'

const crypto = require('crypto')

/** Cryptographically-random 6-digit numeric OTP, zero-padded. */
function generateOtp() {
  const n = crypto.randomInt(0, 1000000)
  return String(n).padStart(6, '0')
}

/** Cryptographically-random 4-digit numeric PIN, zero-padded. */
function generatePin() {
  const n = crypto.randomInt(0, 10000)
  return String(n).padStart(4, '0')
}

module.exports = { generateOtp, generatePin }
