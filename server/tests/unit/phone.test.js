'use strict'

const { isValidE164, normalizeGhanaPhone } = require('../../utils/phone')

describe('isValidE164', () => {
  it('accepts a valid Ghanaian E.164 number', () => {
    expect(isValidE164('+233201234567')).toBe(true)
  })

  it('rejects numbers without a plus prefix', () => {
    expect(isValidE164('233201234567')).toBe(false)
  })

  it('rejects numbers with a leading zero after the plus', () => {
    expect(isValidE164('+0201234567')).toBe(false)
  })

  it('rejects obviously malformed input', () => {
    expect(isValidE164('not-a-phone')).toBe(false)
    expect(isValidE164('')).toBe(false)
  })
})

describe('normalizeGhanaPhone', () => {
  it('converts a local 0-prefixed number to +233 form', () => {
    expect(normalizeGhanaPhone('0201234567')).toBe('+233201234567')
  })

  it('leaves an already-E.164 number untouched', () => {
    expect(normalizeGhanaPhone('+233201234567')).toBe('+233201234567')
  })

  it('adds a plus to a bare 233-prefixed number', () => {
    expect(normalizeGhanaPhone('233201234567')).toBe('+233201234567')
  })
})
