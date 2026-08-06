const ChatMessage = require('../models/ChatMessage');

// Get latest 100 messages for household
exports.getMessages = async (req, res) => {
  try {
    const homeId = req.user.homeId;
    if (!homeId) {
      return res.status(200).json({ messages: [] });
    }

    const messages = await ChatMessage.find({ homeId })
      .sort({ createdAt: 1 })
      .limit(100);

    return res.status(200).json({ messages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Send a new message to household
exports.sendMessage = async (req, res) => {
  try {
    const homeId = req.user.homeId;
    const { text } = req.body;

    if (!homeId) {
      return res.status(400).json({ error: 'User is not assigned to a household' });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text cannot be empty' });
    }

    const message = new ChatMessage({
      homeId,
      senderId: req.user._id,
      senderName: req.user.name,
      senderNickname: req.user.nickname || '',
      text: text.trim()
    });

    await message.save();

    return res.status(201).json({ message });
  } catch (error) {
    console.error('Error sending chat message:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};

// Delete a message (sender or home admin)
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await ChatMessage.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const isSender = message.senderId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isSender && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this message' });
    }

    await ChatMessage.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat message:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
};
