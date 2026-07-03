const mongoose = require('mongoose');

const DeviceTelemetrySchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    required: true
  },
  cpuUsage: {
    type: Number,
    required: true
  },
  ramUsage: {
    type: Number,
    required: true
  },
  uptime: {
    type: Number,
    required: true
  },
  activityBreakdown: {
    Coding: { type: Number, default: 0 },
    Gaming: { type: Number, default: 0 },
    Browsing: { type: Number, default: 0 },
    Other: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DeviceTelemetry', DeviceTelemetrySchema);
