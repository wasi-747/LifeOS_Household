const MonthConfig = require('../models/MonthConfig');
const MonthlyBill = require('../models/MonthlyBill');
const DailyMeal = require('../models/DailyMeal');
const Transaction = require('../models/Transaction');
const BazarWallet = require('../models/BazarWallet');
const User = require('../models/User');
const { logChange } = require('./auditController');

// Ordered month names for sorting
const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Parse a monthId like "July-2026" into { monthName, monthIndex, year }
 */
const parseMonthId = (mId) => {
  const parts = mId.split('-');
  if (parts.length !== 2) return null;
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  const monthIndex = MONTH_ORDER.indexOf(monthName);
  if (monthIndex === -1 || isNaN(year)) return null;
  return { monthName, monthIndex, year };
};

/**
 * Get the next month's ID given a current monthId
 */
const getNextMonthId = (monthId) => {
  const parsed = parseMonthId(monthId);
  if (!parsed) return null;
  let nextMonth = parsed.monthIndex + 1;
  let nextYear = parsed.year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  return `${MONTH_ORDER[nextMonth]}-${nextYear}`;
};

/**
 * GET /months — List all months that have any data for the home
 */
exports.listMonths = async (req, res) => {
  try {
    const homeId = req.user.homeId;
    if (!homeId) {
      return res.status(200).json({ months: [] });
    }

    // Gather distinct monthIds from all collections, filtered by homeId
    const [configMonths, billMonths, txMonths, mealMonths, walletMonths] = await Promise.all([
      MonthConfig.distinct('monthId', { homeId }),
      MonthlyBill.distinct('monthId', { homeId }),
      Transaction.distinct('monthId', { homeId }),
      DailyMeal.distinct('monthId', { homeId }),
      BazarWallet.distinct('monthId', { homeId })
    ]);

    const allMonths = new Set([...configMonths, ...billMonths, ...txMonths, ...mealMonths, ...walletMonths]);

    // Sort chronologically
    const sorted = Array.from(allMonths).sort((a, b) => {
      const pa = parseMonthId(a);
      const pb = parseMonthId(b);
      if (!pa || !pb) return 0;
      if (pa.year !== pb.year) return pb.year - pa.year; // newest first
      return pb.monthIndex - pa.monthIndex;
    });

    // If no months exist, seed the current month
    if (sorted.length === 0) {
      const now = new Date();
      const currentMonthId = `${MONTH_ORDER[now.getMonth()]}-${now.getFullYear()}`;
      sorted.push(currentMonthId);
    }

    return res.status(200).json({ months: sorted });
  } catch (error) {
    console.error('Error listing months:', error);
    return res.status(500).json({ error: 'Internal server error listing months' });
  }
};

/**
 * POST /months — Create a new month with automatic carryover from the previous month
 * Body: { previousMonthId: "July-2026" }
 */
