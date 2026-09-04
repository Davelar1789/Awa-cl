'use strict'

const mongoose = require('mongoose')

const TripSchema = new mongoose.Schema(
  {
    driverUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    direction: {
      type: String,
      enum: ['dropoff', 'pickup'],
      default: 'dropoff',
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Active', 'Completed'],
      default: 'Active',
      index: true,
    },
    lastKnownLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      timestamp: { type: Date, default: null },
    },
    delayBroadcastLog: [
      {
        timestamp: { type: Date, default: Date.now },
        delayMinutes: { type: Number },
        message: { type: String },
        recipientCount: { type: Number },
      },
    ],
  },
  { timestamps: true }
)

// One active trip per bus at a time, enforced at the DB layer as a backstop
// to the application-level check in the route handler.
TripSchema.index(
  { busId: 1 },
  { unique: true, partialFilterExpression: { status: 'Active' } }
)

module.exports = mongoose.model('Trip', TripSchema)
