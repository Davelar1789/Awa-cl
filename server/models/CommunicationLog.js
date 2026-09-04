'use strict'

const mongoose = require('mongoose')

// Append-only audit trail of every voice call, SMS, and IVR event. Never
// updated or deleted by application code — routes only ever `create()` here.
const CommunicationLogSchema = new mongoose.Schema(
  {
    tripStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'TripStudent', default: null },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    parentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: {
      type: String,
      enum: [
        'proximity_alert',
        'sms_fallback',
        'ivr_cancellation',
        'ivr_bridge',
        'delay_broadcast',
        'login',
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ['voice', 'sms', 'ivr'],
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed'],
      default: 'sent',
    },
    recipientPhone: { type: String, default: null },
    message: { type: String, default: null },
    arkeselResponseCode: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    failureReason: { type: String, default: null },
    arkeselCallId: { type: String, default: null },
    arkeselSessionId: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

CommunicationLogSchema.index({ timestamp: -1 })
CommunicationLogSchema.index({ type: 1, status: 1 })
CommunicationLogSchema.index({ recipientPhone: 1 })

module.exports = mongoose.model('CommunicationLog', CommunicationLogSchema)
