'use strict'

const mongoose = require('mongoose')

const PasswordResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    otpHash: { type: String, required: true, select: false },
    // Set only after OTP verification succeeds; consumed by /reset-password.
    resetTokenHash: { type: String, default: null, select: false },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    otpAttempts: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

// TTL index — documents vanish automatically once the reset window closes.
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
PasswordResetSchema.index({ userId: 1, used: 1 })

module.exports = mongoose.model('PasswordReset', PasswordResetSchema)
