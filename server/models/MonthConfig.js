const mongoose = require('mongoose');

const MonthConfigSchema = new mongoose.Schema({
  monthId: {
    type: String,
    required: true
  },
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    required: true
  },
  days: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

MonthConfigSchema.index({ monthId: 1, homeId: 1 }, { unique: true });

module.exports = mongoose.model('MonthConfig', MonthConfigSchema);
