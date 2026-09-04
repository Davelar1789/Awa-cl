'use strict'

const mongoose = require('mongoose')

const TripStudentSchema = new mongoose.Schema(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    attending: { type: Boolean, default: true },
    // Write-once — application code must never set this back to false.
    alertTriggered: { type: Boolean, default: false },
    alertTimestamp: { type: Date, default: null },
    alertDistanceMetres: { type: Number, default: null },
    manuallyResolved: { type: Boolean, default: false },
  },
  { timestamps: true }
)

// Primary query the geofence engine runs on every GPS ping.
TripStudentSchema.index({ tripId: 1, attending: 1, alertTriggered: 1 })
TripStudentSchema.index({ tripId: 1, studentId: 1 }, { unique: true })

module.exports = mongoose.model('TripStudent', TripStudentSchema)
