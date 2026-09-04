'use strict'

const { haversineDistance } = require('../utils/haversine')
const TripStudent = require('../models/TripStudent')
const { triggerProximityAlert } = require('./communicationEngine')
const { emitToAdmins } = require('../socket')

/**
 * Pure decision function — extracted so it can be unit-tested at exact
 * boundary values without touching Mongo. Inclusive boundary: a bus exactly
 * at the radius counts as "arrived".
 */
function shouldTrigger(distanceMetres, radiusMetres) {
  return distanceMetres <= radiusMetres
}

/**
 * Runs on every GPS ping. Checks every attending, not-yet-alerted student on
 * the trip; for any the bus has now entered the geofence of, fires the
 * proximity alert exactly once (write-once `alertTriggered` flag) and
 * notifies the admin dashboard in real time.
 */
async function runGeofenceCheck(trip, driverId, busLat, busLng) {
  const tripStudents = await TripStudent.find({
    tripId: trip._id,
    attending: true,
    alertTriggered: false,
  }).populate({
    path: 'studentId',
    populate: { path: 'parentUserId', select: 'name phone' },
  })

  if (!tripStudents.length) return []

  const toFire = []
  for (const ts of tripStudents) {
    const student = ts.studentId
    if (!student || student.homeLatitude == null || student.homeLongitude == null) continue

    const distance = haversineDistance(busLat, busLng, student.homeLatitude, student.homeLongitude)
    const radius = student.geofenceRadius ?? (Number(process.env.DEFAULT_GEOFENCE_RADIUS_METRES) || 500)

    if (shouldTrigger(distance, radius)) {
      toFire.push({ tripStudent: ts, student, distance })
    }
  }

  if (!toFire.length) return []

  const results = await Promise.allSettled(toFire.map((entry) => fireAlert(entry, trip, driverId)))

  return results
}

async function fireAlert({ tripStudent, student, distance }, trip, driverId) {
  // Claim the alert atomically so a second overlapping ping (or a retried
  // request) can never double-fire it — the write-once flag flips exactly
  // once, and only the caller that flips it proceeds to notify.
  const claimed = await TripStudent.findOneAndUpdate(
    { _id: tripStudent._id, alertTriggered: false },
    { alertTriggered: true, alertTimestamp: new Date(), alertDistanceMetres: distance },
    { new: true }
  )
  if (!claimed) return { skipped: true }

  const parent = student.parentUserId
  if (!parent?.phone) {
    console.warn(`[Geofence] No parent phone on file for student ${student._id} — alert not sent.`)
    return { sent: false, reason: 'no_parent_phone' }
  }

  const result = await triggerProximityAlert({
    tripStudentId: tripStudent._id,
    tripId: trip._id,
    studentId: student._id,
    driverId,
    parent,
    studentName: student.name,
    distanceMetres: distance,
  })

  emitToAdmins('log:new', {
    type: 'proximity_alert',
    channel: result.channel,
    studentId: student._id,
    studentName: student.name,
    tripId: trip._id,
    timestamp: new Date().toISOString(),
  })

  if (!result.ok) {
    emitToAdmins('alert:critical', `Both voice and SMS failed for ${student.name} (trip ${trip._id}).`)
  }

  return { sent: result.ok, channel: result.channel }
}

module.exports = { runGeofenceCheck, shouldTrigger }
