'use strict'

const User = require('../../models/User')
const Bus = require('../../models/Bus')
const Student = require('../../models/Student')
const { signToken } = require('../../utils/jwt')

let phoneCounter = 200000000

function nextPhone() {
  phoneCounter += 1
  return `+233${phoneCounter}`
}

async function createAdmin(overrides = {}) {
  const user = await User.create({
    name: 'Test Admin',
    phone: nextPhone(),
    role: 'admin',
    passwordHash: 'Password123!',
    mustChangePassword: false,
    ...overrides,
  })
  return { user, token: signToken(user._id) }
}

async function createDriver(overrides = {}) {
  const user = await User.create({
    name: 'Test Driver',
    phone: nextPhone(),
    role: 'driver',
    passwordHash: 'Password123!',
    mustChangePassword: false,
    ...overrides,
  })
  return { user, token: signToken(user._id) }
}

async function createParent(overrides = {}) {
  const user = await User.create({
    name: 'Test Parent',
    phone: nextPhone(),
    role: 'parent',
    ivrPinHash: '1234',
    ...overrides,
  })
  return user
}

async function createBus(driverUserId, overrides = {}) {
  return Bus.create({
    registrationNumber: `GT-${Math.floor(Math.random() * 100000)}-25`,
    assignedDriverUserId: driverUserId ?? null,
    ...overrides,
  })
}

async function createStudent({ parentUserId, driverUserId, lat = 5.6037, lng = -0.187, radius = 500 }) {
  return Student.create({
    name: 'Test Student',
    parentUserId,
    driverUserId,
    homeLatitude: lat,
    homeLongitude: lng,
    geofenceRadius: radius,
  })
}

module.exports = { createAdmin, createDriver, createParent, createBus, createStudent, nextPhone }
