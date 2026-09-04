'use strict'

const axios = require('axios')

/**
 * Arkesel API configuration.
 *
 * VERIFY BEFORE PRODUCTION: the SMS v2 endpoint/payload shape below matches
 * Arkesel's documented SMS API (`POST /sms/send`, `api-key` header). The
 * Voice and IVR-webhook shapes are best-effort based on the conventions
 * Arkesel's docs describe (developers.arkesel.com was unreachable from the
 * environment this was built in) — confirm field names against the current
 * Arkesel dashboard/docs for your account before flipping ARKESEL_MOCK_MODE
 * to false in production. Every call to Arkesel goes through the client
 * below so that's the only place a payload shape would need to change.
 */

const config = {
  apiKey: process.env.ARKESEL_API_KEY,
  senderId: process.env.ARKESEL_SENDER_ID || 'AwaBus',
  ivrNumber: process.env.ARKESEL_IVR_NUMBER,
  smsBaseUrl: process.env.ARKESEL_SMS_BASE_URL || 'https://sms.arkesel.com/api/v2',
  voiceBaseUrl: process.env.ARKESEL_VOICE_BASE_URL || 'https://sms.arkesel.com/api/v2/voice',
  webhookSecret: process.env.ARKESEL_WEBHOOK_SECRET,
  // Mock mode: log the outbound call instead of hitting the real API.
  // Defaults to true unless explicitly disabled — never guess-call a paid
  // API. Flip ARKESEL_MOCK_MODE=false once real credentials are in place.
  mockMode: process.env.ARKESEL_MOCK_MODE !== 'false',
}

const smsClient = axios.create({
  baseURL: config.smsBaseUrl,
  timeout: 10000,
  headers: { 'api-key': config.apiKey, 'Content-Type': 'application/json' },
})

const voiceClient = axios.create({
  baseURL: config.voiceBaseUrl,
  timeout: 10000,
  headers: { 'api-key': config.apiKey, 'Content-Type': 'application/json' },
})

module.exports = { config, smsClient, voiceClient }
