'use strict'

const request = require('supertest')
const app = require('../../app')
const testDb = require('./testDb')
const { createDriver, createBus, createStudent, createParent } = require('./factories')
const TripStudent = require('../../models/TripStudent')
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

async function setupDriverWithStudent(coords = {}) {
  const { user: driver, token } = await createDriver()
  const bus = await createBus(driver._id)
  const parent = await createParent()
  const student = await createStudent({ parentUserId: parent._id, driverUserId: driver._id, ...coords })
  return { driver, token, bus, parent, student }
}

describe('POST /api/trips/start', () => {
  it('starts a trip and creates TripStudent records', async () => {
    const { token, bus } = await setupDriverWithStudent()

    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ busId: bus._id })

    expect(res.status).toBe(201)
    expect(res.body.trip.status).toBe('Active')

    const tripStudents = await TripStudent.find({ tripId: res.body.trip._id })
    expect(tripStudents).toHaveLength(1)
  })

  it('returns 409 when a trip is already active for the bus', async () => {
    const { token, bus } = await setupDriverWithStudent()

    await request(app).post('/api/trips/start').set('Authorization', `Bearer ${token}`).send({ busId: bus._id })
    const res = await request(app).post('/api/trips/start').set('Authorization', `Bearer ${token}`).send({ busId: bus._id })

    expect(res.status).toBe(409)
  })
})

describe('POST /api/trips/ping — geofence triggering', () => {
  it('fires exactly one alert when the bus enters the geofence, never twice', async () => {
    const studentLat = 5.6037
    const studentLng = -0.187
    const { token, bus, student } = await setupDriverWithStudent({ lat: studentLat, lng: studentLng, radius: 500 })

    const startRes = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ busId: bus._id })
    const tripId = startRes.body.trip._id

    // Far away — should not trigger.
    await request(app)
      .post('/api/trips/ping')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, lat: studentLat + 1, lng: studentLng })

    let ts = await TripStudent.findOne({ tripId, studentId: student._id })
    expect(ts.alertTriggered).toBe(false)

    // Right on top of the student — should trigger.
    await request(app)
      .post('/api/trips/ping')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, lat: studentLat, lng: studentLng })

    ts = await TripStudent.findOne({ tripId, studentId: student._id })
    expect(ts.alertTriggered).toBe(true)
    const firstAlertTime = ts.alertTimestamp

    const logsAfterFirst = await CommunicationLog.countDocuments({ studentId: student._id, type: 'proximity_alert' })
    expect(logsAfterFirst).toBe(1)

    // Ping again from the same spot — must NOT fire a second alert (write-once).
    await request(app)
      .post('/api/trips/ping')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, lat: studentLat, lng: studentLng })

    ts = await TripStudent.findOne({ tripId, studentId: student._id })
    expect(ts.alertTimestamp.getTime()).toBe(firstAlertTime.getTime())

    const logsAfterSecond = await CommunicationLog.countDocuments({ studentId: student._id, type: 'proximity_alert' })
    expect(logsAfterSecond).toBe(1)
  })
})

describe('POST /api/trips/:id/end', () => {
  it('completes the trip and resets the bus to Idle', async () => {
    const { token, bus } = await setupDriverWithStudent()
    const startRes = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ busId: bus._id })

    const res = await request(app)
      .post(`/api/trips/${startRes.body.trip._id}/end`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trip.status).toBe('Completed')

    const Bus = require('../../models/Bus')
    const updatedBus = await Bus.findById(bus._id)
    expect(updatedBus.status).toBe('Idle')
  })
})
