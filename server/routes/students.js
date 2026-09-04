'use strict'

const express = require('express')
const { body } = require('express-validator')

const Student = require('../models/Student')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { allow } = require('../middleware/rbac')
const validate = require('../middleware/validate')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')

const router = express.Router()

router.use(protect, allow('admin'))

// ── GET /api/students ─────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, driverUserId, active, page = 1, limit = 50 } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50))

    const filter = {}
    if (active !== undefined) filter.active = active === 'true'
    if (driverUserId) filter.driverUserId = driverUserId
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }

    const skip = (pageNum - 1) * limitNum
    const [total, students] = await Promise.all([
      Student.countDocuments(filter),
      Student.find(filter)
        .populate('parentUserId', 'name phone')
        .populate('driverUserId', 'name phone')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum),
    ])

    res.json({ students, total, page: pageNum })
  })
)

// ── GET /api/students/:id ─────────────────────────────────────────────────
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id)
      .populate('parentUserId', 'name phone')
      .populate('driverUserId', 'name phone')
    if (!student) throw new AppError('Student not found.', 404)
    res.json({ student })
  })
)

const coordValidators = [
  body('homeLatitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90.'),
  body('homeLongitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180.'),
  body('geofenceRadius')
    .optional()
    .isInt({ min: 100, max: 2000 })
    .withMessage('Geofence radius must be between 100m and 2000m.'),
]

// ── POST /api/students ────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Student name is required.').isLength({ max: 100 }),
    body('parentUserId').isMongoId().withMessage('A valid parent is required.'),
    body('driverUserId').isMongoId().withMessage('A valid driver is required.'),
    ...coordValidators,
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, parentUserId, driverUserId, homeLatitude, homeLongitude, geofenceRadius } = req.body

    const [parent, driver] = await Promise.all([User.findById(parentUserId), User.findById(driverUserId)])
    if (!parent || parent.role !== 'parent') throw new AppError('Invalid parent — user not found or not a parent.', 400)
    if (!driver || driver.role !== 'driver') throw new AppError('Invalid driver — user not found or not a driver.', 400)

    const student = await Student.create({
      name,
      parentUserId,
      driverUserId,
      homeLatitude: parseFloat(homeLatitude),
      homeLongitude: parseFloat(homeLongitude),
      geofenceRadius: geofenceRadius ? parseInt(geofenceRadius, 10) : 500,
    })

    const populated = await Student.findById(student._id)
      .populate('parentUserId', 'name phone')
      .populate('driverUserId', 'name phone')

    res.status(201).json({ message: 'Student created.', student: populated })
  })
)

// ── PUT /api/students/:id ─────────────────────────────────────────────────
router.put(
  '/:id',
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('parentUserId').optional().isMongoId(),
    body('driverUserId').optional().isMongoId(),
    body('homeLatitude').optional().isFloat({ min: -90, max: 90 }),
    body('homeLongitude').optional().isFloat({ min: -180, max: 180 }),
    body('geofenceRadius').optional().isInt({ min: 100, max: 2000 }),
    body('active').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, parentUserId, driverUserId, homeLatitude, homeLongitude, geofenceRadius, active } = req.body

    const student = await Student.findById(req.params.id)
    if (!student) throw new AppError('Student not found.', 404)

    if (name !== undefined) student.name = name
    if (active !== undefined) student.active = active

    if (parentUserId !== undefined) {
      const parent = await User.findById(parentUserId)
      if (!parent || parent.role !== 'parent') throw new AppError('Invalid parent.', 400)
      student.parentUserId = parentUserId
    }

    if (driverUserId !== undefined) {
      const driver = await User.findById(driverUserId)
      if (!driver || driver.role !== 'driver') throw new AppError('Invalid driver.', 400)
      student.driverUserId = driverUserId
    }

    if (homeLatitude !== undefined) student.homeLatitude = parseFloat(homeLatitude)
    if (homeLongitude !== undefined) student.homeLongitude = parseFloat(homeLongitude)
    if (geofenceRadius !== undefined) student.geofenceRadius = parseInt(geofenceRadius, 10)

    await student.save()

    const populated = await Student.findById(student._id)
      .populate('parentUserId', 'name phone')
      .populate('driverUserId', 'name phone')

    res.json({ message: 'Student updated.', student: populated })
  })
)

// ── DELETE /api/students/:id ──────────────────────────────────────────────
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id)
    if (!student) throw new AppError('Student not found.', 404)

    // Soft delete — keeps trip/communication history intact.
    student.active = false
    await student.save()

    res.json({ message: 'Student removed.' })
  })
)

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = router
