const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    householdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
    deviceName: {
      type: String,
      trim: true,
      default: "Unnamed Device",
    },
    os: {
      type: String,
      trim: true,
      default: "unknown",
    },
    pairedAt: {
      type: Date,
      default: Date.now,
    },
    deviceTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

DeviceSchema.index({ householdId: 1, userId: 1, deviceId: 1 });

module.exports = mongoose.model("Device", DeviceSchema);
