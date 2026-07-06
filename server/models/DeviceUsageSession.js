const mongoose = require("mongoose");

const DeviceUsageSessionSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
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
    appName: {
      type: String,
      required: true,
      trim: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 0,
    },
    gpuAvgPercent: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    startedAt: {
      type: Date,
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppCategory",
      default: null,
    },
    categoryLabel: {
      type: String,
      default: "Uncategorized",
    },
  },
  {
    timestamps: true,
  },
);

DeviceUsageSessionSchema.index({ householdId: 1, userId: 1, startedAt: -1 });
DeviceUsageSessionSchema.index({ householdId: 1, deviceId: 1, startedAt: -1 });

module.exports = mongoose.model("DeviceUsageSession", DeviceUsageSessionSchema);
