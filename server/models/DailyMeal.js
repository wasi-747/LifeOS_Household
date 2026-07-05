const mongoose = require('mongoose');

const DailyMealSchema = new mongoose.Schema({
  date: {
    type: Date
  },
  monthId: {
    type: String // e.g. 'July-2026'
  },
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    required: true
  },
  guestMeals: {
    type: Number,
    default: 0
  },
  meals: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      count: {
        type: Number
      }
    }
  ],
  bazarUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyMeal', DailyMealSchema);
