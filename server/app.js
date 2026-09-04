'use strict'

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const mongoSanitize = require('express-mongo-sanitize')
const hpp = require('hpp')

const { generalLimiter } = require('./middleware/rateLimiters')
const { errorHandler, notFound } = require('./middleware/errorHandler')

const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const busRoutes = require('./routes/buses')
const studentRoutes = require('./routes/students')
const driverRoutes = require('./routes/drivers')
const tripRoutes = require('./routes/trips')
const ivrRoutes = require('./routes/ivr')
const logRoutes = require('./routes/logs')
const dashboardRoutes = require('./routes/dashboard')

const app = express()

app.set('trust proxy', 1) // behind Railway/Vercel-style proxies — needed for correct req.ip in rate limiting

// ── Security & parsing ──────────────────────────────────────────────────
app.use(helmet())
app.use(
  cors({
    origin: process.env.CLIENT_WEB_URL || 'http://localhost:5173',
    credentials: true,
  })
)
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(mongoSanitize())
app.use(hpp())
app.use(generalLimiter)

// ── Logging (dev only) ──────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

// ── Health check ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/buses', busRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/trips', tripRoutes)
app.use('/api/ivr', ivrRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/dashboard', dashboardRoutes)

// ── 404 + error handling ────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

module.exports = app
