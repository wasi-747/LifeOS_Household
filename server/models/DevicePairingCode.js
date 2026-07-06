const mongoose = require("mongoose");

const DevicePairingCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
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
      default: "",
    },
    os: {
      type: String,
      trim: true,
      default: "unknown",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    claimedDeviceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

DevicePairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("DevicePairingCode", DevicePairingCodeSchema);
