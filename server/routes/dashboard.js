'use strict'

const express = require('express')

const Bus = require('../models/Bus')
const Student = require('../models/Student')
const User = require('../models/User')
const Trip = require('../models/Trip')
const CommunicationLog = require('../models/CommunicationLog')
const { protect } = require('../middleware/auth')
const { allow } = require('../middleware/rbac')
const asyncHandler = require('../utils/asyncHandler')
const { startOfGhanaDay } = require('../utils/time')

const router = express.Router()

router.use(protect, allow('admin'))

// ── GET /api/dashboard/stats ──────────────────────────────────────────────
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const todayStart = startOfGhanaDay()

    const [
      totalBuses,
      activeTrips,
      totalStudents,
      totalUsers,
      alertsToday,
      smsToday,
      failedToday,
    ] = await Promise.all([
      Bus.countDocuments({}),
      Trip.countDocuments({ status: 'Active' }),
      Student.countDocuments({ active: true }),
      User.countDocuments({ status: { $ne: 'deleted' } }),
      CommunicationLog.countDocuments({
        type: 'proximity_alert',
        channel: 'voice',
        timestamp: { $gte: todayStart },
      }),
      CommunicationLog.countDocuments({
        channel: 'sms',
        timestamp: { $gte: todayStart },
      }),
      CommunicationLog.countDocuments({ status: 'failed', timestamp: { $gte: todayStart } }),
    ])

    res.json({
      totalBuses,
      activeTrips,
      totalStudents,
      totalUsers,
      alertsToday,
      smsToday,
      failedToday,
    })
  })
)

module.exports = router
