const User = require('../models/User');
const DailyMeal = require('../models/DailyMeal');
const Transaction = require('../models/Transaction');
const MonthConfig = require('../models/MonthConfig');
const { logChange } = require('./auditController');

const getDaysInMonth = (monthId) => {
  const parts = monthId.split('-');
  if (parts.length !== 2) return 30;
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  const months = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
  };
  const monthNum = months[monthName];
  if (!monthNum || isNaN(year)) return 30;
  return new Date(year, monthNum, 0).getDate();
};

exports.getTrackerData = async (req, res) => {
  try {
    const { monthId } = req.params;
    const homeId = req.user.homeId;

    if (!monthId) {
      return res.status(400).json({ error: 'monthId is required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    const users = await User.find({ homeId }).select('name email role');
    
    // Find MonthConfig
    let monthConfig = await MonthConfig.findOne({ monthId, homeId });
    let daysCount = monthConfig ? monthConfig.days : getDaysInMonth(monthId);

    // Fetch DailyMeals
    let dailyMeals = await DailyMeal.find({ monthId, homeId });

    // Fetch BAZAR Transactions
    let bazarTransactions = await Transaction.find({ monthId, homeId, type: 'BAZAR' });

    // Fetch DEPOSIT Transactions of category 'Meal Deposit'
    let depositTransactions = await Transaction.find({ monthId, homeId, type: 'DEPOSIT', category: 'Meal Deposit' });

    // Generate meals, bazar, and deposits arrays for response
    const meals = [];
    const bazar = [];
    const deposits = [];

    // Parse month and year for Date construction
    const parts = monthId.split('-');
    const monthName = parts[0];
    const yearStr = parts[1];
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const monthIndex = months[monthName] !== undefined ? months[monthName] : 6;
    const year = parseInt(yearStr, 10) || 2026;

    for (let d = 1; d <= daysCount; d++) {
      const targetDate = new Date(Date.UTC(year, monthIndex, d, 12, 0, 0));

      // 1. MEALS
      let dmRecord = dailyMeals.find(dm => {
        const dmDate = new Date(dm.date);
        return dmDate.getUTCDate() === d && dmDate.getUTCMonth() === monthIndex && dmDate.getUTCFullYear() === year;
      });

      if (!dmRecord) {
        // Create a default DailyMeal in DB to ensure it has consistent IDs and fields
        dmRecord = await DailyMeal.create({
          date: targetDate,
          monthId,
          homeId,
          guestMeals: 0,
          meals: users.map(u => ({ user: u._id, count: 0 }))
        });
      }

      const mealCounts = {};
      users.forEach(u => {
        const item = dmRecord.meals.find(m => m.user && m.user.toString() === u._id.toString());
        mealCounts[u._id] = item ? item.count : 0;
      });

      meals.push({
        day: d,
        date: dmRecord.date,
        guestMeals: dmRecord.guestMeals || 0,
        meals: mealCounts
      });

      // 2. BAZAR
      const dailyBazarCosts = {};
      const dailyBazarNotes = {};
      users.forEach(u => {
        const matchingTx = bazarTransactions.find(tx => {
          const txDate = new Date(tx.date);
          return txDate.getUTCDate() === d && 
                 txDate.getUTCMonth() === monthIndex && 
                 txDate.getUTCFullYear() === year &&
                 tx.paidBy && tx.paidBy.toString() === u._id.toString();
        });
        dailyBazarCosts[u._id] = matchingTx ? matchingTx.amount : 0;
        dailyBazarNotes[u._id] = matchingTx ? (matchingTx.note || '') : '';
      });

      bazar.push({
        day: d,
        date: targetDate,
        costs: dailyBazarCosts,
        notes: dailyBazarNotes,
        assignedUser: dmRecord.bazarUser || null
      });

      // 3. DEPOSITS (Meal Deposits)
      const dailyDeposits = {};
      const dailyDepositNotes = {};
      users.forEach(u => {
        const matchingTx = depositTransactions.find(tx => {
          const txDate = new Date(tx.date);
          return txDate.getUTCDate() === d && 
                 txDate.getUTCMonth() === monthIndex && 
                 txDate.getUTCFullYear() === year &&
                 tx.paidBy && tx.paidBy.toString() === u._id.toString();
        });
        dailyDeposits[u._id] = matchingTx ? matchingTx.amount : 0;
        dailyDepositNotes[u._id] = matchingTx ? (matchingTx.note || '') : '';
      });

      deposits.push({
        day: d,
        date: targetDate,
        amounts: dailyDeposits,
        notes: dailyDepositNotes
      });
    }

    return res.status(200).json({
      monthId,
      daysInMonth: daysCount,
      users,
      meals,
      bazar,
      deposits
    });

  } catch (error) {
    console.error('Error fetching tracker data:', error);
    return res.status(500).json({ error: 'Internal server error fetching tracker data' });
  }
};

exports.updateMeals = async (req, res) => {
  try {
    const { monthId, day, userId, count } = req.body;
    const homeId = req.user.homeId;

    if (!monthId || day === undefined || !userId || count === undefined) {
      return res.status(400).json({ error: 'monthId, day, userId, and count are required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    // Parse date
    const parts = monthId.split('-');
    const monthName = parts[0];
    const yearStr = parts[1];
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const monthIndex = months[monthName] !== undefined ? months[monthName] : 6;
    const year = parseInt(yearStr, 10) || 2026;
    const targetDate = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));

    let dmRecord = await DailyMeal.findOne({
      monthId,
      homeId,
      date: {
        $gte: new Date(Date.UTC(year, monthIndex, day, 0, 0, 0)),
        $lte: new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999))
      }
    });

    if (!dmRecord) {
      dmRecord = new DailyMeal({
        date: targetDate,
        monthId,
        homeId,
        guestMeals: 0,
        meals: []
      });
    }

    // Capture old value for audit
    const userIndex = dmRecord.meals.findIndex(m => m.user && m.user.toString() === userId);
    const oldCount = userIndex > -1 ? dmRecord.meals[userIndex].count : 0;

    if (userIndex > -1) {
      dmRecord.meals[userIndex].count = count;
    } else {
      dmRecord.meals.push({ user: userId, count });
    }

    await dmRecord.save();

    // Lookup target user name for audit detail
    const targetUser = await User.findOne({ _id: userId, homeId }).select('name');
    const targetName = targetUser ? targetUser.name : userId;
    
    await logChange({
      monthId,
      homeId,
      action: 'UPDATE_MEAL',
      entity: 'DailyMeal',
      entityId: dmRecord._id.toString(),
      userId: req.user._id,
      userName: req.user.name,
      changes: [{
        field: 'count',
        oldValue: oldCount,
        newValue: count,
        detail: `Changed ${targetName}'s meal count from ${oldCount} to ${count} on Day ${day}`
      }]
    });

    return res.status(200).json({ message: 'Meals updated successfully', data: dmRecord });

  } catch (error) {
    console.error('Error updating meals:', error);
    return res.status(500).json({ error: 'Internal server error updating meals' });
  }
};

exports.updateBazar = async (req, res) => {
  try {
    const { monthId, day, userId, amount, note } = req.body;
    const homeId = req.user.homeId;

    if (!monthId || day === undefined || !userId || amount === undefined) {
      return res.status(400).json({ error: 'monthId, day, userId, and amount are required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    // Parse date
    const parts = monthId.split('-');
    const monthName = parts[0];
    const yearStr = parts[1];
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const monthIndex = months[monthName] !== undefined ? months[monthName] : 6;
    const year = parseInt(yearStr, 10) || 2026;
    const targetDate = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));

    const startOfDay = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999));

    const targetUser = await User.findOne({ _id: userId, homeId }).select('name');
    const targetName = targetUser ? targetUser.name : userId;

    // Find if a transaction of type BAZAR exists for this user on this day in this home
    let transaction = await Transaction.findOne({
      monthId,
      homeId,
      paidBy: userId,
      type: 'BAZAR',
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (transaction) {
      const oldAmount = transaction.amount;
      const oldNote = transaction.note || '';
      if (amount <= 0) {
        await Transaction.deleteOne({ _id: transaction._id });
        await logChange({
          monthId,
          homeId,
          action: 'UPDATE_BAZAR',
          entity: 'Transaction',
          entityId: transaction._id.toString(),
          userId: req.user._id,
          userName: req.user.name,
          changes: [{
            field: 'amount',
            oldValue: oldAmount,
            newValue: 0,
            detail: `Removed ${targetName}'s bazar entry (৳${oldAmount}) on Day ${day}`
          }]
        });
        return res.status(200).json({ message: 'Bazar transaction removed (amount is 0)' });
      } else {
        transaction.amount = amount;
        if (note !== undefined) transaction.note = note;
        await transaction.save();
        const changes = [];
        if (oldAmount !== amount) changes.push({ field: 'amount', oldValue: oldAmount, newValue: amount, detail: `Changed ${targetName}'s bazar from ৳${oldAmount} to ৳${amount} on Day ${day}` });
        if (note !== undefined && oldNote !== note) changes.push({ field: 'note', oldValue: oldNote, newValue: note, detail: `Updated bazar note for ${targetName} on Day ${day}` });
        if (changes.length > 0) {
          await logChange({
            monthId,
            homeId,
            action: 'UPDATE_BAZAR',
            entity: 'Transaction',
            entityId: transaction._id.toString(),
            userId: req.user._id,
            userName: req.user.name,
            changes
          });
        }
        return res.status(200).json({ message: 'Bazar transaction updated', data: transaction });
      }
    } else {
      if (amount > 0) {
        transaction = new Transaction({
          date: targetDate,
          monthId,
          homeId,
          type: 'BAZAR',
          category: 'Daily Bazar',
          amount: amount,
          paidBy: userId,
          splitType: 'MEAL_RATE',
          note: note || ''
        });
        await transaction.save();
        await logChange({
          monthId,
          homeId,
          action: 'UPDATE_BAZAR',
          entity: 'Transaction',
          entityId: transaction._id.toString(),
          userId: req.user._id,
          userName: req.user.name,
          changes: [{
            field: 'amount',
            oldValue: 0,
            newValue: amount,
            detail: `${targetName} spent ৳${amount} on bazar on Day ${day}${note ? ` — ${note}` : ''}`
          }]
        });
        return res.status(201).json({ message: 'Bazar transaction created', data: transaction });
      } else {
        return res.status(200).json({ message: 'No action taken (amount is 0)' });
      }
    }

  } catch (error) {
    console.error('Error updating bazar cost:', error);
    return res.status(500).json({ error: 'Internal server error updating bazar cost' });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { monthId, days } = req.body;
    const homeId = req.user.homeId;

    if (!monthId || days === undefined) {
      return res.status(400).json({ error: 'monthId and days are required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    let monthConfig = await MonthConfig.findOne({ monthId, homeId });
    if (monthConfig) {
      monthConfig.days = days;
      await monthConfig.save();
    } else {
      monthConfig = new MonthConfig({ monthId, homeId, days });
      await monthConfig.save();
    }

    return res.status(200).json({ message: 'Month config updated successfully', data: monthConfig });

  } catch (error) {
    console.error('Error updating month config:', error);
    return res.status(500).json({ error: 'Internal server error updating month config' });
  }
};

exports.updateDeposit = async (req, res) => {
  try {
    const { monthId, day, userId, amount, note } = req.body;
    const homeId = req.user.homeId;

    if (!monthId || day === undefined || !userId || amount === undefined) {
      return res.status(400).json({ error: 'monthId, day, userId, and amount are required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    // Parse date
    const parts = monthId.split('-');
    const monthName = parts[0];
    const yearStr = parts[1];
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const monthIndex = months[monthName] !== undefined ? months[monthName] : 6;
    const year = parseInt(yearStr, 10) || 2026;
    const targetDate = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));

    const startOfDay = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999));

    const targetUser = await User.findOne({ _id: userId, homeId }).select('name');
    const targetName = targetUser ? targetUser.name : userId;

    // Find if a transaction of type DEPOSIT exists for this user on this day in this home
    let transaction = await Transaction.findOne({
      monthId,
      homeId,
      paidBy: userId,
      type: 'DEPOSIT',
      category: 'Meal Deposit',
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (transaction) {
      const oldAmount = transaction.amount;
      const oldNote = transaction.note || '';
      if (amount <= 0) {
        await Transaction.deleteOne({ _id: transaction._id });
        await logChange({
          monthId,
          homeId,
          action: 'UPDATE_DEPOSIT',
          entity: 'Transaction',
          entityId: transaction._id.toString(),
          userId: req.user._id,
          userName: req.user.name,
          changes: [{
            field: 'amount',
            oldValue: oldAmount,
            newValue: 0,
            detail: `Removed ${targetName}'s deposit (৳${oldAmount}) on Day ${day}`
          }]
        });
        return res.status(200).json({ message: 'Deposit transaction removed (amount is 0)' });
      } else {
        transaction.amount = amount;
        if (note !== undefined) transaction.note = note;
        await transaction.save();
        const changes = [];
        if (oldAmount !== amount) changes.push({ field: 'amount', oldValue: oldAmount, newValue: amount, detail: `Changed ${targetName}'s deposit from ৳${oldAmount} to ৳${amount} on Day ${day}` });
        if (note !== undefined && oldNote !== note) changes.push({ field: 'note', oldValue: oldNote, newValue: note, detail: `Updated deposit note for ${targetName} on Day ${day}` });
        if (changes.length > 0) {
          await logChange({
            monthId,
            homeId,
            action: 'UPDATE_DEPOSIT',
            entity: 'Transaction',
            entityId: transaction._id.toString(),
            userId: req.user._id,
            userName: req.user.name,
            changes
          });
        }
        return res.status(200).json({ message: 'Deposit transaction updated', data: transaction });
      }
    } else {
      if (amount > 0) {
        transaction = new Transaction({
          date: targetDate,
          monthId,
          homeId,
          type: 'DEPOSIT',
          category: 'Meal Deposit',
          amount: amount,
          paidBy: userId,
          splitType: 'INDIVIDUAL',
          note: note || ''
        });
        await transaction.save();
        await logChange({
          monthId,
          homeId,
          action: 'UPDATE_DEPOSIT',
          entity: 'Transaction',
          entityId: transaction._id.toString(),
          userId: req.user._id,
          userName: req.user.name,
          changes: [{
            field: 'amount',
            oldValue: 0,
            newValue: amount,
            detail: `${targetName} deposited ৳${amount} on Day ${day}${note ? ` — ${note}` : ''}`
          }]
        });
        return res.status(201).json({ message: 'Deposit transaction created', data: transaction });
      } else {
        return res.status(200).json({ message: 'No action taken (amount is 0)' });
      }
    }

  } catch (error) {
    console.error('Error updating meal deposit:', error);
    return res.status(500).json({ error: 'Internal server error updating meal deposit' });
  }
};

exports.assignBazarUser = async (req, res) => {
  try {
    const { monthId, day, userId } = req.body;
    const homeId = req.user.homeId;

    if (!monthId || day === undefined) {
      return res.status(400).json({ error: 'monthId and day are required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    // Parse date
    const parts = monthId.split('-');
    const monthName = parts[0];
    const yearStr = parts[1];
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const monthIndex = months[monthName] !== undefined ? months[monthName] : 6;
    const year = parseInt(yearStr, 10) || 2026;
    const targetDate = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));

    let dmRecord = await DailyMeal.findOne({
      monthId,
      homeId,
      date: {
        $gte: new Date(Date.UTC(year, monthIndex, day, 0, 0, 0)),
        $lte: new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999))
      }
    });

    const oldAssigned = dmRecord ? (dmRecord.bazarUser ? dmRecord.bazarUser.toString() : null) : null;

    if (!dmRecord) {
      const users = await User.find({ homeId });
      dmRecord = new DailyMeal({
        date: targetDate,
        monthId,
        homeId,
        guestMeals: 0,
        meals: users.map(u => ({ user: u._id, count: 0 })),
        bazarUser: userId || null
      });
    } else {
      dmRecord.bazarUser = userId || null;
    }

    await dmRecord.save();

    const targetUser = userId ? await User.findOne({ _id: userId, homeId }).select('name') : null;
    const targetName = targetUser ? targetUser.name : 'Nobody';
    
    await logChange({
      monthId,
      homeId,
      action: 'ASSIGN_BAZAR_USER',
      entity: 'DailyMeal',
      entityId: dmRecord._id.toString(),
      userId: req.user._id,
      userName: req.user.name,
      changes: [{
        field: 'bazarUser',
        oldValue: oldAssigned,
        newValue: userId || null,
        detail: `Assigned ${targetName} to bazar duty on Day ${day}`
      }]
    });

    return res.status(200).json({ message: 'Bazar assignment updated successfully', data: dmRecord });

  } catch (error) {
    console.error('Error assigning bazar user:', error);
    return res.status(500).json({ error: 'Internal server error assigning bazar user' });
  }
};
