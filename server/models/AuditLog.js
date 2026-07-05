const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  monthId: { type: String, default: '' },
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
  action: {
    type: String,
    required: true,
    enum: [
      'UPDATE_MEAL', 'UPDATE_BAZAR', 'UPDATE_DEPOSIT',
      'ADD_TRANSFER', 'DELETE_TRANSFER',
      'UPDATE_BILL_CONFIG', 'CREATE_MONTH',
      'ADD_NOTE', 'EDIT_NOTE', 'DELETE_NOTE',
      'ASSIGN_BAZAR_USER', 'UPDATE_CONFIG'
    ]
  },
  entity: { type: String }, // 'DailyMeal', 'Transaction', 'MonthlyBill', 'BazarWallet', 'HouseholdNote'
  entityId: { type: String },
  userId: { type: String, default: 'system' },
  userName: { type: String, default: 'System' },
  changes: [
    {
      field: { type: String },
      oldValue: { type: mongoose.Schema.Types.Mixed },
      newValue: { type: mongoose.Schema.Types.Mixed },
      detail: { type: String } // Human-readable summary
    }
  ]
}, {
  timestamps: true
});

// Index for efficient querying by home and month
AuditLogSchema.index({ homeId: 1, monthId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
