'use strict'

const { config, smsClient, voiceClient } = require('../config/arkesel')
const CommunicationLog = require('../models/CommunicationLog')

/**
 * Thin wrapper around the Arkesel SMS + Voice APIs. Every outbound call/SMS
 * in the app goes through this module so the (currently best-effort, see
 * config/arkesel.js) request shape only needs correcting in one place.
 */

async function sendSms(phone, message) {
  if (config.mockMode) {
    console.log(`[Arkesel:mock SMS] -> ${phone}: ${message}`)
    return { ok: true, mock: true, responseCode: 'mock-000' }
  }

  try {
    const { data } = await smsClient.post('/sms/send', {
      sender: config.senderId,
      message,
      recipients: [phone],
    })
    return { ok: true, responseCode: data?.code ?? null, raw: data }
  } catch (err) {
    return { ok: false, error: err.response?.data?.message || err.message }
  }
}

async function sendVoiceCall(phone, message) {
  if (config.mockMode) {
    console.log(`[Arkesel:mock VOICE] -> ${phone}: "${message}"`)
    return { ok: true, mock: true, callId: `mock-call-${Date.now()}` }
  }

  try {
    const { data } = await voiceClient.post('/send', {
      from: config.ivrNumber,
      to: phone,
      message,
    })
    return { ok: true, callId: data?.call_id ?? data?.id ?? null, raw: data }
  } catch (err) {
    return { ok: false, error: err.response?.data?.message || err.message }
  }
}

/**
 * Bridges an in-progress IVR call leg to the driver's phone number.
 * Returns the same shape as sendVoiceCall — `ok: false` means the driver
 * could not be reached and the caller should play the fallback message.
 */
async function bridgeCallToDriver(callSessionId, driverPhone) {
  if (config.mockMode) {
    console.log(`[Arkesel:mock BRIDGE] session ${callSessionId} -> driver ${driverPhone}`)
    return { ok: true, mock: true }
  }

  try {
    const { data } = await voiceClient.post('/bridge', {
      session_id: callSessionId,
      to: driverPhone,
      timeout: 30,
    })
    return { ok: true, raw: data }
  } catch (err) {
    return { ok: false, error: err.response?.data?.message || err.message }
  }
}

/**
 * Fires the core AwaBus alert: a voice call to the parent, falling back to
 * SMS automatically if the call fails. Every attempt — success or failure —
 * is written to the append-only CommunicationLog.
 */
async function triggerProximityAlert({ tripStudentId, tripId, studentId, driverId, parent, studentName, distanceMetres }) {
  const voiceMessage = `AwaBus alert: the school bus is approaching ${studentName}'s stop.`
  const voiceResult = await sendVoiceCall(parent.phone, voiceMessage)

  await CommunicationLog.create({
    tripStudentId,
    tripId,
    studentId,
    driverId,
    parentUserId: parent._id,
    type: 'proximity_alert',
    channel: 'voice',
    status: voiceResult.ok ? 'sent' : 'failed',
    recipientPhone: parent.phone,
    message: voiceMessage,
    arkeselCallId: voiceResult.callId ?? null,
    failureReason: voiceResult.ok ? null : voiceResult.error,
  })

  if (voiceResult.ok) return { channel: 'voice', ok: true }

  // Voice failed — fall back to SMS immediately.
  const smsMessage = `AwaBus: the school bus is near ${studentName}'s stop (${Math.round(distanceMetres)}m away). Please be ready.`
  const smsResult = await sendSms(parent.phone, smsMessage)

  await CommunicationLog.create({
    tripStudentId,
    tripId,
    studentId,
    driverId,
    parentUserId: parent._id,
    type: 'sms_fallback',
    channel: 'sms',
    status: smsResult.ok ? 'sent' : 'failed',
    recipientPhone: parent.phone,
    message: smsMessage,
    arkeselResponseCode: smsResult.responseCode ?? null,
    failureReason: smsResult.ok ? null : smsResult.error,
  })

  return { channel: 'sms', ok: smsResult.ok }
}

module.exports = {
  sendSms,
  sendVoiceCall,
  bridgeCallToDriver,
  triggerProximityAlert,
}
