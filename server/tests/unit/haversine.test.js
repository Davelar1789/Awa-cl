'use strict'

const { haversineDistance } = require('../../utils/haversine')

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(5.6037, -0.187, 5.6037, -0.187)).toBeCloseTo(0, 3)
  })

  it('is accurate to within 1 metre at a known ~500m separation', () => {
    // Two points ~0.0045 deg apart in latitude at Accra's latitude (~5.6N)
    // is very close to 500m: 0.0045 * 111,320m/deg ≈ 500.9m.
    const lat1 = 5.6037
    const lng1 = -0.187
    const lat2 = 5.6037 + 0.0045
    const lng2 = -0.187

    const distance = haversineDistance(lat1, lng1, lat2, lng2)
    expect(distance).toBeGreaterThan(495)
    expect(distance).toBeLessThan(505)
  })

  it('is symmetric', () => {
    const a = haversineDistance(5.6, -0.2, 5.61, -0.21)
    const b = haversineDistance(5.61, -0.21, 5.6, -0.2)
    expect(a).toBeCloseTo(b, 6)
  })

  it('matches a known reference distance (Accra to Kumasi, ~200-250km)', () => {
    const accra = [5.6037, -0.187]
    const kumasi = [6.6885, -1.6244]
    const distanceKm = haversineDistance(...accra, ...kumasi) / 1000
    expect(distanceKm).toBeGreaterThan(190)
    expect(distanceKm).toBeLessThan(260)
  })
})
