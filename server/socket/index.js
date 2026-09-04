'use strict'

const { Server } = require('socket.io')
const { verifyToken } = require('../utils/jwt')
const User = require('../models/User')

let io = null

/**
 * Rooms:
 *  - `admin`        — every connected admin; receives every log:new / alert:critical.
 *  - `driver:<id>`   — a single driver's own connections (future: push cancellations
 *                      / bridge notifications straight to their app).
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_WEB_URL || 'http://localhost:5173',
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return next(new Error('Unauthorized'))
      const decoded = verifyToken(token)
      const user = await User.findById(decoded.id)
      if (!user || user.status !== 'active') return next(new Error('Unauthorized'))
      socket.user = user
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const { role, _id } = socket.user
    if (role === 'admin') socket.join('admin')
    if (role === 'driver') socket.join(`driver:${_id}`)
  })

  return io
}

function getIO() {
  return io
}

function emitToAdmins(event, payload) {
  if (io) io.to('admin').emit(event, payload)
}

function emitToDriver(driverId, event, payload) {
  if (io) io.to(`driver:${driverId}`).emit(event, payload)
}

module.exports = { initSocket, getIO, emitToAdmins, emitToDriver }
