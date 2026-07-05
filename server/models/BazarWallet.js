const mongoose = require('mongoose');

const BazarWalletSchema = new mongoose.Schema({
  monthId: {
    type: String,
    required: true
  },
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    required: true
  },
  transfers: [
    {
      from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      date: {
        type: Date,
        default: Date.now
      },
      note: {
        type: String,
        default: ''
      }
    }
  ]
}, {
  timestamps: true
});

BazarWalletSchema.index({ monthId: 1, homeId: 1 }, { unique: true });

module.exports = mongoose.model('BazarWallet', BazarWalletSchema);
