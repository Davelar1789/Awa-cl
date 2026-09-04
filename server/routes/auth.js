'use strict'

const express = require('express')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { body } = require('express-validator')

const User = require('../models/User')
const PasswordReset = require('../models/PasswordReset')
const AuthLog = require('../models/AuthLog')
const { signToken } = require('../utils/jwt')
const { E164_REGEX } = require('../utils/phone')
const { generateOtp } = require('../utils/otp')
const { protect } = require('../middleware/auth')
const { allow } = require('../middleware/rbac')
const validate = require('../middleware/validate')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const { sendSms } = require('../services/communicationEngine')
const {
  loginLimiter,
  refreshLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} = require('../middleware/rateLimiters')

const router = express.Router()

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5
const LOCKOUT_THRESHOLD = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

// ── POST /api/auth/login ────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  [
    body('phone').trim().matches(E164_REGEX).withMessage('A valid phone number is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body
    const ip = req.ip
    const userAgent = req.headers['user-agent'] || null

    const user = await User.findOne({ phone }).select(
      '+passwordHash +loginAttempts +lockoutUntil +passwordChangedAt'
    )

    const logFailure = async (userId, reason) => {
      await AuthLog.create({ userId, phone, ip, userAgent, channel: 'web', success: false, reason })
    }

    // Only admins and drivers authenticate with a password (web/app login).
    if (!user || !['admin', 'driver'].includes(user.role)) {
      await logFailure(user?._id ?? null, 'not_found_or_wrong_channel')
      throw new AppError('Invalid phone or password.', 401)
    }

    if (user.status === 'suspended') {
      await logFailure(user._id, 'suspended')
      throw new AppError('Account suspended. Contact your administrator.', 401)
    }
    if (user.status === 'deleted') {
      await logFailure(user._id, 'deleted')
      throw new AppError('Invalid phone or password.', 401)
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const mins = Math.ceil((user.lockoutUntil - new Date()) / 60000)
      await logFailure(user._id, 'locked_out')
      throw new AppError(`Account locked. Try again in ${mins} minute(s).`, 401)
    }

    const valid = await user.comparePassword(password)
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1
      if (user.loginAttempts >= LOCKOUT_THRESHOLD) {
        user.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS)
        user.loginAttempts = 0
      }
      await user.save({ validateBeforeSave: false })
      await logFailure(user._id, 'wrong_password')
      throw new AppError('Invalid phone or password.', 401)
    }

    user.loginAttempts = 0
    user.lockoutUntil = null
    await user.save({ validateBeforeSave: false })

    await AuthLog.create({ userId: user._id, phone, ip, userAgent, channel: 'web', success: true })

    const token = signToken(user._id)
    res.json({ token, user: user.toJSON() })
  })
)

// ── POST /api/auth/register ── (admin only) ─────────────────────────────
router.post(
  '/register',
  protect,
  allow('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 100 }),
    body('phone').trim().matches(E164_REGEX).withMessage('Phone must be in E.164 format, e.g. +233201234567.'),
    body('role').isIn(['admin', 'driver', 'parent']).withMessage('Role must be admin, driver, or parent.'),
    body('password')
      .if(body('role').isIn(['admin', 'driver']))
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters for admin/driver accounts.'),
    body('ivrPin')
      .if(body('role').equals('parent'))
      .matches(/^\d{4}$/)
      .withMessage('IVR PIN must be exactly 4 digits.'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, phone, role, password, ivrPin, status } = req.body

    const existing = await User.findOne({ phone })
    if (existing) throw new AppError('A user with this phone number already exists.', 409)

    const user = await User.create({
      name: name.trim(),
      phone,
      role,
      status: status && ['active', 'suspended'].includes(status) ? status : 'active',
      passwordHash: password || undefined,
      ivrPinHash: ivrPin || undefined,
      mustChangePassword: true,
    })

    res.status(201).json({ message: 'User created.', user: user.toJSON() })
  })
)

// ── GET /api/auth/me ─────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user })
})

// ── POST /api/auth/refresh ── (sliding session) ──────────────────────────
router.post(
  '/refresh',
  protect,
  refreshLimiter,
  asyncHandler(async (req, res) => {
    const token = signToken(req.user._id)
    res.json({ token, user: req.user })
  })
)

// ── POST /api/auth/forgot-password ── (admin/driver web accounts only) ──
router.post(
  '/forgot-password',
  otpRequestLimiter,
  [body('phone').trim().matches(E164_REGEX).withMessage('A valid phone number is required.')],
  validate,
  asyncHandler(async (req, res) => {
    const { phone } = req.body
    const user = await User.findOne({ phone, role: { $in: ['admin', 'driver'] }, status: 'active' })

    // Always respond the same way — don't leak whether the number is registered.
    const genericResponse = { message: 'If that number is registered, an OTP has been sent via SMS.' }

    if (!user) return res.json(genericResponse)

    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)

    await PasswordReset.create({
      userId: user._id,
      otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    })

    await sendSms(user.phone, `Your AwaBus password reset code is ${otp}. It expires in 5 minutes.`)

    res.json(genericResponse)
  })
)

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────
router.post(
  '/verify-otp',
  otpVerifyLimiter,
  [
    body('phone').trim().matches(E164_REGEX).withMessage('A valid phone number is required.'),
    body('otp').matches(/^\d{6}$/).withMessage('OTP must be 6 digits.'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { phone, otp } = req.body
    const user = await User.findOne({ phone, role: { $in: ['admin', 'driver'] } })
    if (!user) throw new AppError('Invalid or expired code.', 400)

    const reset = await PasswordReset.findOne({ userId: user._id, used: false })
      .sort({ timestamp: -1 })
      .select('+otpHash +resetTokenHash')

    if (!reset || reset.expiresAt < new Date()) {
      throw new AppError('Invalid or expired code.', 400)
    }

    if (reset.otpAttempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError('Too many incorrect attempts. Request a new code.', 400)
    }

    const valid = await bcrypt.compare(otp, reset.otpHash)
    if (!valid) {
      reset.otpAttempts += 1
      await reset.save()
      throw new AppError('Invalid or expired code.', 400)
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    reset.resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
    await reset.save()

    res.json({ resetToken })
  })
)

// ── POST /api/auth/reset-password ─────────────────────────────────────────
router.post(
  '/reset-password',
  otpVerifyLimiter,
  [
    body('phone').trim().matches(E164_REGEX).withMessage('A valid phone number is required.'),
    body('resetToken').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid reset token.'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { phone, resetToken, newPassword } = req.body
    const user = await User.findOne({ phone, role: { $in: ['admin', 'driver'] } })
    if (!user) throw new AppError('Invalid or expired reset token.', 400)

    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
    const reset = await PasswordReset.findOne({
      userId: user._id,
      used: false,
      resetTokenHash: tokenHash,
    }).select('+resetTokenHash')

    if (!reset || reset.expiresAt < new Date()) {
      throw new AppError('Invalid or expired reset token.', 400)
    }

    user.passwordHash = newPassword
    user.mustChangePassword = false
    user.loginAttempts = 0
    user.lockoutUntil = null
    await user.save()

    reset.used = true
    await reset.save()

    res.json({ message: 'Password reset successfully. Please sign in.' })
  })
)

module.exports = router
