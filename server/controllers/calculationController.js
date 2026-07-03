const User = require('../models/User');
const DailyMeal = require('../models/DailyMeal');
const Transaction = require('../models/Transaction');
const DeviceTelemetry = require('../models/DeviceTelemetry');

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

    if (!monthId) {
      return res.status(400).json({ error: 'monthId parameter is required' });
    }

    // 1. Fetch Users, Transactions, and Daily Meals
    const users = await User.find({});
    const transactions = await Transaction.find({ monthId });
    const dailyMeals = await DailyMeal.find({ monthId });

    // 2. Fetch Telemetry records in the monthId date range
    const dateRange = parseMonthId(monthId);
    let telemetries = [];
    if (dateRange) {
      telemetries = await DeviceTelemetry.find({
        timestamp: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      });
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

    // 4. Calculate Total Meals (sum of counts in meals arrays across all DailyMeals)
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

      // User's Telemetry Log count (each log represents 5 mins)
      const userLogsCount = telemetries.filter(t => t.ownerId && t.ownerId.toString() === userIdStr).length;
      const usageHours = (userLogsCount * 5) / 60;
      const usagePercent = totalLogsCount > 0 ? (userLogsCount / totalLogsCount) * 100 : 0;

      // User's Portion of UTILITY
      let utilityPortion = 0;
      const utilityTransactions = transactions.filter(tx => tx.type === 'UTILITY');
      utilityTransactions.forEach(tx => {
        if (tx.splitType === 'EQUAL') {
          utilityPortion += (tx.amount || 0) / totalUsersCount;
        } else if (tx.splitType === 'CUSTOM' || tx.splitType === 'INDIVIDUAL') {
          const splitItem = tx.splitAmong.find(s => s.user && s.user.toString() === userIdStr);
          if (splitItem) {
            utilityPortion += (splitItem.amountOwed || 0);
          }
        } else if (tx.splitType === 'MEAL_RATE') {
          const userMealRatio = totalMeals > 0 ? (userTotalMeals / totalMeals) : 0;
          utilityPortion += (tx.amount || 0) * userMealRatio;
        } else if (tx.splitType === 'TELEMETRY_BASED') {
          const ratio = totalLogsCount > 0 ? (userLogsCount / totalLogsCount) : (1 / totalUsersCount);
          utilityPortion += (tx.amount || 0) * ratio;
        }
      });

      // User's Portion of RENT
      let rentPortion = 0;
      const rentTransactions = transactions.filter(tx => tx.type === 'RENT');
      rentTransactions.forEach(tx => {
        if (tx.splitType === 'EQUAL') {
          rentPortion += (tx.amount || 0) / totalUsersCount;
        } else if (tx.splitType === 'CUSTOM' || tx.splitType === 'INDIVIDUAL') {
          const splitItem = tx.splitAmong.find(s => s.user && s.user.toString() === userIdStr);
          if (splitItem) {
            rentPortion += (splitItem.amountOwed || 0);
          }
        } else if (tx.splitType === 'MEAL_RATE') {
          const userMealRatio = totalMeals > 0 ? (userTotalMeals / totalMeals) : 0;
          rentPortion += (tx.amount || 0) * userMealRatio;
        } else if (tx.splitType === 'TELEMETRY_BASED') {
          const ratio = totalLogsCount > 0 ? (userLogsCount / totalLogsCount) : (1 / totalUsersCount);
          rentPortion += (tx.amount || 0) * ratio;
        }
      });

      // User's Total Deposits (Deposits made by the user)
      const totalDeposits = transactions
        .filter(tx => tx.type === 'DEPOSIT' && tx.paidBy && tx.paidBy.toString() === userIdStr)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      // Final standing/due calculation:
      // (Meals * Rate) + Utility portion + Rent portion - Deposits
      const finalDue = mealCostPortion + utilityPortion + rentPortion - totalDeposits;

      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userTotalMeals,
        usageHours: Number(usageHours.toFixed(2)),
        usagePercent: Number(usagePercent.toFixed(2)),
        mealCostPortion: Number(mealCostPortion.toFixed(4)),
        utilityPortion: Number(utilityPortion.toFixed(4)),
        rentPortion: Number(rentPortion.toFixed(4)),
        totalDeposits: Number(totalDeposits.toFixed(4)),
        finalDue: Number(finalDue.toFixed(4))
      };
    });

    // Check if there are any telemetry-split transactions in the month
    const hasTelemetryUtility = transactions.some(tx => tx.type === 'UTILITY' && tx.splitType === 'TELEMETRY_BASED');

    return res.status(200).json({
      monthId,
      totalMealCost,
      totalMeals,
      mealRate: Number(mealRate.toFixed(4)),
      hasTelemetryUtility,
      userStandings
    });
  } catch (error) {
    console.error('Error calculating month summary:', error);
    return res.status(500).json({ error: 'Internal server error calculating summary' });
  }
};
