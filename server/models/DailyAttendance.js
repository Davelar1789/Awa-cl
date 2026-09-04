'use strict'

const mongoose = require('mongoose')

// One document per student per calendar day. Written by the IVR "Press 1"
// cancellation flow (and, potentially, admin overrides). `date` is always
// stored normalised to 00:00:00 UTC of that Ghana calendar day so the
// unique index can enforce "one cancellation record per student per day".
const DailyAttendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    date: { type: Date, required: true },
    attending: { type: Boolean, default: true },
    updatedByIVR: { type: Boolean, default: false },
    reason: { type: String, default: null, maxlength: 200 },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

DailyAttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('DailyAttendance', DailyAttendanceSchema)
