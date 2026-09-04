'use strict'

const AppError = require('../utils/AppError')

/** Usage: router.get('/...', protect, allow('admin'), handler) */
function allow(...roles) {
  return function checkRole(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(`Access denied. Required role: ${roles.join(' or ')}.`, 403))
    }
    next()
  }
}

module.exports = { allow }
