'use strict'

/** Maps a handful of well-known Mongoose/Mongo error shapes to clean HTTP responses. */
function normalizeError(err) {
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(' ')
    return { statusCode: 400, message: message || 'Validation failed.' }
  }

  if (err.name === 'CastError') {
    return { statusCode: 400, message: `Invalid ${err.path}.` }
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field'
    return { statusCode: 409, message: `A record with this ${field} already exists.` }
  }

  return {
    statusCode: err.statusCode || err.status || 500,
    message: err.message || 'Internal server error',
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { statusCode, message } = normalizeError(err)

  if (statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err)
  }

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && { stack: err.stack }),
  })
}

function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` })
}

module.exports = { errorHandler, notFound }
