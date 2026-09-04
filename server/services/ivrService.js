'use strict'

const User = require('../models/User')
const Student = require('../models/Student')
const DailyAttendance = require('../models/DailyAttendance')
const CommunicationLog = require('../models/CommunicationLog')
const AuthLog = require('../models/AuthLog')
const { isValidE164, normalizeGhanaPhone } = require('../utils/phone')
const { isPastAttendanceCutoff, startOfGhanaDay } = require('../utils/time')
const { bridgeCallToDriver, sendSms } = require('./communicationEngine')
const sessions = require('./ivrSessionStore')
const { emitToDriver } = require('../socket')

const MAX_PIN_ATTEMPTS = 3

/**
 * The response contract every function below returns:
 *   { say: string, gather?: { numDigits?: number, finishOnKey?: string }, hangup?: boolean }
 *
 * This is an internal, Arkesel-agnostic shape. routes/ivr.js is the single
 * place that would translate it into whatever XML/JSON Arkesel's Voice API
 * actually expects for a "say + collect digits" response — isolating that
 * translation there means correcting it against real docs later touches
 * one file, not this whole service.
 */

// ── Inbound call ────────────────────────────────────────────────────────

async function handleInboundCall({ sessionId, callerNumber }) {
  const normalized = normalizeGhanaPhone(callerNumber)
  const parent = isValidE164(normalized)
    ? await User.findOne({ phone: normalized, role: 'parent', status: 'active' })
    : null

  if (!parent) {
    sessions.create(sessionId, { state: 'AWAIT_PHONE_ENTRY', callerNumber: normalized })
    return {
      say: 'Welcome to AwaBus. We could not recognise this number. Please enter your registered phone number, then press hash.',
      gather: { finishOnKey: '#' },
    }
  }

  return greetAndListStudents(sessionId, parent)
}

async function greetAndListStudents(sessionId, parent) {
  const students = await Student.find({ parentUserId: parent._id, active: true }).select('name')

  if (!students.length) {
    sessions.end(sessionId)
    return { say: 'We could not find any students registered to your account. Goodbye.', hangup: true }
  }

  if (students.length === 1) {
    sessions.create(sessionId, {
      state: 'AWAIT_MENU_SELECT',
      parentUserId: parent._id,
      studentId: students[0]._id,
    })
    return mainMenuPrompt(students[0].name)
  }

  sessions.create(sessionId, {
    state: 'AWAIT_STUDENT_SELECT',
    parentUserId: parent._id,
    candidateStudents: students.slice(0, 9).map((s) => ({ id: String(s._id), name: s.name })),
  })

  const options = students
    .slice(0, 9)
    .map((s, i) => `press ${i + 1} for ${s.name}`)
    .join(', ')

  return { say: `Welcome to AwaBus. ${options}.`, gather: { numDigits: 1 } }
}

function mainMenuPrompt(studentName) {
  return {
    say: `Hello. This is regarding ${studentName}. Press 1 to cancel today's pickup. Press 2 to speak with the driver.`,
    gather: { numDigits: 1 },
  }
}

// ── DTMF routing ────────────────────────────────────────────────────────

async function handleDtmf({ sessionId, digits }) {
  const session = sessions.get(sessionId)
  if (!session) {
    return { say: 'This session has expired. Please call again.', hangup: true }
  }

  switch (session.state) {
    case 'AWAIT_PHONE_ENTRY':
      return handlePhoneEntry(sessionId, session, digits)
    case 'AWAIT_PIN_ENTRY':
      return handlePinEntry(sessionId, session, digits)
    case 'AWAIT_STUDENT_SELECT':
      return handleStudentSelect(sessionId, session, digits)
    case 'AWAIT_MENU_SELECT':
      return handleMenuSelect(sessionId, session, digits)
    default:
      sessions.end(sessionId)
      return { say: 'Something went wrong. Please call again.', hangup: true }
  }
}

async function handlePhoneEntry(sessionId, session, digits) {
  const entered = normalizeGhanaPhone(String(digits).trim())
  if (!isValidE164(entered)) {
    return {
      say: 'That does not look like a valid phone number. Please enter your registered phone number, then press hash.',
      gather: { finishOnKey: '#' },
    }
  }

  const parent = await User.findOne({ phone: entered, role: 'parent', status: 'active' })
  if (!parent) {
    await AuthLog.create({ phone: entered, channel: 'ivr', success: false, reason: 'unrecognised_phone' })
    sessions.end(sessionId)
    return { say: 'We could not find an account with that phone number. Goodbye.', hangup: true }
  }

  sessions.update(sessionId, { state: 'AWAIT_PIN_ENTRY', enteredPhone: entered, matchedUserId: parent._id })
  return { say: 'Please enter your 4-digit PIN.', gather: { numDigits: 4 } }
}

async function handlePinEntry(sessionId, session, digits) {
  const parent = await User.findById(session.matchedUserId).select('+ivrPinHash')
  const pin = String(digits).trim()
  const valid = parent && (await parent.comparePin(pin))

  if (!valid) {
    const attempts = session.pinAttempts + 1
    await AuthLog.create({
      userId: parent?._id ?? null,
      phone: session.enteredPhone,
      channel: 'ivr',
      success: false,
      reason: 'wrong_pin',
    })

    if (attempts >= MAX_PIN_ATTEMPTS) {
      sessions.end(sessionId)
      return { say: 'Too many incorrect attempts. Goodbye.', hangup: true }
    }

    sessions.update(sessionId, { pinAttempts: attempts })
    return { say: 'Incorrect PIN. Please try again.', gather: { numDigits: 4 } }
  }

  await AuthLog.create({ userId: parent._id, phone: session.enteredPhone, channel: 'ivr', success: true })
  return greetAndListStudents(sessionId, parent)
}

