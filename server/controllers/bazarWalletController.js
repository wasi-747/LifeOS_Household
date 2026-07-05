const BazarWallet = require('../models/BazarWallet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { logChange } = require('./auditController');

exports.getWallet = async (req, res) => {
  try {
    const { monthId } = req.params;
    const homeId = req.user.homeId;
    if (!monthId) {
      return res.status(400).json({ error: 'monthId is required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    const users = await User.find({ homeId }).select('name email');
    let wallet = await BazarWallet.findOne({ monthId, homeId });
    if (!wallet) {
      wallet = new BazarWallet({ monthId, homeId, transfers: [] });
      await wallet.save();
    }

    // Fetch bazar and deposit transactions for this month & home to calculate wallet statistics
    const bazarTransactions = await Transaction.find({ monthId, homeId, type: 'BAZAR' });
    const depositTransactions = await Transaction.find({ monthId, homeId, type: 'DEPOSIT' });

    // Calculate per-user wallet summary
    const userSummaries = users.map(u => {
      const uid = u._id.toString();

      // Total received from others (transfers where this user is 'to')
      const received = wallet.transfers
        .filter(t => t.to && t.to.toString() === uid)
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      // Total direct deposits (Given for Meal)
      const deposits = depositTransactions
        .filter(tx => tx.paidBy && tx.paidBy.toString() === uid)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      // Total given to others (transfers where this user is 'from')
      const given = wallet.transfers
        .filter(t => t.from && t.from.toString() === uid)
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      // Total bazar spent by this user
      const spent = bazarTransactions
        .filter(tx => tx.paidBy && tx.paidBy.toString() === uid)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      // Balance = deposits + received - given - spent
      const balance = deposits + received - given - spent;

      return {
        userId: uid,
        name: u.name,
        received,
        given,
        spent,
        deposits,
        balance
      };
    });

    return res.status(200).json({
      monthId,
      transfers: wallet.transfers,
      walletId: wallet._id,
      userSummaries
    });
  } catch (error) {
    console.error('Error fetching bazar wallet:', error);
    return res.status(500).json({ error: 'Internal server error fetching bazar wallet' });
  }
};

exports.addTransfer = async (req, res) => {
  try {
    const { monthId, from, to, amount, note, date } = req.body;
    const homeId = req.user.homeId;

    if (!monthId || !from || !to || amount === undefined) {
      return res.status(400).json({ error: 'monthId, from, to, and amount are required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    let wallet = await BazarWallet.findOne({ monthId, homeId });
    if (!wallet) {
      wallet = new BazarWallet({ monthId, homeId, transfers: [] });
    }

    wallet.transfers.push({
      from,
      to,
      amount,
      date: date ? new Date(date) : new Date(),
      note: note || ''
    });

    await wallet.save();

    const fromUser = await User.findOne({ _id: from, homeId }).select('name');
    const toUser = await User.findOne({ _id: to, homeId }).select('name');
    
    await logChange({
      monthId,
      homeId,
      action: 'ADD_TRANSFER',
      entity: 'BazarWallet',
      entityId: wallet._id.toString(),
      userId: req.user._id,
      userName: req.user.name,
      changes: [{
        field: 'transfer',
        oldValue: null,
        newValue: amount,
        detail: `${fromUser ? fromUser.name : 'Someone'} gave ৳${amount} to ${toUser ? toUser.name : 'Someone'}${note ? ` — ${note}` : ''}`
      }]
    });

    return res.status(201).json({ message: 'Transfer added', data: wallet });
  } catch (error) {
    console.error('Error adding bazar transfer:', error);
    return res.status(500).json({ error: 'Internal server error adding transfer' });
  }
};

exports.deleteTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    const homeId = req.user.homeId;

    if (!transferId) {
      return res.status(400).json({ error: 'transferId is required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    const wallet = await BazarWallet.findOne({ homeId, 'transfers._id': transferId });
    if (!wallet) {
      return res.status(404).json({ error: 'Transfer not found in your household.' });
    }

    const deleted = wallet.transfers.find(t => t._id.toString() === transferId);
    wallet.transfers = wallet.transfers.filter(t => t._id.toString() !== transferId);
    await wallet.save();

    if (deleted) {
      const fromUser = await User.findOne({ _id: deleted.from, homeId }).select('name');
      const toUser = await User.findOne({ _id: deleted.to, homeId }).select('name');
      
      await logChange({
        monthId: wallet.monthId,
        homeId,
        action: 'DELETE_TRANSFER',
        entity: 'BazarWallet',
        entityId: wallet._id.toString(),
        userId: req.user._id,
        userName: req.user.name,
        changes: [{
          field: 'transfer',
          oldValue: deleted.amount,
          newValue: null,
          detail: `Deleted transfer: ${fromUser ? fromUser.name : '?'} → ${toUser ? toUser.name : '?'} ৳${deleted.amount}`
        }]
      });
    }

    return res.status(200).json({ message: 'Transfer deleted', data: wallet });
  } catch (error) {
    console.error('Error deleting bazar transfer:', error);
    return res.status(500).json({ error: 'Internal server error deleting transfer' });
  }
};
