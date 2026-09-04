'use strict'

// E.164: + followed by 7-15 digits, first digit non-zero.
const E164_REGEX = /^\+[1-9]\d{6,14}$/

function isValidE164(phone) {
  return typeof phone === 'string' && E164_REGEX.test(phone.trim())
}

/**
 * Best-effort normalisation for Ghanaian numbers entered without the
 * international prefix, e.g. "0201234567" -> "+233201234567".
 * Leaves already-E.164 numbers untouched. Does not validate.
 */
function normalizeGhanaPhone(raw) {
  if (typeof raw !== 'string') return raw
  const trimmed = raw.trim().replace(/[\s-]/g, '')
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('0') && trimmed.length === 10) {
    return `+233${trimmed.slice(1)}`
  }
  if (trimmed.startsWith('233')) return `+${trimmed}`
  return trimmed
}

module.exports = { isValidE164, normalizeGhanaPhone, E164_REGEX }
