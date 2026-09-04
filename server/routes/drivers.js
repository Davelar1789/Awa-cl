'use strict'

const express = require('express')

const Bus = require('../models/Bus')
const Student = require('../models/Student')
const Trip = require('../models/Trip')
const { protect } = require('../middleware/auth')
const { allow } = require('../middleware/rbac')
const asyncHandler = require('../utils/asyncHandler')
const { startOfGhanaDay } = require('../utils/time')

const router = express.Router()

router.use(protect, allow('driver'))

// ── GET /api/drivers/me/route ─────────────────────────────────────────────
// The payload the driver app's dashboard renders on load: the driver's
// assigned bus, their active student roster, and any trip already in
// progress (so the app can resume after a crash/restart instead of
// silently losing an active trip).
router.get(
  '/me/route',
  asyncHandler(async (req, res) => {
    const driverId = req.user._id

    const [bus, students, activeTrip] = await Promise.all([
      Bus.findOne({ assignedDriverUserId: driverId }),
      Student.find({ driverUserId: driverId, active: true }).select(
        'name homeLatitude homeLongitude geofenceRadius parentUserId'
      ),
      Trip.findOne({ driverUserId: driverId, status: 'Active' }),
    ])

    res.json({
      bus: bus ?? null,
      students,
      activeTrip: activeTrip ?? null,
      today: startOfGhanaDay().toISOString(),
    })
  })
)

module.exports = router
