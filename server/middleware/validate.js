'use strict'

const { validationResult } = require('express-validator')
const AppError = require('../utils/AppError')

/** Run after an express-validator chain; turns the first failure into a 400. */
function validate(req, res, next) {
  const errors = validationResult(req)
  if (errors.isEmpty()) return next()
  const first = errors.array({ onlyFirstError: true })[0]
  next(new AppError(first.msg, 400))
}

module.exports = validate
