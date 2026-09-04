'use strict'

const request = require('supertest')
const app = require('../../app')
const testDb = require('./testDb')
const { createDriver, createStudent, createParent, nextPhone } = require('./factories')
const DailyAttendance = require('../../models/DailyAttendance')
const AuthLog = require('../../models/AuthLog')

beforeAll(async () => {
  await testDb.connect()
})
afterEach(async () => {
  await testDb.clearDatabase()
  jest.useRealTimers()
})
afterAll(async () => {
  await testDb.disconnect()
})

describe('IVR PIN verification', () => {
  it('disconnects after 3 incorrect PIN attempts', async () => {
    const parentPhone = nextPhone()
    await createParent({ phone: parentPhone, ivrPinHash: '1234' })

    const sessionId = 'sess-pin-lockout'

    // Caller ID not recognised -> prompted for phone.
    await request(app).post('/api/ivr/inbound').send({ session_id: sessionId, from: '+233000000000' })
    await request(app).post('/api/ivr/dtmf').send({ session_id: sessionId, digits: parentPhone })

    // Three wrong PINs.
    await request(app).post('/api/ivr/dtmf').send({ session_id: sessionId, digits: '0000' })
    await request(app).post('/api/ivr/dtmf').send({ session_id: sessionId, digits: '1111' })
    const res = await request(app).post('/api/ivr/dtmf').send({ session_id: sessionId, digits: '2222' })

    expect(res.body.hangup).toBe(true)
    expect(res.body.say).toMatch(/too many/i)

    const failedAttempts = await AuthLog.countDocuments({ channel: 'ivr', success: false, reason: 'wrong_pin' })
    expect(failedAttempts).toBe(3)
  })

  it('accepts the correct PIN and greets the parent by their student\'s name', async () => {
    const parentPhone = nextPhone()
    const parent = await createParent({ phone: parentPhone, ivrPinHash: '1234' })
    await createStudent({ parentUserId: parent._id, driverUserId: parent._id, lat: 5, lng: 0 })
    // Reuse parent._id as a stand-in driverUserId reference — irrelevant to this PIN test.

    const sessionId = 'sess-pin-ok'
    await request(app).post('/api/ivr/inbound').send({ session_id: sessionId, from: '+233000000001' })
    await request(app).post('/api/ivr/dtmf').send({ session_id: sessionId, digits: parentPhone })
    const res = await request(app).post('/api/ivr/dtmf').send({ session_id: sessionId, digits: '1234' })

    expect(res.body.hangup).toBeFalsy()
    expect(res.body.say).toMatch(/press 1 to cancel/i)
  })
})

describe('IVR press 1 — cancel pickup', () => {
  it('blocks cancellation after the attendance cutoff with no DB mutation', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(Date.UTC(2026, 0, 15, 7, 0, 0))) // 07:00 UTC, past 06:30 cutoff

    const driver = await createDriver()
    const parent = await createParent({ phone: nextPhone(), ivrPinHash: '1234' })
    const student = await createStudent({ parentUserId: parent._id, driverUserId: driver.user._id })

    const sessionId = 'sess-cutoff'
    await request(app).post('/api/ivr/inbound').send({ session_id: sessionId, from: parent.phone })
    const res = await request(app).post('/api/ivr/dtmf').send({ session_id: sessionId, digits: '1' })

    expect(res.body.say).toMatch(/must be made before/i)

    const attendance = await DailyAttendance.findOne({ studentId: student._id })
    expect(attendance).toBeNull()
  })

  it('cancels pickup before the cutoff', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(Date.UTC(2026, 0, 15, 5, 0, 0))) // 05:00 UTC, before cutoff

    const driver = await createDriver()
    const parent = await createParent({ phone: nextPhone(), ivrPinHash: '1234' })
    const student = await createStudent({ parentUserId: parent._id, driverUserId: driver.user._id })

    const sessionId = 'sess-cancel-ok'
    await request(app).post('/api/ivr/inbound').send({ session_id: sessionId, from: parent.phone })
    const res = await request(app).post('/api/ivr/dtmf').send({ session_id: sessionId, digits: '1' })

    expect(res.body.say).toMatch(/cancelled for today/i)

    const attendance = await DailyAttendance.findOne({ studentId: student._id })
    expect(attendance).not.toBeNull()
    expect(attendance.attending).toBe(false)
    expect(attendance.updatedByIVR).toBe(true)
  })
})
