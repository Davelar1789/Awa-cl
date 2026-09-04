'use strict'

const { shouldTrigger } = require('../../services/geofenceEngine')
const { haversineDistance } = require('../../utils/haversine')

describe('geofence boundary logic (shouldTrigger)', () => {
  const RADIUS = 500

  it('triggers well within the radius (200m, 400m, 490m)', () => {
    expect(shouldTrigger(200, RADIUS)).toBe(true)
    expect(shouldTrigger(400, RADIUS)).toBe(true)
    expect(shouldTrigger(490, RADIUS)).toBe(true)
  })

  it('triggers on the inclusive boundary (exactly 500m)', () => {
    expect(shouldTrigger(500, RADIUS)).toBe(true)
  })

  it('does not trigger just outside the radius (510m, 600m, 800m)', () => {
    expect(shouldTrigger(510, RADIUS)).toBe(false)
    expect(shouldTrigger(600, RADIUS)).toBe(false)
    expect(shouldTrigger(800, RADIUS)).toBe(false)
  })

  it('agrees with a real haversine distance at the boundary', () => {
    const studentLat = 5.6037
    const studentLng = -0.187
    // ~500m due north
    const busLat = studentLat + 500 / 111320
    const busLng = studentLng

    const distance = haversineDistance(busLat, busLng, studentLat, studentLng)
    // Allow the same ±1m tolerance as the haversine accuracy test.
    expect(shouldTrigger(distance, 501)).toBe(true)
  })
})
