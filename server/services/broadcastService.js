'use strict'

const TripStudent = require('../models/TripStudent')
const CommunicationLog = require('../models/CommunicationLog')
const { sendSms } = require('./communicationEngine')
const { emitToAdmins } = require('../socket')

/**
 * Sends a delay-broadcast SMS to every attending parent on a trip.
 * Deduplicates by phone number so a parent with two children on the same
 * route gets exactly one SMS, not one per child. Dispatch is fire-and-settle
 * (`Promise.allSettled`) so a single failed send can't block the rest, and
 * the driver's request returns as soon as the log entries are written.
 */
async function sendDelayBroadcast(trip, delayMinutes, driverId) {
  const tripStudents = await TripStudent.find({
    tripId: trip._id,
    attending: true,
  }).populate({
    path: 'studentId',
    populate: { path: 'parentUserId', select: 'name phone' },
  })

  // phone -> { parent, students: [names] }
  const byPhone = new Map()
  for (const ts of tripStudents) {
    const student = ts.studentId
    const parent = student?.parentUserId
    if (!parent?.phone) continue
    if (!byPhone.has(parent.phone)) {
      byPhone.set(parent.phone, { parent, tripStudentIds: [], studentIds: [] })
    }
    const entry = byPhone.get(parent.phone)
    entry.tripStudentIds.push(ts._id)
    entry.studentIds.push(student._id)
  }

  const message = `AwaBus: your child's bus is running approximately ${delayMinutes} minute(s) late today. Thank you for your patience.`

  const dispatches = Array.from(byPhone.values()).map(async ({ parent, tripStudentIds, studentIds }) => {
    const result = await sendSms(parent.phone, message)
    await CommunicationLog.create({
      tripStudentId: tripStudentIds[0],
      tripId: trip._id,
      studentId: studentIds[0],
      driverId,
      parentUserId: parent._id,
      type: 'delay_broadcast',
      channel: 'sms',
      status: result.ok ? 'sent' : 'failed',
      recipientPhone: parent.phone,
      message,
      arkeselResponseCode: result.responseCode ?? null,
      failureReason: result.ok ? null : result.error,
    })
    return result
  })

  const settled = await Promise.allSettled(dispatches)
  const recipientCount = byPhone.size

  trip.delayBroadcastLog.push({
    timestamp: new Date(),
    delayMinutes,
    message,
    recipientCount,
  })
  await trip.save()

  emitToAdmins('log:new', {
    type: 'delay_broadcast',
    tripId: trip._id,
    recipientCount,
    delayMinutes,
    timestamp: new Date().toISOString(),
  })

  const failed = settled.filter((s) => s.status === 'rejected' || s.value?.ok === false).length

  return { recipientCount, failed }
}

module.exports = { sendDelayBroadcast }
