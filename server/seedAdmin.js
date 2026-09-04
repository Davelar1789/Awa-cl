#!/usr/bin/env node
'use strict'

/**
 * Creates (or updates) the first admin account.
 *
 * Usage:
 *   node seedAdmin.js
 *
 * Reads MONGO_URI from .env (never hardcode credentials in this file — the
 * previous version of this script had a live database password committed
 * to git history, which is exactly the mistake this guards against).
 *
 * Admin identity/password can be overridden via env vars so this stays
 * usable in CI/staging without editing the file:
 *   SEED_ADMIN_NAME, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD
 */

require('dotenv').config()

const mongoose = require('mongoose')
const crypto = require('crypto')
const { connectDB, disconnectDB } = require('./config/db')
const User = require('./models/User')

const ADMIN = {
  name: process.env.SEED_ADMIN_NAME || 'AwaBus Admin',
  phone: process.env.SEED_ADMIN_PHONE || '+233557625112',
  password: process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url'),
}

async function seed() {
  await connectDB()

  try {
    const existing = await User.findOne({ phone: ADMIN.phone })
    if (existing) {
      console.log(`ℹ️  Admin with phone ${ADMIN.phone} already exists (id: ${existing._id}). No changes made.`)
      return
    }

    const admin = await User.create({
      name: ADMIN.name,
      phone: ADMIN.phone,
      role: 'admin',
      status: 'active',
      passwordHash: ADMIN.password,
      mustChangePassword: true,
    })

    console.log('🎉 Admin account created successfully!')
    console.log(`   Name     : ${admin.name}`)
    console.log(`   Phone    : ${admin.phone}`)
    console.log(`   Password : ${ADMIN.password}`)
    console.log('   (Save this password now — it is not stored anywhere in plaintext. The admin will be prompted to change it on first login.)')
  } finally {
    await disconnectDB()
  }
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message)
  mongoose.disconnect().finally(() => process.exit(1))
})
