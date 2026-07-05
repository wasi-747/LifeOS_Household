const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  date: {
    type: Date
  },
  monthId: {
    type: String
  },
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    required: true
  },
  type: {
    type: String,
    enum: ['BAZAR', 'UTILITY', 'RENT', 'DEPOSIT']
  },
  category: {
    type: String
  },
  amount: {
    type: Number
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  splitType: {
    type: String,
    enum: ['EQUAL', 'CUSTOM', 'MEAL_RATE', 'INDIVIDUAL']
  },
  splitAmong: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      amountOwed: {
        type: Number
      }
    }
  ],
  note: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', TransactionSchema);
