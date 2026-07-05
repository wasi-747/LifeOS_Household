const mongoose = require('mongoose');

const HouseholdNoteSchema = new mongoose.Schema({
  monthId: { type: String, required: true },
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
  text: { type: String, required: true },
  category: {
    type: String,
    enum: ['general', 'purchase', 'reminder', 'todo'],
    default: 'general'
  },
  amount: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  reminderDate: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: '' },
  pinned: { type: Boolean, default: false }
}, {
  timestamps: true
});

HouseholdNoteSchema.index({ homeId: 1, monthId: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('HouseholdNote', HouseholdNoteSchema);
