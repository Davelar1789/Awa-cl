'use strict'

const { verifyToken } = require('../utils/jwt')
const User = require('../models/User')
const AppError = require('../utils/AppError')
const asyncHandler = require('../utils/asyncHandler')

/** Requires a valid Bearer JWT for an active user; attaches `req.user`. */
const protect = asyncHandler(async function protect(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('No token provided. Please sign in.', 401)
  }

  const token = header.slice(7).trim()
  if (!token) throw new AppError('No token provided. Please sign in.', 401)

  let decoded
  try {
    decoded = verifyToken(token)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Session expired. Please sign in again.', 401)
    }
    throw new AppError('Invalid token.', 401)
  }

  const user = await User.findById(decoded.id).select('+passwordChangedAt')
  if (!user) throw new AppError('User no longer exists.', 401)
  if (user.status !== 'active') throw new AppError('Account is suspended or deleted.', 401)

  // Invalidate tokens issued before the most recent password change.
  if (user.passwordChangedAt) {
    const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000)
    if (decoded.iat < changedAtSeconds) {
      throw new AppError('Password was recently changed. Please sign in again.', 401)
    }
  }

  req.user = user
  next()
})

module.exports = { protect }
