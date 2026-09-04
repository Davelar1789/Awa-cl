'use strict'

const express = require('express')
const { body, query } = require('express-validator')

const User = require('../models/User')
const Bus = require('../models/Bus')
const { protect } = require('../middleware/auth')
const { allow } = require('../middleware/rbac')
const validate = require('../middleware/validate')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const { E164_REGEX } = require('../utils/phone')

const router = express.Router()

router.use(protect, allow('admin'))

// ── GET /api/users ────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { role, status, search, page = 1, limit = 50 } = req.query

    const filter = {}
    if (role) filter.role = role
    if (status) filter.status = status
    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { phone: { $regex: escapeRegex(search), $options: 'i' } },
      ]
    }

    const skip = (page - 1) * limit
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .populate('assignedBusId', 'registrationNumber nickname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ])

    res.json({ users, total, page })
  })
)

// ── GET /api/users/:id ───────────────────────────────────────────────────
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).populate('assignedBusId', 'registrationNumber nickname')
    if (!user) throw new AppError('User not found.', 404)
    res.json({ user })
  })
)

// ── PUT /api/users/:id ────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('phone').optional().trim().matches(E164_REGEX).withMessage('Phone must be in E.164 format.'),
    body('role').optional().isIn(['admin', 'driver', 'parent']),
    body('status').optional().isIn(['active', 'suspended', 'deleted']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, phone, role, status } = req.body

    const user = await User.findById(req.params.id)
    if (!user) throw new AppError('User not found.', 404)

    if (name !== undefined) user.name = name
    if (phone !== undefined) user.phone = phone
    if (role !== undefined) user.role = role
    if (status !== undefined) user.status = status

    await user.save()
    res.json({ message: 'User updated.', user: user.toJSON() })
  })
)

// ── PATCH /api/users/:id/status ───────────────────────────────────────────
router.patch(
  '/:id/status',
  [body('status').isIn(['active', 'suspended']).withMessage('Status must be active or suspended.')],
  validate,
  asyncHandler(async (req, res) => {
    if (req.params.id === String(req.user._id) && req.body.status === 'suspended') {
      throw new AppError('You cannot suspend your own account.', 400)
    }

    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true })
    if (!user) throw new AppError('User not found.', 404)
    res.json({ message: `User ${req.body.status}.`, user: user.toJSON() })
  })
)

// ── DELETE /api/users/:id ─────────────────────────────────────────────────
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
    if (!user) throw new AppError('User not found.', 404)

    if (user._id.equals(req.user._id)) {
      throw new AppError('You cannot delete your own account.', 400)
    }

    // Soft delete — preserves trip/log history for anything referencing this user.
    user.status = 'deleted'
    await user.save({ validateBeforeSave: false })

    if (user.assignedBusId) {
      await Bus.findByIdAndUpdate(user.assignedBusId, { assignedDriverUserId: null })
      user.assignedBusId = null
      await user.save({ validateBeforeSave: false })
    }

    res.json({ message: 'User deleted.' })
  })
)

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = router
