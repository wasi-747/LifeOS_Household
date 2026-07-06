const mongoose = require("mongoose");

const HouseholdMemberSchema = new mongoose.Schema(
  {
    householdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

HouseholdMemberSchema.index({ householdId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("HouseholdMember", HouseholdMemberSchema);
