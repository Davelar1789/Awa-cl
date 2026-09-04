'use strict'

const request = require('supertest')
const app = require('../../app')
const testDb = require('./testDb')
const { createDriver, createBus, createStudent, createParent, nextPhone } = require('./factories')
const CommunicationLog = require('../../models/CommunicationLog')

beforeAll(async () => {
  await testDb.connect()
})
afterEach(async () => {
  await testDb.clearDatabase()
})
afterAll(async () => {
  await testDb.disconnect()
})

describe('POST /api/trips/:id/broadcast', () => {
  it('sends exactly one SMS to a parent with two children on the same route', async () => {
    const { user: driver, token } = await createDriver()
    const bus = await createBus(driver._id)
    const parent = await createParent({ phone: nextPhone() })

    await createStudent({ parentUserId: parent._id, driverUserId: driver._id, lat: 5.1, lng: -0.1 })
    await createStudent({ parentUserId: parent._id, driverUserId: driver._id, lat: 5.2, lng: -0.2 })

    const startRes = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ busId: bus._id })

    const res = await request(app)
      .post(`/api/trips/${startRes.body.trip._id}/broadcast`)
      .set('Authorization', `Bearer ${token}`)
      .send({ delayMinutes: 15 })

    expect(res.status).toBe(200)
    expect(res.body.recipientCount).toBe(1)

    const smsLogs = await CommunicationLog.countDocuments({ type: 'delay_broadcast', parentUserId: parent._id })
    expect(smsLogs).toBe(1)
  })

  it('sends to two parents when two students have different parents', async () => {
    const { user: driver, token } = await createDriver()
    const bus = await createBus(driver._id)
    const parentA = await createParent({ phone: nextPhone() })
    const parentB = await createParent({ phone: nextPhone() })

    await createStudent({ parentUserId: parentA._id, driverUserId: driver._id })
    await createStudent({ parentUserId: parentB._id, driverUserId: driver._id })

    const startRes = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ busId: bus._id })

    const res = await request(app)
      .post(`/api/trips/${startRes.body.trip._id}/broadcast`)
      .set('Authorization', `Bearer ${token}`)
      .send({ delayMinutes: 10 })

    expect(res.body.recipientCount).toBe(2)
  })
})
