const mongoose = require('mongoose');

const MonthlyBillSchema = new mongoose.Schema({
  monthId: {
    type: String,
    required: true
  },
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    required: true
  },
  rent: {
    type: Map,
    of: Number,
    default: {}
  },
  utilities: {
    type: Map,
    of: Number,
    default: {
      wifi: 0,
      electricity: 0,
      gas: 0,
      garbage: 0,
      bashaUti: 0,
      pani: 0,
      bua: 0,
      extra: 0
    }
  },
  adjustments: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      prevUtilityDue: { type: Number, default: 0 },
      prevMealDue: { type: Number, default: 0 },
      utilityPayment: { type: Number, default: 0 },
      rentPayment: { type: Number, default: 0 },
      note: { type: String, default: '' }
    }
  ],
  utilityNotes: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});

MonthlyBillSchema.index({ monthId: 1, homeId: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyBill', MonthlyBillSchema);
