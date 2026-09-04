'use strict'

const express = require('express')
const { body } = require('express-validator')

const Trip = require('../models/Trip')
const TripStudent = require('../models/TripStudent')
const Bus = require('../models/Bus')
const Student = require('../models/Student')
const DailyAttendance = require('../models/DailyAttendance')
const { runGeofenceCheck } = require('../services/geofenceEngine')
const { sendDelayBroadcast } = require('../services/broadcastService')
const { protect } = require('../middleware/auth')
const { allow } = require('../middleware/rbac')
const validate = require('../middleware/validate')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const { pingLimiter } = require('../middleware/rateLimiters')
const { startOfGhanaDay } = require('../utils/time')
const { emitToAdmins } = require('../socket')

const router = express.Router()

router.use(protect, allow('driver'))

async function loadOwnTrip(req) {
  const trip = await Trip.findById(req.params.id)
  if (!trip) throw new AppError('Trip not found.', 404)
  if (String(trip.driverUserId) !== String(req.user._id)) {
    throw new AppError('Forbidden.', 403)
  }
  return trip
}

// ── POST /api/trips/start ─────────────────────────────────────────────────
router.post(
  '/start',
  [
    body('busId').isMongoId().withMessage('A valid busId is required.'),
    body('direction').optional().isIn(['dropoff', 'pickup']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const driverId = req.user._id
    const { busId, direction } = req.body

    const bus = await Bus.findOne({ _id: busId, assignedDriverUserId: driverId })
    if (!bus) throw new AppError('Bus not found or not assigned to you.', 404)

    const existingActive = await Trip.findOne({ driverUserId: driverId, status: 'Active' })
    if (existingActive || bus.status === 'Active Trip') {
      throw new AppError('A trip is already active for this bus.', 409)
    }

    const students = await Student.find({ driverUserId: driverId, active: true }).select('_id')
    if (!students.length) throw new AppError('No active students on your route.', 400)

    // Respect any same-day cancellations made via the IVR "press 1" flow —
    // those students start the trip already marked not-attending.
    const cancellations = await DailyAttendance.find({
      studentId: { $in: students.map((s) => s._id) },
      date: startOfGhanaDay(),
      attending: false,
    }).select('studentId')
    const cancelledIds = new Set(cancellations.map((c) => String(c.studentId)))

    let trip
    try {
      trip = await Trip.create({
        driverUserId: driverId,
        busId: bus._id,
        direction: direction || 'dropoff',
        status: 'Active',
        startTime: new Date(),
      })
    } catch (err) {
      if (err.code === 11000) throw new AppError('A trip is already active for this bus.', 409)
      throw err
    }

    await TripStudent.insertMany(
      students.map((s) => ({
        tripId: trip._id,
        studentId: s._id,
        attending: !cancelledIds.has(String(s._id)),
        alertTriggered: false,
      }))
    )

    bus.status = 'Active Trip'
    await bus.save()

    emitToAdmins('trip:started', {
      tripId: trip._id,
      busId: bus._id,
      driverId,
      studentCount: students.length,
      timestamp: trip.startTime,
    })

    res.status(201).json({ message: 'Trip started.', trip })
  })
)

// ── GET /api/trips/:id/students ───────────────────────────────────────────
// Polled by the driver app to pick up geofence-triggered alert state.
router.get(
  '/:id/students',
  asyncHandler(async (req, res) => {
    const trip = await loadOwnTrip(req)

    const tripStudents = await TripStudent.find({ tripId: trip._id })
      .populate('studentId', 'name')
      .select('studentId attending alertTriggered alertTimestamp manuallyResolved')
      .lean()

    const students = tripStudents.map((ts) => ({
      ...ts,
      studentId: String(ts.studentId?._id ?? ts.studentId),
      studentName: ts.studentId?.name,
    }))

    res.json({ students })
  })
)

// ── PATCH /api/trips/:id/students/:studentId/resolve ─────────────────────
router.patch(
  '/:id/students/:studentId/resolve',
  asyncHandler(async (req, res) => {
    const trip = await loadOwnTrip(req)

    const ts = await TripStudent.findOneAndUpdate(
      { tripId: trip._id, studentId: req.params.studentId },
      { manuallyResolved: true },
      { new: true }
    )
    if (!ts) throw new AppError('Student not on this trip.', 404)

    res.json({ message: 'Student marked as dropped off.', tripStudent: ts })
  })
)

// ── POST /api/trips/:id/end ───────────────────────────────────────────────
router.post(
  '/:id/end',
  asyncHandler(async (req, res) => {
    const trip = await loadOwnTrip(req)
    if (trip.status === 'Completed') throw new AppError('Trip is already completed.', 409)

    trip.status = 'Completed'
    trip.endTime = new Date()
    await trip.save()

    await Bus.findByIdAndUpdate(trip.busId, { status: 'Idle' })

    emitToAdmins('trip:ended', { tripId: trip._id, driverId: trip.driverUserId, timestamp: trip.endTime })

    res.json({ message: 'Trip ended.', trip })
  })
)

// ── POST /api/trips/ping ──────────────────────────────────────────────────
router.post(
  '/ping',
  pingLimiter,
  [
    body('tripId').isMongoId().withMessage('A valid tripId is required.'),
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be between -90 and 90.'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be between -180 and 180.'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { tripId, lat, lng, timestamp } = req.body

    const trip = await Trip.findById(tripId)
    if (!trip) throw new AppError('Trip not found.', 404)
    if (String(trip.driverUserId) !== String(req.user._id)) throw new AppError('Forbidden.', 403)
    if (trip.status !== 'Active') throw new AppError('Trip is not active.', 409)

    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)

    trip.lastKnownLocation = { lat: latNum, lng: lngNum, timestamp: new Date() }
    await trip.save()

    await runGeofenceCheck(trip, req.user._id, latNum, lngNum)

    emitToAdmins('trip:location', {
      tripId: trip._id,
      driverId: req.user._id,
      lat: latNum,
      lng: lngNum,
      timestamp: timestamp ?? new Date().toISOString(),
    })

    res.json({ ok: true, ts: timestamp ?? new Date().toISOString() })
  })
)

// ── POST /api/trips/:id/broadcast ─────────────────────────────────────────
router.post(
  '/:id/broadcast',
  [body('delayMinutes').isInt({ min: 1, max: 240 }).withMessage('delayMinutes must be a positive number.')],
  validate,
  asyncHandler(async (req, res) => {
    const trip = await loadOwnTrip(req)
    if (trip.status !== 'Active') throw new AppError('Trip is not active.', 409)

    const delayMinutes = parseInt(req.body.delayMinutes, 10)
    const { recipientCount, failed } = await sendDelayBroadcast(trip, delayMinutes, req.user._id)

    res.json({
      message: `Delay broadcast sent to ${recipientCount} parent(s).`,
      delayMinutes,
      recipientCount,
      failed,
    })
  })
)

module.exports = router