async function handleStudentSelect(sessionId, session, digits) {
  const index = parseInt(String(digits).trim(), 10) - 1
  const choice = session.candidateStudents?.[index]

  if (!choice) {
    return {
      say: 'That is not a valid option. Please try again.',
      gather: { numDigits: 1 },
    }
  }

  sessions.update(sessionId, { state: 'AWAIT_MENU_SELECT', studentId: choice.id })
  return mainMenuPrompt(choice.name)
}

async function handleMenuSelect(sessionId, session, digits) {
  const choice = String(digits).trim()

  if (choice === '1') return handleCancellation(sessionId, session)
  if (choice === '2') return handleDriverBridge(sessionId, session)

  return { say: 'That is not a valid option. Press 1 to cancel pickup, or press 2 to speak with the driver.', gather: { numDigits: 1 } }
}

// ── Press 1: cancel today's pickup ─────────────────────────────────────

async function handleCancellation(sessionId, session) {
  const student = await Student.findById(session.studentId)
  if (!student) {
    sessions.end(sessionId)
    return { say: 'Student record not found. Goodbye.', hangup: true }
  }

  if (isPastAttendanceCutoff()) {
    // No DB mutation past cutoff — the driver's route for today is final.
    await CommunicationLog.create({
      studentId: student._id,
      parentUserId: session.parentUserId,
      type: 'ivr_cancellation',
      channel: 'ivr',
      status: 'failed',
      failureReason: 'past_cutoff',
    })
    sessions.end(sessionId)
    return {
      say: `Sorry, cancellations must be made before ${process.env.ATTENDANCE_CUTOFF_TIME || '06:30'} AM. The bus is already on its way. Goodbye.`,
      hangup: true,
    }
  }

  await DailyAttendance.findOneAndUpdate(
    { studentId: student._id, date: startOfGhanaDay() },
    { attending: false, updatedByIVR: true, timestamp: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  // Nudge the driver app in real time in case this student is already on
  // an active trip's checklist — the next poll would catch it anyway, but
  // this makes the update feel instant.
  if (student.driverUserId) {
    emitToDriver(student.driverUserId, 'attendance:cancelled', { studentId: String(student._id) })
  }

  await CommunicationLog.create({
    studentId: student._id,
    parentUserId: session.parentUserId,
    type: 'ivr_cancellation',
    channel: 'ivr',
    status: 'sent',
  })

  sessions.end(sessionId)
  return { say: `${student.name}'s pickup has been cancelled for today. Goodbye.`, hangup: true }
}

// ── Press 2: bridge to driver ──────────────────────────────────────────

async function handleDriverBridge(sessionId, session) {
  const student = await Student.findById(session.studentId)
  if (!student) {
    sessions.end(sessionId)
    return { say: 'Student record not found. Goodbye.', hangup: true }
  }

  const driver = await User.findById(student.driverUserId)
  if (!driver || driver.status !== 'active') {
    return fallbackBridgeMessage(sessionId, student)
  }

  const bridged = await bridgeCallToDriver(sessionId, driver.phone)

  await CommunicationLog.create({
    studentId: student._id,
    driverId: driver._id,
    parentUserId: session.parentUserId,
    type: 'ivr_bridge',
    channel: 'ivr',
    status: bridged.ok ? 'sent' : 'failed',
    failureReason: bridged.ok ? null : bridged.error || 'driver_unreachable',
  })

  sessions.end(sessionId)

  if (!bridged.ok) return fallbackBridgeMessage(sessionId, student)

  return { say: 'Connecting you to your driver now. Please hold.' }
}

function fallbackBridgeMessage(sessionId, student) {
  sessions.end(sessionId)
  return {
    say: `We could not reach ${student.name}'s driver right now. Please try again in a few minutes. Goodbye.`,
    hangup: true,
  }
}

// ── Outbound call result callback ──────────────────────────────────────

/**
 * Arkesel reports the final outcome of an outbound voice call (proximity
 * alert or driver bridge) asynchronously here, keyed by the call id we
 * received when we placed it. A failed/unanswered proximity-alert call
 * triggers the SMS fallback if one hasn't already gone out for it.
 */
async function handleVoiceCallback({ callId, status }) {
  if (!callId) return { handled: false }

  const log = await CommunicationLog.findOne({ arkeselCallId: callId }).sort({ timestamp: -1 })
  if (!log) return { handled: false }

  const failed = ['failed', 'no-answer', 'busy', 'rejected'].includes(String(status).toLowerCase())
  log.status = failed ? 'failed' : 'delivered'
  if (failed) log.failureReason = status
  await log.save()

  if (failed && log.type === 'proximity_alert') {
    const alreadyFellBack = await CommunicationLog.exists({
      tripStudentId: log.tripStudentId,
      type: 'sms_fallback',
    })
    if (!alreadyFellBack) {
      const [student, parent] = await Promise.all([
        Student.findById(log.studentId),
        User.findById(log.parentUserId),
      ])
      if (student && parent?.phone) {
        const message = `AwaBus: the school bus is near ${student.name}'s stop. Please be ready.`
        const smsResult = await sendSms(parent.phone, message)
        await CommunicationLog.create({
          tripStudentId: log.tripStudentId,
          tripId: log.tripId,
          studentId: log.studentId,
          driverId: log.driverId,
          parentUserId: parent._id,
          type: 'sms_fallback',
          channel: 'sms',
          status: smsResult.ok ? 'sent' : 'failed',
          recipientPhone: parent.phone,
          message,
          failureReason: smsResult.ok ? null : smsResult.error,
        })
      }
    }
  }

  return { handled: true }
}

module.exports = {
  handleInboundCall,
  handleDtmf,
  handleVoiceCallback,
}