exports.createMonth = async (req, res) => {
  try {
    const { previousMonthId } = req.body;
    const homeId = req.user.homeId;

    if (!previousMonthId) {
      return res.status(400).json({ error: 'previousMonthId is required' });
    }
    if (!homeId) {
      return res.status(400).json({ error: 'User does not belong to a home.' });
    }

    const newMonthId = getNextMonthId(previousMonthId);
    if (!newMonthId) {
      return res.status(400).json({ error: 'Invalid previousMonthId format' });
    }

    // Check if the new month already has data in this home
    const existingBill = await MonthlyBill.findOne({ monthId: newMonthId, homeId });
    if (existingBill) {
      return res.status(409).json({ error: `Month ${newMonthId} already exists`, monthId: newMonthId });
    }

    // Load users in this home only
    const users = await User.find({ homeId });

    // ---- Calculate previous month's final standings for carryover ----
    const prevBill = await MonthlyBill.findOne({ monthId: previousMonthId, homeId });
    const prevTransactions = await Transaction.find({ monthId: previousMonthId, homeId });
    const prevDailyMeals = await DailyMeal.find({ monthId: previousMonthId, homeId });
    const prevWallet = await BazarWallet.findOne({ monthId: previousMonthId, homeId }) || { transfers: [] };

    // Calculate meal rate
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

    // Calculate total utilities from previous month
    let totalUtilities = 0;
    if (prevBill) {
      if (prevBill.utilities instanceof Map) {
        totalUtilities = Array.from(prevBill.utilities.values()).reduce((sum, v) => sum + (v || 0), 0);
      } else {
        totalUtilities = Object.values(prevBill.utilities || {}).reduce((sum, v) => sum + (v || 0), 0);
      }
    }

    // Build carryover adjustments per user
    const newAdjustments = [];
    const newRent = {};
    const carryDetails = [];

    users.forEach(user => {
      const uid = user._id.toString();

      // Calculate user's previous month final dues
      let userTotalMeals = 0;
      prevDailyMeals.forEach(dm => {
        if (dm.meals && Array.isArray(dm.meals)) {
          dm.meals.forEach(m => {
            if (m.user && m.user.toString() === uid) {
              userTotalMeals += (m.count || 0);
            }
          });
        }
      });

      const mealCostPortion = userTotalMeals * mealRate;
      const prevAdj = prevBill ? prevBill.adjustments.find(a => a.user && a.user.toString() === uid) : null;
      const prevMealDue = prevAdj ? prevAdj.prevMealDue : 0;
      const prevUtilityDue = prevAdj ? prevAdj.prevUtilityDue : 0;
      const utilityPayment = prevAdj ? prevAdj.utilityPayment : 0;
      const rentPayment = prevAdj ? (prevAdj.rentPayment || 0) : 0;
      const rentPortion = prevBill ? (prevBill.rent.get(uid) || 0) : 0;
      const utilityShare = users.length > 0 ? totalUtilities / users.length : 0;
      const utilityPortion = prevUtilityDue + utilityShare - utilityPayment;

      const totalDeposits = prevTransactions
        .filter(tx => tx.type === 'DEPOSIT' && tx.paidBy && tx.paidBy.toString() === uid)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      const walletReceived = prevWallet.transfers
        .filter(t => t.to && t.to.toString() === uid)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const walletGiven = prevWallet.transfers
        .filter(t => t.from && t.from.toString() === uid)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const walletSpent = prevTransactions
        .filter(tx => tx.type === 'BAZAR' && tx.paidBy && tx.paidBy.toString() === uid)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const walletBalance = walletReceived - walletSpent - walletGiven;

      const foodDue = mealCostPortion + prevMealDue - totalDeposits;
      const utilityDue = utilityPortion;
      const rentDue = rentPortion - rentPayment;

      // Carry forward: food due and utility due go into new month's prev adjustments
      newAdjustments.push({
        user: user._id,
        prevMealDue: Number(foodDue.toFixed(2)),
        prevUtilityDue: Number(utilityDue.toFixed(2)),
        utilityPayment: 0,
        rentPayment: 0,
        note: `Carried from ${previousMonthId}`
      });

      // Copy rent from previous month
      newRent[uid] = rentPortion;

      carryDetails.push(`${user.name}: Food Due ৳${foodDue.toFixed(2)}, Utility Due ৳${utilityDue.toFixed(2)}`);
    });

    // Copy utility bill structure dynamically from previous month
    const newUtilities = new Map();
    if (prevBill) {
      if (prevBill.utilities instanceof Map) {
        for (const [k, v] of prevBill.utilities.entries()) {
          newUtilities.set(k, v || 0);
        }
      } else {
        for (const k of Object.keys(prevBill.utilities || {})) {
          newUtilities.set(k, prevBill.utilities[k] || 0);
        }
      }
    } else {
      newUtilities.set('wifi', 0);
      newUtilities.set('electricity', 0);
      newUtilities.set('gas', 0);
      newUtilities.set('garbage', 0);
      newUtilities.set('bashaUti', 0);
      newUtilities.set('pani', 0);
      newUtilities.set('bua', 0);
      newUtilities.set('extra', 0);
    }

    // Create the new month's MonthlyBill
    const newBill = await MonthlyBill.create({
      monthId: newMonthId,
      homeId,
      rent: newRent,
      utilities: newUtilities,
      adjustments: newAdjustments,
      utilityNotes: {}
    });

    // Create MonthConfig with standard days
    const parsed = parseMonthId(newMonthId);
    const daysInNewMonth = parsed ? new Date(parsed.year, parsed.monthIndex + 1, 0).getDate() : 30;
    await MonthConfig.create({ monthId: newMonthId, homeId, days: daysInNewMonth });

    // Create empty BazarWallet
    await BazarWallet.create({ monthId: newMonthId, homeId, transfers: [] });

    // Audit log
    await logChange({
      monthId: newMonthId,
      homeId,
      action: 'CREATE_MONTH',
      entity: 'MonthlyBill',
      entityId: newBill._id.toString(),
      userId: req.user._id,
      userName: req.user.name,
      changes: [{
        field: 'monthId',
        oldValue: previousMonthId,
        newValue: newMonthId,
        detail: `Created ${newMonthId} with dues carried from ${previousMonthId}. ${carryDetails.join('; ')}`
      }]
    });

    return res.status(201).json({
      message: `Month ${newMonthId} created with dues carried from ${previousMonthId}`,
      monthId: newMonthId,
      bill: newBill
    });
  } catch (error) {
    console.error('Error creating month:', error);
    return res.status(500).json({ error: 'Internal server error creating month' });
  }
};
