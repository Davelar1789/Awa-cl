'use strict'

const mongoose = require('mongoose')

const StudentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Student name is required'], trim: true, maxlength: 100 },
    parentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Parent is required'],
      index: true,
    },
    driverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Driver is required'],
      index: true,
    },
    homeLatitude: { type: Number, required: [true, 'Home latitude is required'], min: -90, max: 90 },
    homeLongitude: { type: Number, required: [true, 'Home longitude is required'], min: -180, max: 180 },
    geofenceRadius: {
      type: Number,
      default: 500,
      min: [100, 'Minimum geofence radius is 100m'],
      max: [2000, 'Maximum geofence radius is 2000m'],
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
)

StudentSchema.index({ driverUserId: 1, active: 1 })
StudentSchema.index({ name: 'text' })

module.exports = mongoose.model('Student', StudentSchema)
