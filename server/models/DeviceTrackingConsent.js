const mongoose = require("mongoose");

const DeviceTrackingConsentSchema = new mongoose.Schema(
  {
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
    consentedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    consentVersion: {
      type: String,
      required: true,
      default: "1.0",
    },
  },
  {
    timestamps: true,
  },
);

DeviceTrackingConsentSchema.index({ userId: 1, householdId: 1, revokedAt: 1 });

module.exports = mongoose.model(
  "DeviceTrackingConsent",
  DeviceTrackingConsentSchema,
);
