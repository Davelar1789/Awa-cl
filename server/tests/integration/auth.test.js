'use strict'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../../app')
const testDb = require('./testDb')
const { createAdmin, nextPhone } = require('./factories')

beforeAll(async () => {
  await testDb.connect()
})
afterEach(async () => {
  await testDb.clearDatabase()
})
afterAll(async () => {
  await testDb.disconnect()
})

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const { user } = await createAdmin({ passwordHash: 'CorrectHorse1!' })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: user.phone, password: 'CorrectHorse1!' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.phone).toBe(user.phone)
    expect(res.body.user.passwordHash).toBeUndefined()
  })

  it('rejects the wrong password', async () => {
    const { user } = await createAdmin({ passwordHash: 'CorrectHorse1!' })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: user.phone, password: 'WrongPassword' })

    expect(res.status).toBe(401)
  })

  it('locks the account after 5 failed attempts', async () => {
    const { user } = await createAdmin({ passwordHash: 'CorrectHorse1!' })

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ phone: user.phone, password: 'nope' })
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: user.phone, password: 'CorrectHorse1!' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/locked/i)
  })
})

describe('JWT expiry', () => {
  it('rejects an expired token with 401', async () => {
    const { user } = await createAdmin()
    const expiredToken = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '-1s' })

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/expired/i)
  })

  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/register', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', phone: nextPhone(), role: 'driver', password: 'Password123!' })
    expect(res.status).toBe(401)
  })

  it('lets an admin create a new driver', async () => {
    const { token } = await createAdmin()
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Driver', phone: nextPhone(), role: 'driver', password: 'Password123!' })

    expect(res.status).toBe(201)
    expect(res.body.user.role).toBe('driver')
  })

  it('rejects a duplicate phone number', async () => {
    const { token } = await createAdmin()
    const phone = nextPhone()
    await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A', phone, role: 'driver', password: 'Password123!' })

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B', phone, role: 'driver', password: 'Password123!' })

    expect(res.status).toBe(409)
  })
})
