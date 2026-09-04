'use strict'

const mongoose = require('mongoose')

// Append-only login / IVR-PIN attempt audit trail — never mutated.
const AuthLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    phone: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    channel: { type: String, enum: ['web', 'driver_app', 'ivr'], required: true },
    success: { type: Boolean, required: true },
    reason: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

AuthLogSchema.index({ timestamp: -1 })

module.exports = mongoose.model('AuthLog', AuthLogSchema)
