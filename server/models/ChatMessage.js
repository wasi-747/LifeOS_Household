const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderNickname: { type: String, default: '' },
  text: { type: String, required: true }
}, {
  timestamps: true
});

ChatMessageSchema.index({ homeId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
