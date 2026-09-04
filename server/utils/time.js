'use strict'

// Ghana Standard Time is UTC+0 year-round (no DST), so server UTC clock time
// *is* Ghana time — no timezone conversion library needed.

function getCutoff() {
  const raw = process.env.ATTENDANCE_CUTOFF_TIME || '06:30'
  const [h, m] = raw.split(':').map((n) => parseInt(n, 10))
  return { hours: Number.isFinite(h) ? h : 6, minutes: Number.isFinite(m) ? m : 30 }
}

/** True once the daily attendance-cancellation window (default 06:30 GST) has closed. */
function isPastAttendanceCutoff(now = new Date()) {
  const { hours, minutes } = getCutoff()
  const cutoffTodayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hours,
    minutes,
    0,
    0
  )
  return now.getTime() >= cutoffTodayUTC
}

/** Midnight UTC (= midnight GST) of the calendar day containing `date`. */
function startOfGhanaDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

module.exports = { isPastAttendanceCutoff, startOfGhanaDay, getCutoff }
