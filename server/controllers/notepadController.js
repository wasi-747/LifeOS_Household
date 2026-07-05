const HouseholdNote = require('../models/HouseholdNote');
const { logChange } = require('./auditController');

exports.getNotes = async (req, res) => {
  try {
    const { monthId } = req.params;
    const homeId = req.user.homeId;
    if (!monthId) {
      return res.status(400).json({ error: 'monthId is required' });
    }
    if (!homeId) {
      return res.status(200).json({ monthId, notes: [] });
    }

    const filter = { monthId, homeId };

    // Dynamic search filtering
    if (req.query.search) {
      filter.text = { $regex: req.query.search, $options: 'i' };
    }

    const notes = await HouseholdNote.find(filter)
      .sort({ pinned: -1, createdAt: -1 });

    return res.status(200).json({ monthId, notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return res.status(500).json({ error: 'Internal server error fetching notes' });
  }
};

exports.createNote = async (req, res) => {
  try {
    const { monthId, text, category, amount, reminderDate } = req.body;
    const homeId = req.user.homeId;

    if (!monthId || !text) {
      return res.status(400).json({ error: 'monthId and text are required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    const note = await HouseholdNote.create({
      monthId,
      homeId,
      text: text.trim(),
      category: category || 'general',
      amount: amount || 0,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
      createdBy: req.user._id,
      createdByName: req.user.name,
      pinned: false
    });

    await logChange({
      monthId,
      homeId,
      action: 'ADD_NOTE',
      entity: 'HouseholdNote',
      entityId: note._id.toString(),
      userId: req.user._id,
      userName: req.user.name,
      changes: [{
        field: 'text',
        oldValue: null,
        newValue: text,
        detail: `Added note: "${text.substring(0, 60)}..."`
      }]
    });

    return res.status(201).json({ message: 'Note created', data: note });
  } catch (error) {
    console.error('Error creating note:', error);
    return res.status(500).json({ error: 'Internal server error creating note' });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { text, category, amount, pinned, completed, reminderDate } = req.body;
    const homeId = req.user.homeId;

    const note = await HouseholdNote.findOne({ _id: noteId, homeId });
    if (!note) {
      return res.status(404).json({ error: 'Note not found in your household.' });
    }

    const changes = [];
    if (text !== undefined && text !== note.text) {
      changes.push({ field: 'text', oldValue: note.text, newValue: text, detail: `Edited note text` });
      note.text = text;
    }
    if (category !== undefined && category !== note.category) {
      changes.push({ field: 'category', oldValue: note.category, newValue: category, detail: `Changed category to ${category}` });
      note.category = category;
    }
    if (amount !== undefined && amount !== note.amount) {
      changes.push({ field: 'amount', oldValue: note.amount, newValue: amount, detail: `Changed amount from ৳${note.amount} to ৳${amount}` });
      note.amount = amount;
    }
    if (pinned !== undefined && pinned !== note.pinned) {
      changes.push({ field: 'pinned', oldValue: note.pinned, newValue: pinned, detail: pinned ? 'Pinned note' : 'Unpinned note' });
      note.pinned = pinned;
    }
    if (completed !== undefined && completed !== note.completed) {
      changes.push({ field: 'completed', oldValue: note.completed, newValue: completed, detail: completed ? 'Completed todo task' : 'Marked todo task incomplete' });
      note.completed = completed;
    }
    if (reminderDate !== undefined) {
      const parsedDate = reminderDate ? new Date(reminderDate) : null;
      const oldTime = note.reminderDate ? new Date(note.reminderDate).getTime() : 0;
      const newTime = parsedDate ? parsedDate.getTime() : 0;
      if (oldTime !== newTime) {
        changes.push({ field: 'reminderDate', oldValue: note.reminderDate, newValue: parsedDate, detail: `Changed reminder date` });
        note.reminderDate = parsedDate;
      }
    }

    await note.save();

    if (changes.length > 0) {
      await logChange({
        monthId: note.monthId,
        homeId,
        action: 'EDIT_NOTE',
        entity: 'HouseholdNote',
        entityId: noteId,
        userId: req.user._id,
        userName: req.user.name,
        changes
      });
    }

    return res.status(200).json({ message: 'Note updated', data: note });
  } catch (error) {
    console.error('Error updating note:', error);
    return res.status(500).json({ error: 'Internal server error updating note' });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const homeId = req.user.homeId;

    const note = await HouseholdNote.findOne({ _id: noteId, homeId });
    if (!note) {
      return res.status(404).json({ error: 'Note not found in your household.' });
    }

    const deletedText = note.text;
    await HouseholdNote.deleteOne({ _id: noteId });

    await logChange({
      monthId: note.monthId,
      homeId,
      action: 'DELETE_NOTE',
      entity: 'HouseholdNote',
      entityId: noteId,
      userId: req.user._id,
      userName: req.user.name,
      changes: [{
        field: 'text',
        oldValue: deletedText,
        newValue: null,
        detail: `Deleted note: "${deletedText.substring(0, 60)}..."`
      }]
    });

    return res.status(200).json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error);
    return res.status(500).json({ error: 'Internal server error deleting note' });
  }
};
