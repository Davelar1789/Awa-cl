'use strict'

const { isPastAttendanceCutoff, startOfGhanaDay } = require('../../utils/time')

describe('attendance cutoff (06:30 GST = UTC)', () => {
  it('is not past cutoff before 06:30 UTC', () => {
    const now = new Date(Date.UTC(2026, 0, 15, 6, 29, 59))
    expect(isPastAttendanceCutoff(now)).toBe(false)
  })

  it('is past cutoff exactly at 06:30 UTC', () => {
    const now = new Date(Date.UTC(2026, 0, 15, 6, 30, 0))
    expect(isPastAttendanceCutoff(now)).toBe(true)
  })

  it('is past cutoff well after 06:30 UTC', () => {
    const now = new Date(Date.UTC(2026, 0, 15, 12, 0, 0))
    expect(isPastAttendanceCutoff(now)).toBe(true)
  })
})

describe('startOfGhanaDay', () => {
  it('normalises to midnight UTC of the same calendar day', () => {
    const input = new Date(Date.UTC(2026, 2, 3, 14, 22, 10))
    const result = startOfGhanaDay(input)
    expect(result.toISOString()).toBe('2026-03-03T00:00:00.000Z')
  })
})
