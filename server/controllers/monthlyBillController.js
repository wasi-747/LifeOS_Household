const User = require('../models/User');
const Home = require('../models/Home');
const MonthlyBill = require('../models/MonthlyBill');
const DailyMeal = require('../models/DailyMeal');
const Transaction = require('../models/Transaction');
const BazarWallet = require('../models/BazarWallet');
const { logChange } = require('./auditController');

// Helper to get the previous monthId
const getPreviousMonthId = (monthId) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const parts = monthId.split('-');
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  const monthIndex = monthNames.indexOf(monthName);
  if (monthIndex === -1) return null;

  if (monthIndex === 0) {
    return `December-${year - 1}`;
  }
  return `${monthNames[monthIndex - 1]}-${year}`;
};

// Calculate previous month's final food and utility dues per user scoped to homeId
const calculatePrevMonthDues = async (prevMonthId, homeId, users) => {
  const prevBill = await MonthlyBill.findOne({ monthId: prevMonthId, homeId });
  if (!prevBill) return null; // No previous month data exists

  const prevTransactions = await Transaction.find({ monthId: prevMonthId, homeId });
  const prevDailyMeals = await DailyMeal.find({ monthId: prevMonthId, homeId });
  const prevBazarWallet = await BazarWallet.findOne({ monthId: prevMonthId, homeId }) || { transfers: [] };

  // Calculate total bazar cost and meals for prev month
  const totalMealCost = prevTransactions
    .filter(tx => tx.type === 'BAZAR')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  let totalMeals = 0;
  prevDailyMeals.forEach(dm => {
    if (dm.meals && Array.isArray(dm.meals)) {
      dm.meals.forEach(m => { totalMeals += (m.count || 0); });
    }
  });

  const mealRate = totalMeals > 0 ? (totalMealCost / totalMeals) : 0;

  let totalUtilities = 0;
  if (prevBill.utilities instanceof Map) {
    totalUtilities = Array.from(prevBill.utilities.values()).reduce((sum, v) => sum + (v || 0), 0);
  } else {
    totalUtilities = Object.values(prevBill.utilities || {}).reduce((sum, v) => sum + (v || 0), 0);
  }

  const adjustments = [];
  for (const u of users) {
    const uid = u._id.toString();

    // User meal count
    let userMeals = 0;
    prevDailyMeals.forEach(dm => {
      if (dm.meals && Array.isArray(dm.meals)) {
        dm.meals.forEach(m => {
          if (m.user && m.user.toString() === uid) userMeals += (m.count || 0);
        });
      }
    });

    const mealCost = userMeals * mealRate;

    // Previous month's adjustments for this user
    const prevAdj = prevBill.adjustments.find(a => a.user && a.user.toString() === uid);
    const prevPrevMealDue = prevAdj ? prevAdj.prevMealDue : 0;
    const prevPrevUtilityDue = prevAdj ? prevAdj.prevUtilityDue : 0;
    const prevUtilityPayment = prevAdj ? prevAdj.utilityPayment : 0;

    // Deposits in prev month
    const deposits = prevTransactions
      .filter(tx => tx.type === 'DEPOSIT' && tx.paidBy && tx.paidBy.toString() === uid)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Out-of-pocket Bazar contributions in prev month
    const walletReceived = prevBazarWallet.transfers
      .filter(t => t.to && t.to.toString() === uid)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const walletGiven = prevBazarWallet.transfers
      .filter(t => t.from && t.from.toString() === uid)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const walletSpent = prevTransactions
      .filter(tx => tx.type === 'BAZAR' && tx.paidBy && tx.paidBy.toString() === uid)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const walletBalance = walletReceived - walletSpent - walletGiven;

    // Food due = mealCost + prevMealDue - deposits + walletBalance
    const foodDue = mealCost + prevPrevMealDue - deposits + walletBalance;

    // Utility due = prevUtilityDue + share - payment
    const utilityShare = totalUtilities / users.length;
    const utilityDue = prevPrevUtilityDue + utilityShare - prevUtilityPayment;

    adjustments.push({
      user: u._id,
      prevMealDue: Number(foodDue.toFixed(2)),
      prevUtilityDue: Number(utilityDue.toFixed(2)),
      utilityPayment: 0,
      rentPayment: 0
    });
  }

  return adjustments;
};

