'use strict'

const express = require('express')
const { body } = require('express-validator')

const Bus = require('../models/Bus')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { allow } = require('../middleware/rbac')
const validate = require('../middleware/validate')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')

const router = express.Router()

router.use(protect, allow('admin'))

// ── GET /api/buses ────────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, status, page = 1, limit = 50 } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50))

    const filter = {}
    if (status) filter.status = status
    if (search) {
      filter.$or = [
        { registrationNumber: { $regex: escapeRegex(search), $options: 'i' } },
        { nickname: { $regex: escapeRegex(search), $options: 'i' } },
      ]
    }

    const skip = (pageNum - 1) * limitNum
    const [total, buses] = await Promise.all([
      Bus.countDocuments(filter),
      Bus.find(filter)
        .populate('assignedDriverUserId', 'name phone status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ])

    res.json({ buses, total, page: pageNum })
  })
)

// ── GET /api/buses/:id ────────────────────────────────────────────────────
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const bus = await Bus.findById(req.params.id).populate('assignedDriverUserId', 'name phone status')
    if (!bus) throw new AppError('Bus not found.', 404)
    res.json({ bus })
  })
)

// ── POST /api/buses ───────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('registrationNumber').trim().notEmpty().withMessage('Registration number is required.').isLength({ max: 20 }),
    body('nickname').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
    body('capacity').optional({ values: 'falsy' }).isInt({ min: 1, max: 200 }).toInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { registrationNumber, nickname, capacity, status } = req.body

    const bus = await Bus.create({
      registrationNumber: registrationNumber.toUpperCase(),
      nickname: nickname || null,
      capacity: capacity || null,
      status: status === 'Maintenance' ? 'Maintenance' : 'Idle',
    })

    res.status(201).json({ message: 'Bus created.', bus })
  })
)

// ── PUT /api/buses/:id ────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    body('registrationNumber').optional().trim().isLength({ min: 1, max: 20 }),
    body('nickname').optional({ nullable: true }).trim().isLength({ max: 60 }),
    body('capacity').optional({ nullable: true }).isInt({ min: 1, max: 200 }).toInt(),
    body('status').optional().isIn(['Idle', 'Maintenance']).withMessage('Active Trip status is set by the system only.'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { registrationNumber, nickname, capacity, status } = req.body

    const bus = await Bus.findById(req.params.id)
    if (!bus) throw new AppError('Bus not found.', 404)

    if (bus.status === 'Active Trip' && status) {
      throw new AppError('Cannot change status while a trip is active.', 400)
    }

    if (registrationNumber !== undefined) bus.registrationNumber = registrationNumber.toUpperCase()
    if (nickname !== undefined) bus.nickname = nickname || null
    if (capacity !== undefined) bus.capacity = capacity || null
    if (status !== undefined) bus.status = status

    await bus.save()
    res.json({ message: 'Bus updated.', bus })
  })
)

// ── PATCH /api/buses/:id/assign-driver ────────────────────────────────────
router.patch(
  '/:id/assign-driver',
  [body('driverUserId').optional({ nullable: true }).isMongoId().withMessage('Invalid driver id.')],
  validate,
  asyncHandler(async (req, res) => {
    const { driverUserId } = req.body
    const bus = await Bus.findById(req.params.id)
    if (!bus) throw new AppError('Bus not found.', 404)

    if (bus.assignedDriverUserId && String(bus.assignedDriverUserId) !== String(driverUserId || '')) {
      await User.findByIdAndUpdate(bus.assignedDriverUserId, { assignedBusId: null })
    }

    if (driverUserId) {
      const driver = await User.findById(driverUserId)
      if (!driver || driver.role !== 'driver') throw new AppError('User not found or is not a driver.', 400)
      if (driver.status !== 'active') throw new AppError('Cannot assign a suspended driver.', 400)

      if (driver.assignedBusId && String(driver.assignedBusId) !== String(bus._id)) {
        await Bus.findByIdAndUpdate(driver.assignedBusId, { assignedDriverUserId: null })
      }

      bus.assignedDriverUserId = driverUserId
      await bus.save()
      await User.findByIdAndUpdate(driverUserId, { assignedBusId: bus._id })
    } else {
      bus.assignedDriverUserId = null
      await bus.save()
    }

    const updated = await Bus.findById(bus._id).populate('assignedDriverUserId', 'name phone status')
    res.json({ message: 'Driver assignment updated.', bus: updated })
  })
)

// ── DELETE /api/buses/:id ─────────────────────────────────────────────────
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const bus = await Bus.findById(req.params.id)
    if (!bus) throw new AppError('Bus not found.', 404)

    if (bus.status === 'Active Trip') throw new AppError('Cannot delete a bus on an active trip.', 400)
    if (bus.assignedDriverUserId) throw new AppError('Unassign the driver before deleting this bus.', 400)

    await bus.deleteOne()
    res.json({ message: 'Bus deleted.' })
  })
)

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = router
