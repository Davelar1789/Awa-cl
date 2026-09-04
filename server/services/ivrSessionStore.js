'use strict'

/**
 * In-memory store for in-progress IVR call sessions, keyed by the
 * Arkesel-provided session/call id. A phone call is a short-lived,
 * multi-step conversation (inbound -> DTMF -> DTMF -> ...), so we need
 * *some* place to remember "who is this caller and what have they told us
 * so far" between webhook hits.
 *
 * Known limitation: this is process-local. It's correct for a single
 * server instance (the realistic deployment target here — Railway single
 * dyno). If AwaBus ever runs multiple API instances behind a load balancer,
 * back this with Redis (or a short-TTL Mongo collection) instead so any
 * instance can pick up the next DTMF webhook for a session.
 */

const SESSION_TTL_MS = 5 * 60 * 1000 // a phone call shouldn't idle longer than this
const sessions = new Map()

function create(sessionId, initial = {}) {
  const session = { createdAt: Date.now(), pinAttempts: 0, ...initial }
  sessions.set(sessionId, session)
  return session
}

function get(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return null
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId)
    return null
  }
  return session
}

function update(sessionId, patch) {
  const session = get(sessionId)
  if (!session) return null
  Object.assign(session, patch)
  sessions.set(sessionId, session)
  return session
}

function end(sessionId) {
  sessions.delete(sessionId)
}

// Periodic sweep so abandoned calls don't leak memory indefinitely.
const sweeper = setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id)
  }
}, 60 * 1000)
sweeper.unref?.()

module.exports = { create, get, update, end }
