'use strict'

const express = require('express')

const { handleInboundCall, handleDtmf, handleVoiceCallback } = require('../services/ivrService')
const { verifyIvrSignature } = require('../middleware/ivrSignature')
const { ivrLimiter } = require('../middleware/rateLimiters')
const asyncHandler = require('../utils/asyncHandler')

const router = express.Router()

/**
 * Every route here is a webhook Arkesel calls, not a browser/app client —
 * so instead of JWT auth it's protected by the shared-secret signature
 * check (`verifyIvrSignature`) and a looser rate limit sized for real call
 * volume, not per-user traffic.
 *
 * Field names below (`session_id`, `from`, `digits`, `call_id`, `status`)
 * are the conventional names this kind of webhook uses across telephony
 * providers, but Arkesel's exact payload could not be verified against
 * their live docs from this environment (see config/arkesel.js). `pick()`
 * defensively checks a few likely aliases; if Arkesel's actual field names
 * differ, this file — not the IVR logic in services/ivrService.js — is
 * where to correct them.
 */

function pick(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') return body[key]
  }
  return undefined
}

router.use(ivrLimiter, verifyIvrSignature)

// ── POST /api/ivr/inbound ─────────────────────────────────────────────────
router.post(
  '/inbound',
  asyncHandler(async (req, res) => {
    const sessionId = pick(req.body, ['session_id', 'sessionId', 'call_id', 'callId'])
    const callerNumber = pick(req.body, ['from', 'caller', 'msisdn', 'callerNumber'])

    if (!sessionId || !callerNumber) {
      return res.status(400).json({ say: 'Missing call session information.', hangup: true })
    }

    const response = await handleInboundCall({ sessionId: String(sessionId), callerNumber: String(callerNumber) })
    res.json(response)
  })
)

// ── POST /api/ivr/dtmf ────────────────────────────────────────────────────
router.post(
  '/dtmf',
  asyncHandler(async (req, res) => {
    const sessionId = pick(req.body, ['session_id', 'sessionId', 'call_id', 'callId'])
    const digits = pick(req.body, ['digits', 'dtmf', 'Digits'])

    if (!sessionId || digits === undefined) {
      return res.status(400).json({ say: 'Missing DTMF information.', hangup: true })
    }

    const response = await handleDtmf({ sessionId: String(sessionId), digits: String(digits) })
    res.json(response)
  })
)

// ── POST /api/ivr/voice-callback ──────────────────────────────────────────
// Outbound-call outcome callback (proximity alert / driver bridge calls).
router.post(
  '/voice-callback',
  asyncHandler(async (req, res) => {
    const callId = pick(req.body, ['call_id', 'callId', 'id'])
    const status = pick(req.body, ['status', 'call_status', 'event'])

    const result = await handleVoiceCallback({ callId: callId ? String(callId) : null, status })
    res.json({ ok: true, handled: result.handled })
  })
)

module.exports = router
