'use strict'

const express = require('express')

const CommunicationLog = require('../models/CommunicationLog')
const { protect } = require('../middleware/auth')
const { allow } = require('../middleware/rbac')
const asyncHandler = require('../utils/asyncHandler')

const router = express.Router()

router.use(protect, allow('admin'))

// ── GET /api/logs ──────────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type, status, channel, search, from, to, page = 1, limit = 30 } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 30))

    const filter = {}
    if (type) filter.type = type
    if (status) filter.status = status
    if (channel) filter.channel = channel
    if (search) filter.recipientPhone = { $regex: escapeRegex(search), $options: 'i' }
    if (from || to) {
      filter.timestamp = {}
      if (from) filter.timestamp.$gte = new Date(from)
      if (to) filter.timestamp.$lte = new Date(to)
    }

    const skip = (pageNum - 1) * limitNum
    const [total, logs] = await Promise.all([
      CommunicationLog.countDocuments(filter),
      CommunicationLog.find(filter)
        .populate('studentId', 'name')
        .populate('driverId', 'name')
        .populate('parentUserId', 'name phone')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum),
    ])

    res.json({ logs, total, page: pageNum })
  })
)

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = router
