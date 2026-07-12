const User = require('../models/User');
const DailyMeal = require('../models/DailyMeal');
const Transaction = require('../models/Transaction');
const DeviceTelemetry = require('../models/DeviceTelemetry');
const MonthlyBill = require('../models/MonthlyBill');
const BazarWallet = require('../models/BazarWallet');

// Helper to parse monthId to Date range
const parseMonthId = (mId) => {
  const parts = mId.split('-');
  if (parts.length !== 2) return null;
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  const months = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
  };
  const monthIndex = months[monthName];
  if (monthIndex === undefined || isNaN(year)) return null;
  
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  return { startDate, endDate };
};

exports.getSummary = async (req, res) => {
  try {
    const { monthId } = req.params;
    const homeId = req.user.homeId;

    if (!monthId) {
      return res.status(400).json({ error: 'monthId parameter is required' });
    }
    if (!homeId) {
      return res.status(200).json({
        monthId,
        totalMealCost: 0,
        totalMeals: 0,
        mealRate: 0,
        userStandings: []
      });
    }

    // 1. Fetch Users, Transactions, and Daily Meals scoped to homeId
    const users = await User.find({ homeId });
    const transactions = await Transaction.find({ monthId, homeId });
    const dailyMeals = await DailyMeal.find({ monthId, homeId });

    // 2. Fetch Telemetry records scoped to homeId
    const dateRange = parseMonthId(monthId);
    let telemetries = [];
    if (dateRange) {
      telemetries = await DeviceTelemetry.find({
        homeId,
        timestamp: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      }).populate('ownerId', 'name');
    }

    // Fetch MonthlyBill configuration
    let monthlyBill = await MonthlyBill.findOne({ monthId, homeId });
    if (!monthlyBill) {
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
      await monthlyBill.save();
    } else {
      let modified = false;
      users.forEach(u => {
        const uIdStr = u._id.toString();
        const hasAdj = monthlyBill.adjustments.some(a => a.user && a.user.toString() === uIdStr);
        if (!hasAdj) {
          monthlyBill.adjustments.push({
            user: u._id,
            prevUtilityDue: 0,
            prevMealDue: 0,
            utilityPayment: 0,
            rentPayment: 0,
            note: ''
          });
          modified = true;
        }
        if (!monthlyBill.rent || !monthlyBill.rent.has(uIdStr)) {
          if (!monthlyBill.rent) {
            monthlyBill.rent = new Map();
          }
          monthlyBill.rent.set(uIdStr, 0);
          modified = true;
        }
      });
      if (modified) {
        await monthlyBill.save();
      }
    }

    // Fetch BazarWallet for wallet balances
    let bazarWallet = await BazarWallet.findOne({ monthId, homeId });
    if (!bazarWallet) {
      bazarWallet = { transfers: [] };
    }

    const totalUsersCount = users.length;
    if (totalUsersCount === 0) {
      return res.status(200).json({
        monthId,
        totalMealCost: 0,
        totalMeals: 0,
        mealRate: 0,
        userStandings: []
      });
    }

    // 3. Calculate Total Meal Cost (type === 'BAZAR')
    const totalMealCost = transactions
      .filter(tx => tx.type === 'BAZAR')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // 4. Calculate Total Meals
    let totalMeals = 0;
    dailyMeals.forEach(dm => {
      if (dm.meals && Array.isArray(dm.meals)) {
        dm.meals.forEach(m => {
          totalMeals += (m.count || 0);
        });
      }
    });

    // 5. Calculate Meal Rate
    const mealRate = totalMeals > 0 ? (totalMealCost / totalMeals) : 0;

    // Calculate total utilities dynamically
    let totalUtilities = 0;
    if (monthlyBill.utilities instanceof Map) {
      totalUtilities = Array.from(monthlyBill.utilities.values()).reduce((sum, v) => sum + (v || 0), 0);
    } else {
      totalUtilities = Object.values(monthlyBill.utilities || {}).reduce((sum, v) => sum + (v || 0), 0);
    }

    const totalLogsCount = telemetries.length;

    // 6. Calculate standings for each user
    const userStandings = users.map(user => {
      const userIdStr = user._id.toString();

      // User's Total Meals count
      let userTotalMeals = 0;
      dailyMeals.forEach(dm => {
        if (dm.meals && Array.isArray(dm.meals)) {
          dm.meals.forEach(m => {
            if (m.user && m.user.toString() === userIdStr) {
              userTotalMeals += (m.count || 0);
            }
          });
        }
      });

      // User's Portion of Bazar (Meals)
      const mealCostPortion = userTotalMeals * mealRate;

      // Retrieve adjustments for this user
      const adj = monthlyBill.adjustments.find(a => a.user && a.user.toString() === userIdStr);
      const prevMealDue = adj ? adj.prevMealDue : 0;
      const prevUtilityDue = adj ? adj.prevUtilityDue : 0;
      const utilityPayment = adj ? adj.utilityPayment : 0;
      const rentPayment = adj ? (adj.rentPayment || 0) : 0;

      // Rent Portion
      const rentPortion = monthlyBill.rent.get(userIdStr) || 0;

      // Utility share and portion
      const utilityShare = totalUtilities / users.length;
      const utilityPortion = prevUtilityDue + utilityShare - utilityPayment;

      // User's Telemetry Log count
      const userLogsCount = telemetries.filter(t => t.ownerId && t.ownerId.toString() === userIdStr).length;
      const usageHours = (userLogsCount * 5) / 60;
      const usagePercent = totalLogsCount > 0 ? (userLogsCount / totalLogsCount) * 100 : 0;

      // User's Total Deposits (Given for Meal)
      const totalDeposits = transactions
        .filter(tx => tx.type === 'DEPOSIT' && tx.paidBy && tx.paidBy.toString() === userIdStr)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      // Bazar wallet balances & Out-of-pocket spent
      const walletReceived = bazarWallet.transfers
        .filter(t => t.to && t.to.toString() === userIdStr)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const walletGiven = bazarWallet.transfers
        .filter(t => t.from && t.from.toString() === userIdStr)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const walletSpent = transactions
        .filter(tx => tx.type === 'BAZAR' && tx.paidBy && tx.paidBy.toString() === userIdStr)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const walletBalance = walletReceived - walletSpent - walletGiven;
      const netBazarPaid = walletGiven - walletReceived + walletSpent;

      // Separated final dues
      const foodDue = mealCostPortion + prevMealDue - totalDeposits;
      const utilityDue = utilityPortion;
      const rentDue = rentPortion - rentPayment;
      const finalDue = foodDue + utilityDue + rentDue + walletBalance;

      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userTotalMeals,
        usageHours: Number(usageHours.toFixed(2)),
        usagePercent: Number(usagePercent.toFixed(2)),
        mealCostPortion: Number(mealCostPortion.toFixed(2)),
        prevMealDue: Number(prevMealDue.toFixed(2)),
        utilityPortion: Number(utilityPortion.toFixed(2)),
        prevUtilityDue: Number(prevUtilityDue.toFixed(2)),
        utilityShare: Number(utilityShare.toFixed(2)),
        utilityPayment: Number(utilityPayment.toFixed(2)),
        rentPortion: Number(rentPortion.toFixed(2)),
        rentPayment: Number(rentPayment.toFixed(2)),
        totalDeposits: Number(totalDeposits.toFixed(2)),
        netBazarPaid: Number(netBazarPaid.toFixed(2)),
        foodDue: Number(foodDue.toFixed(2)),
        utilityDue: Number(utilityDue.toFixed(2)),
        rentDue: Number(rentDue.toFixed(2)),
        finalDue: Number(finalDue.toFixed(2)),
        walletReceived: Number(walletReceived.toFixed(2)),
        walletGiven: Number(walletGiven.toFixed(2)),
        walletSpent: Number(walletSpent.toFixed(2)),
        walletBalance: Number(walletBalance.toFixed(2)),
        note: adj ? (adj.note || '') : ''
      };
    });

    // Calculate device usage metrics
    const deviceMap = {};
    if (dateRange && telemetries.length > 0) {
      telemetries.forEach(t => {
        if (t.deviceId) {
          if (!deviceMap[t.deviceId]) {
            deviceMap[t.deviceId] = {
              deviceId: t.deviceId,
              ownerName: t.ownerId && t.ownerId.name ? t.ownerId.name : 'Unknown',
              logsCount: 0
            };
          }
          deviceMap[t.deviceId].logsCount += 1;
        }
      });
    }

    const deviceUsages = Object.values(deviceMap).map(d => {
      const usageHours = (d.logsCount * 5) / 60;
      const usagePercent = totalLogsCount > 0 ? (d.logsCount / totalLogsCount) * 100 : 0;
      return {
        deviceId: d.deviceId,
        ownerName: d.ownerName,
        usageHours: Number(usageHours.toFixed(2)),
        usagePercent: Number(usagePercent.toFixed(2))
      };
    });

    return res.status(200).json({
      monthId,
      totalMealCost,
      totalMeals,
      totalUtilities,
      mealRate: Number(mealRate.toFixed(4)),
      monthlyBill,
      deviceUsages,
      userStandings
    });
  } catch (error) {
    console.error('Error calculating month summary:', error);
    return res.status(500).json({ error: 'Internal server error calculating summary' });
  }
};
