'use strict'

require('dotenv').config()

const http = require('http')
const { assertEnv } = require('./config/env')
const { connectDB } = require('./config/db')
const { initSocket } = require('./socket')

async function start() {
  assertEnv()

  const app = require('./app')
  const server = http.createServer(app)
  initSocket(server)

  await connectDB()

  const PORT = process.env.PORT || 5000
  server.listen(PORT, () => {
    console.log(`\n🚌 AwaBus API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
  })

  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully…`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err.message)
  process.exit(1)
})
