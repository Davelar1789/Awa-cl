'use strict'

const mongoose = require('mongoose')

mongoose.set('strictQuery', true)

async function connectDB() {
  const uri = process.env.MONGO_URI
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    })
    console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`)
    return conn
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message)
    throw err
  }
}

async function disconnectDB() {
  await mongoose.disconnect()
}

module.exports = { connectDB, disconnectDB }
