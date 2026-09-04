'use strict'

const mongoose = require('mongoose')
const { E164_REGEX } = require('../utils/phone')

// Temporary alternate contact a parent can register via IVR for a single
// day (e.g. a grandparent picking up instead). Expires automatically via
// the TTL index so it never silently lingers into another day.
const SecondaryReceiverSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    phone: { type: String, required: true, match: E164_REGEX },
    name: { type: String, trim: true, maxlength: 100, default: null },
    setByParentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

SecondaryReceiverSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
SecondaryReceiverSchema.index({ studentId: 1, expiresAt: 1 })

module.exports = mongoose.model('SecondaryReceiver', SecondaryReceiverSchema)
