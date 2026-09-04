'use strict'

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { E164_REGEX } = require('../utils/phone')

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      unique: true,
      trim: true,
      match: [E164_REGEX, 'Phone must be in E.164 format, e.g. +233201234567'],
    },
    // bcrypt hash — set for admin & driver only (web/app login).
    passwordHash: {
      type: String,
      select: false,
    },
    // bcrypt hash of a 4-digit PIN — set for parents only (IVR auth).
    ivrPinHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'driver', 'parent'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    // Drivers only — kept in sync with Bus.assignedDriverUserId.
    assignedBusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      default: null,
    },
    loginAttempts: { type: Number, default: 0, select: false },
    lockoutUntil: { type: Date, default: null, select: false },
    passwordChangedAt: { type: Date, select: false },
  },
  { timestamps: true }
)

UserSchema.index({ role: 1 })
UserSchema.index({ status: 1 })
UserSchema.index({ name: 'text', phone: 'text' })

const PASSWORD_SALT_ROUNDS = 12
const PIN_SALT_ROUNDS = 10

UserSchema.pre('save', async function hashSecrets(next) {
  try {
    if (this.isModified('passwordHash') && this.passwordHash) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, PASSWORD_SALT_ROUNDS)
      if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000)
    }
    if (this.isModified('ivrPinHash') && this.ivrPinHash) {
      this.ivrPinHash = await bcrypt.hash(this.ivrPinHash, PIN_SALT_ROUNDS)
    }
    next()
  } catch (err) {
    next(err)
  }
})

UserSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false)
  return bcrypt.compare(plain, this.passwordHash)
}

UserSchema.methods.comparePin = function comparePin(plain) {
  if (!this.ivrPinHash) return Promise.resolve(false)
  return bcrypt.compare(plain, this.ivrPinHash)
}

UserSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject()
  delete obj.passwordHash
  delete obj.ivrPinHash
  delete obj.loginAttempts
  delete obj.lockoutUntil
  delete obj.__v
  return obj
}

module.exports = mongoose.model('User', UserSchema)
