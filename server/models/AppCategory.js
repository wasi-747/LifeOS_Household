const mongoose = require("mongoose");

const AppCategorySchema = new mongoose.Schema(
  {
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
    category: {
      type: String,
      required: true,
      enum: ["Gaming", "Work", "Entertainment", "Other", "Uncategorized"],
      default: "Uncategorized",
    },
    taggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    taggedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

AppCategorySchema.index({ householdId: 1, appName: 1 }, { unique: true });

module.exports = mongoose.model("AppCategory", AppCategorySchema);