exports.getMonthlyBill = async (req, res) => {
  try {
    const { monthId } = req.params;
    const homeId = req.user.homeId;
    if (!monthId) {
      return res.status(400).json({ error: 'monthId is required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    const users = await User.find({ homeId });
    let monthlyBill = await MonthlyBill.findOne({ monthId, homeId });

    if (!monthlyBill) {
      // Try auto carry-forward from previous month
      const prevMonthId = getPreviousMonthId(monthId);
      let autoAdjustments = null;

      if (prevMonthId) {
        autoAdjustments = await calculatePrevMonthDues(prevMonthId, homeId, users);
      }

      if (autoAdjustments) {
        // Auto carry-forward: use previous month's final dues as this month's prev dues
        const defaultRent = {};
        users.forEach(u => {
          defaultRent[u._id.toString()] = 0;
        });

        monthlyBill = new MonthlyBill({
          monthId,
          homeId,
          rent: defaultRent,
          utilities: {
            wifi: 0, electricity: 0, gas: 0, garbage: 0,
            bashaUti: 0, pani: 0, bua: 0, extra: 0
          },
          adjustments: autoAdjustments
        });
      } else {
        // First month fallback: initialize defaults
        const defaultRent = {};
        const defaultAdjustments = [];

        users.forEach(u => {
          defaultRent[u._id.toString()] = 0;
          defaultAdjustments.push({
            user: u._id,
            prevUtilityDue: 0,
            prevMealDue: 0,
            utilityPayment: 0,
            rentPayment: 0
          });
        });

        monthlyBill = new MonthlyBill({
          monthId,
          homeId,
          rent: defaultRent,
          utilities: {
            wifi: 0, electricity: 0, gas: 0, garbage: 0,
            bashaUti: 0, pani: 0, bua: 0, extra: 0
          },
          adjustments: defaultAdjustments
        });
      }

      await monthlyBill.save();
    }

    return res.status(200).json(monthlyBill);
  } catch (error) {
    console.error('Error fetching monthly bill config:', error);
    return res.status(500).json({ error: 'Internal server error fetching monthly bills' });
  }
};

exports.saveMonthlyBill = async (req, res) => {
  try {
    const { monthId, rent, utilities, adjustments, utilityNotes } = req.body;
    const homeId = req.user.homeId;

    if (!monthId) {
      return res.status(400).json({ error: 'monthId is required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    const home = await Home.findById(homeId);
    if (!home) {
      return res.status(404).json({ error: 'Home not found.' });
    }

    const isOwner = home.admin.toString() === req.user._id.toString();
    const hasPermission = isOwner || (home.utilityControlMembers && home.utilityControlMembers.map(id => id.toString()).includes(req.user._id.toString()));

    let monthlyBill = await MonthlyBill.findOne({ monthId, homeId });
    if (!monthlyBill) {
      monthlyBill = new MonthlyBill({ monthId, homeId });
    }

    const oldKeys = Array.from(monthlyBill.utilities.keys());
    const newKeys = Object.keys(utilities || {});
    const addedKeys = newKeys.filter(k => !oldKeys.includes(k));
    const deletedKeys = oldKeys.filter(k => !newKeys.includes(k));

    if ((addedKeys.length > 0 || deletedKeys.length > 0) && !hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to add or delete utility categories.' });
    }

    // Build changes history diff
    const users = await User.find({ homeId });
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u.name; });

    const changes = [];

    // Utilities diff
    newKeys.forEach(k => {
      const oldVal = monthlyBill.utilities.get(k) || 0;
      const newVal = parseFloat(utilities[k]) || 0;
      if (!oldKeys.includes(k)) {
        changes.push({
          field: `utilities.${k}`,
          oldValue: null,
          newValue: newVal,
          detail: `Added utility category '${k}' with bill ৳${newVal.toFixed(2)}`
        });
      } else if (oldVal !== newVal) {
        changes.push({
          field: `utilities.${k}`,
          oldValue: oldVal,
          newValue: newVal,
          detail: `Updated utility '${k}' from ৳${oldVal.toFixed(2)} to ৳${newVal.toFixed(2)}`
        });
      }
    });
    deletedKeys.forEach(k => {
      const oldVal = monthlyBill.utilities.get(k) || 0;
      changes.push({
        field: `utilities.${k}`,
        oldValue: oldVal,
        newValue: null,
        detail: `Deleted utility category '${k}' (was ৳${oldVal.toFixed(2)})`
      });
    });

    // Rent diff
    if (rent) {
      Object.keys(rent).forEach(uid => {
        const oldVal = monthlyBill.rent.get(uid) || 0;
        const newVal = parseFloat(rent[uid]) || 0;
        if (oldVal !== newVal) {
          const uName = userMap[uid] || 'Roommate';
          changes.push({
            field: `rent.${uid}`,
            oldValue: oldVal,
            newValue: newVal,
            detail: `Updated rent share for ${uName} from ৳${oldVal.toFixed(2)} to ৳${newVal.toFixed(2)}`
          });
        }
      });
    }

    // Adjustments diff
    if (adjustments) {
      adjustments.forEach(adj => {
        const oldAdj = monthlyBill.adjustments.find(a => a.user && a.user.toString() === adj.user.toString());
        if (oldAdj) {
          const uName = userMap[adj.user.toString()] || 'Roommate';
          if (oldAdj.prevUtilityDue !== adj.prevUtilityDue) {
            changes.push({
              field: `adjustments.${adj.user}.prevUtilityDue`,
              oldValue: oldAdj.prevUtilityDue,
              newValue: adj.prevUtilityDue,
              detail: `Updated previous utility due for ${uName} from ৳${oldAdj.prevUtilityDue.toFixed(2)} to ৳${adj.prevUtilityDue.toFixed(2)}`
            });
          }
          if (oldAdj.prevMealDue !== adj.prevMealDue) {
            changes.push({
              field: `adjustments.${adj.user}.prevMealDue`,
              oldValue: oldAdj.prevMealDue,
              newValue: adj.prevMealDue,
              detail: `Updated previous meal due for ${uName} from ৳${oldAdj.prevMealDue.toFixed(2)} to ৳${adj.prevMealDue.toFixed(2)}`
            });
          }
          if (oldAdj.utilityPayment !== adj.utilityPayment) {
            changes.push({
              field: `adjustments.${adj.user}.utilityPayment`,
              oldValue: oldAdj.utilityPayment,
              newValue: adj.utilityPayment,
              detail: `Updated utility payment for ${uName} from ৳${oldAdj.utilityPayment.toFixed(2)} to ৳${adj.utilityPayment.toFixed(2)}`
            });
          }
          if (oldAdj.rentPayment !== adj.rentPayment) {
            changes.push({
              field: `adjustments.${adj.user}.rentPayment`,
              oldValue: oldAdj.rentPayment || 0,
              newValue: adj.rentPayment,
              detail: `Updated rent payment for ${uName} from ৳${(oldAdj.rentPayment || 0).toFixed(2)} to ৳${adj.rentPayment.toFixed(2)}`
            });
          }
        }
      });
    }

    if (rent) monthlyBill.rent = rent;
    if (utilities) monthlyBill.utilities = utilities;
    if (adjustments) monthlyBill.adjustments = adjustments;
    if (utilityNotes) monthlyBill.utilityNotes = utilityNotes;

    await monthlyBill.save();

    const logDetails = changes.length > 0 
      ? changes.map(c => c.detail).join('; ')
      : `Updated bill configuration for ${monthId}`;

    await logChange({
      monthId,
      homeId,
      action: 'UPDATE_BILL_CONFIG',
      entity: 'MonthlyBill',
      entityId: monthlyBill._id.toString(),
      userId: req.user._id,
      userName: req.user.name,
      changes: changes.length > 0 ? changes : [{
        field: 'config',
        oldValue: null,
        newValue: null,
        detail: logDetails
      }]
    });

    return res.status(200).json({ message: 'Monthly bill configurations saved successfully', data: monthlyBill });
  } catch (error) {
    console.error('Error saving monthly bill config:', error);
    return res.status(500).json({ error: 'Internal server error saving monthly bills' });
  }
};
