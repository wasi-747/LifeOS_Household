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

    // Calculate individual utility shares based on custom split rules per utility item
    const calculateUserUtilityShares = (utilities, splitRules, usersList) => {
      const sharesMap = new Map();
      usersList.forEach(u => sharesMap.set(u._id.toString(), 0));

      if (!utilities || usersList.length === 0) return sharesMap;

      const utilEntries = utilities instanceof Map ? Array.from(utilities.entries()) : Object.entries(utilities);

      utilEntries.forEach(([key, val]) => {
        const billAmount = parseFloat(val) || 0;
        if (billAmount <= 0) return;

        let rule = null;
        if (splitRules) {
          if (splitRules instanceof Map) {
            rule = splitRules.get(key);
          } else if (typeof splitRules === 'object') {
            rule = splitRules[key];
          }
        }

        const mode = rule && rule.mode ? rule.mode : 'equal';
        const customValObj = rule && rule.customValues ? (rule.customValues instanceof Map ? Object.fromEntries(rule.customValues) : rule.customValues) : {};

        if (mode === 'weighted') {
          let totalWeight = 0;
          const userWeights = {};
          usersList.forEach(u => {
            const uid = u._id.toString();
            const w = parseFloat(customValObj[uid]) > 0 ? parseFloat(customValObj[uid]) : 1;
            userWeights[uid] = w;
            totalWeight += w;
          });

          usersList.forEach(u => {
            const uid = u._id.toString();
            const userShare = totalWeight > 0 ? (billAmount * (userWeights[uid] / totalWeight)) : (billAmount / usersList.length);
            sharesMap.set(uid, sharesMap.get(uid) + userShare);
          });
        } else if (mode === 'surcharge') {
          let totalSurcharges = 0;
          const userSurcharges = {};
          usersList.forEach(u => {
            const uid = u._id.toString();
            const s = parseFloat(customValObj[uid]) || 0;
            userSurcharges[uid] = s;
            totalSurcharges += s;
          });

          const remainingAmount = Math.max(0, billAmount - totalSurcharges);
          const baseShare = remainingAmount / usersList.length;

          usersList.forEach(u => {
            const uid = u._id.toString();
            const userShare = baseShare + (userSurcharges[uid] || 0);
            sharesMap.set(uid, sharesMap.get(uid) + userShare);
          });
        } else if (mode === 'fixed') {
          let totalFixed = 0;
          const fixedUsers = [];
          const nonFixedUsers = [];

          usersList.forEach(u => {
            const uid = u._id.toString();
            if (customValObj[uid] !== undefined && customValObj[uid] !== null && customValObj[uid] !== '') {
              const f = parseFloat(customValObj[uid]) || 0;
              totalFixed += f;
              fixedUsers.push({ uid, amount: f });
            } else {
              nonFixedUsers.push(uid);
            }
          });

          const remainingAmount = Math.max(0, billAmount - totalFixed);
          const remainingShare = nonFixedUsers.length > 0 ? (remainingAmount / nonFixedUsers.length) : 0;

          fixedUsers.forEach(item => {
            sharesMap.set(item.uid, sharesMap.get(item.uid) + item.amount);
          });
          nonFixedUsers.forEach(uid => {
            sharesMap.set(uid, sharesMap.get(uid) + remainingShare);
          });
        } else {
          const equalShare = billAmount / usersList.length;
          usersList.forEach(u => {
            const uid = u._id.toString();
            sharesMap.set(uid, sharesMap.get(uid) + equalShare);
          });
        }
      });

      return sharesMap;
    };

    const utilitySharesMap = calculateUserUtilityShares(monthlyBill.utilities, monthlyBill.utilitySplitRules, users);

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

      // Utility share computed via custom rules per utility
      const utilityShare = utilitySharesMap.get(userIdStr) || 0;
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

    // Calculate Utility and Rent Summaries with Auto DONE status
    const defaultCategoryLabels = {
      wifi: "WiFi Internet",
      electricity: "Electricity",
      gas: "Gas / Fuel",
      garbage: "Garbage Collection",
      bashaUti: "Building Maintenance",
      pani: "Water Supply (Pani)",
      bua: "Cook / Maid (Bua)",
      extra: "Miscellaneous Extra"
    };

    const utilityTxs = transactions.filter(tx => tx.type === 'UTILITY');
    const utilKeys = monthlyBill.utilities instanceof Map 
      ? Array.from(monthlyBill.utilities.keys()) 
      : Object.keys(monthlyBill.utilities || {});

    const categoryDetails = {};
    let totalUtilityPaidToProviders = 0;

    utilKeys.forEach(catKey => {
      const targetAmount = monthlyBill.utilities instanceof Map 
        ? (parseFloat(monthlyBill.utilities.get(catKey)) || 0)
        : (parseFloat(monthlyBill.utilities[catKey]) || 0);

      const catTxs = utilityTxs.filter(tx => tx.category && tx.category.toLowerCase().trim() === catKey.toLowerCase().trim());
      const paidAmount = catTxs.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
      totalUtilityPaidToProviders += paidAmount;

      const remaining = Math.max(0, targetAmount - paidAmount);
      const isDone = targetAmount > 0 && paidAmount >= targetAmount;
      const percent = targetAmount > 0 ? Math.min(100, Math.round((paidAmount / targetAmount) * 100)) : (paidAmount > 0 ? 100 : 0);

      const note = monthlyBill.utilityNotes instanceof Map 
        ? (monthlyBill.utilityNotes.get(catKey) || '') 
        : (monthlyBill.utilityNotes?.[catKey] || '');

      const label = defaultCategoryLabels[catKey] || (catKey.charAt(0).toUpperCase() + catKey.slice(1));

      const payments = catTxs.map(tx => {
        const pUser = users.find(u => u._id.toString() === (tx.paidBy ? tx.paidBy.toString() : ''));
        return {
          _id: tx._id,
          amount: tx.amount,
          paidBy: pUser ? { _id: pUser._id, name: pUser.name } : null,
          date: tx.date,
          note: tx.note || ''
        };
      });

      categoryDetails[catKey] = {
        key: catKey,
        label,
        targetAmount: Number(targetAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        remaining: Number(remaining.toFixed(2)),
        percent,
        isDone,
        note,
        payments
      };
    });

    const generalTxs = utilityTxs.filter(tx => ['general_deposit', 'general', 'deposit', 'pool', 'share'].includes((tx.category || '').toLowerCase().trim()));
    const totalGeneralDeposits = generalTxs.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const generalPayments = generalTxs.map(tx => {
      const pUser = users.find(u => u._id.toString() === (tx.paidBy ? tx.paidBy.toString() : ''));
      return {
        _id: tx._id,
        amount: tx.amount,
        paidBy: pUser ? { _id: pUser._id, name: pUser.name } : null,
        date: tx.date,
        note: tx.note || ''
      };
    });

    const totalUtilityCollectedFromRoommates = userStandings.reduce((sum, u) => sum + (u.utilityPayment || 0), 0);
    const totalUtilityRemaining = Math.max(0, totalUtilities - totalUtilityPaidToProviders);
    const utilityFundInHand = Math.max(0, totalUtilityCollectedFromRoommates - totalUtilityPaidToProviders);
    const isUtilityDone = totalUtilities > 0 && totalUtilityPaidToProviders >= totalUtilities;

    const utilitySummary = {
      totalBill: Number(totalUtilities.toFixed(2)),
      totalCollected: Number(totalUtilityCollectedFromRoommates.toFixed(2)),
      totalPaid: Number(totalUtilityPaidToProviders.toFixed(2)),
      totalRemaining: Number(totalUtilityRemaining.toFixed(2)),
      fundInHand: Number(utilityFundInHand.toFixed(2)),
      totalGeneralDeposits: Number(totalGeneralDeposits.toFixed(2)),
      generalPayments,
      isDone: isUtilityDone,
      categories: categoryDetails
    };

    // Rent Summary
    let totalHouseRent = 0;
    let totalHouseRentPaid = 0;
    const rentBreakdown = users.map(u => {
      const uid = u._id.toString();
      const rentPortion = monthlyBill.rent instanceof Map ? (monthlyBill.rent.get(uid) || 0) : (monthlyBill.rent?.[uid] || 0);
      const adj = monthlyBill.adjustments.find(a => a.user && a.user.toString() === uid);
      const rentPayment = adj ? (adj.rentPayment || 0) : 0;
      const rentDue = Math.max(0, rentPortion - rentPayment);
      const isDone = rentPortion > 0 && rentPayment >= rentPortion;

      totalHouseRent += rentPortion;
      totalHouseRentPaid += rentPayment;

      return {
        userId: u._id,
        name: u.name,
        rentPortion: Number(rentPortion.toFixed(2)),
        rentPayment: Number(rentPayment.toFixed(2)),
        rentDue: Number(rentDue.toFixed(2)),
        isDone
      };
    });

    const totalRentRemaining = Math.max(0, totalHouseRent - totalHouseRentPaid);
    const isRentDone = totalHouseRent > 0 && totalHouseRentPaid >= totalHouseRent;

    const rentSummary = {
      totalRent: Number(totalHouseRent.toFixed(2)),
      totalPaid: Number(totalHouseRentPaid.toFixed(2)),
      totalRemaining: Number(totalRentRemaining.toFixed(2)),
      isDone: isRentDone,
      roommateBreakdown: rentBreakdown
    };

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
      userStandings,
      utilitySummary,
      rentSummary
    });
  } catch (error) {
    console.error('Error calculating month summary:', error);
    return res.status(500).json({ error: 'Internal server error calculating summary' });
  }
};
