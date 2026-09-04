'use strict'

const mongoose = require('mongoose')

const BusSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    nickname: { type: String, trim: true, default: null, maxlength: 60 },
    capacity: { type: Number, min: [1, 'Capacity must be at least 1'], max: 200, default: null },
    assignedDriverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['Idle', 'Active Trip', 'Maintenance'],
      default: 'Idle',
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Bus', BusSchema)
