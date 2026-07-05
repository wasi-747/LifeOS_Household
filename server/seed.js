const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const DailyMeal = require('./models/DailyMeal');
const Transaction = require('./models/Transaction');
const DeviceTelemetry = require('./models/DeviceTelemetry');
const MonthConfig = require('./models/MonthConfig');
const MonthlyBill = require('./models/MonthlyBill');
const BazarWallet = require('./models/BazarWallet');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lifeos_household';

async function seed() {
  try {
    console.log('Connecting to MongoDB Atlas to seed MERN & Telemetry data...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected. Clearing all collections...');

    await User.deleteMany({});
    await DailyMeal.deleteMany({});
    await Transaction.deleteMany({});
    await DeviceTelemetry.deleteMany({});
    await MonthConfig.deleteMany({});
    await MonthlyBill.deleteMany({});
    await BazarWallet.deleteMany({});
    console.log('Collections cleared.');

    // 1. Create Roommate Users
    console.log('Creating users...');
    const users = await User.create([
      { name: 'Wasiur', email: 'wasiur@lifeos.com', role: 'admin', currentBalance: 0 },
      { name: 'Zesrab', email: 'zesrab@lifeos.com', role: 'member', currentBalance: 0 },
      { name: 'Borno', email: 'borno@lifeos.com', role: 'member', currentBalance: 0 },
      { name: 'Taharat', email: 'taharat@lifeos.com', role: 'member', currentBalance: 0 }
    ]);

    const [wasiur, zesrab, borno, taharat] = users;
    console.log(`Users created: ${wasiur.name}, ${zesrab.name}, ${borno.name}, ${taharat.name}`);

    // 2. Create PC Telemetry Logs (July-2026)
    console.log('Creating device telemetry logs...');
    const telemetries = [];
    const now = new Date('2026-07-15T12:00:00Z');

    // Seed Wasiur: jashore-laptop
    for (let i = 0; i < 12; i++) {
      telemetries.push({
        deviceId: 'jashore-laptop',
        ownerId: wasiur._id,
        timestamp: new Date(now.getTime() - i * 10 * 60 * 1000), // 10-minute intervals
        cpuUsage: Math.round(15 + Math.random() * 20),
        ramUsage: Math.round(50 + Math.random() * 10),
        uptime: 1800 + i * 600,
        activityBreakdown: { Coding: 1, Gaming: 0, Browsing: 1, Other: 0 }
      });
    }

    // Seed Zesrab: nafis-mac
    for (let i = 0; i < 24; i++) {
      telemetries.push({
        deviceId: 'nafis-mac',
        ownerId: zesrab._id,
        timestamp: new Date(now.getTime() - i * 8 * 60 * 1000),
        cpuUsage: Math.round(25 + Math.random() * 30),
        ramUsage: Math.round(60 + Math.random() * 15),
        uptime: 3600 + i * 480,
        activityBreakdown: { Coding: 0, Gaming: 1, Browsing: 1, Other: 0 }
      });
    }

    // Seed Borno: tanvir-rig
    for (let i = 0; i < 36; i++) {
      telemetries.push({
        deviceId: 'tanvir-rig',
        ownerId: borno._id,
        timestamp: new Date(now.getTime() - i * 6 * 60 * 1000),
        cpuUsage: Math.round(35 + Math.random() * 45),
        ramUsage: Math.round(70 + Math.random() * 20),
        uptime: 7200 + i * 360,
        activityBreakdown: { Coding: 1, Gaming: 1, Browsing: 0, Other: 1 }
      });
    }

    // Seed Taharat: taharat-pc
    for (let i = 0; i < 18; i++) {
      telemetries.push({
        deviceId: 'taharat-pc',
        ownerId: taharat._id,
        timestamp: new Date(now.getTime() - i * 9 * 60 * 1000),
        cpuUsage: Math.round(20 + Math.random() * 25),
        ramUsage: Math.round(55 + Math.random() * 12),
        uptime: 2400 + i * 500,
        activityBreakdown: { Coding: 1, Gaming: 0, Browsing: 0, Other: 1 }
      });
    }

    await DeviceTelemetry.create(telemetries);
    console.log(`Ingested ${telemetries.length} telemetry logs.`);

    // 3. Create Transactions
    console.log('Creating transactions...');
    await Transaction.create([
      // Bazar (Meal Costs)
      {
        date: new Date('2026-07-06'),
        monthId: 'July-2026',
        type: 'BAZAR',
        category: 'Groceries and veggies',
        amount: 2196.00,
        paidBy: wasiur._id,
        splitType: 'MEAL_RATE'
      },
      {
        date: new Date('2026-07-13'),
        monthId: 'July-2026',
        type: 'BAZAR',
        category: 'Meat and fish',
        amount: 2316.00,
        paidBy: zesrab._id,
        splitType: 'MEAL_RATE'
      },
      {
        date: new Date('2026-07-22'),
        monthId: 'July-2026',
        type: 'BAZAR',
        category: 'Household supplies and bazar',
        amount: 2445.00,
        paidBy: borno._id,
        splitType: 'MEAL_RATE'
      },
      {
        date: new Date('2026-07-28'),
        monthId: 'July-2026',
        type: 'BAZAR',
        category: 'Spices and grocery',
        amount: 3013.00,
        paidBy: taharat._id,
        splitType: 'MEAL_RATE'
      },
      // Rent (Shared equally $187.50 each)
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'RENT',
        category: 'Apartment Rent',
        amount: 750.00,
        paidBy: wasiur._id,
        splitType: 'EQUAL',
        splitAmong: [
          { user: wasiur._id, amountOwed: 187.50 },
          { user: zesrab._id, amountOwed: 187.50 },
          { user: borno._id, amountOwed: 187.50 },
          { user: taharat._id, amountOwed: 187.50 }
        ]
      },
      // Utility (EQUAL Split - Electricity Bill)
      // Total amount: $180.00. Shared equally ($45.00 each)
      {
        date: new Date('2026-07-03'),
        monthId: 'July-2026',
        type: 'UTILITY',
        category: 'Smart-Meter Electricity Bill',
        amount: 180.00,
        paidBy: zesrab._id,
        splitType: 'EQUAL'
      },
      // Deposits / Taka Givens
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'DEPOSIT',
        category: 'Monthly advance deposit',
        amount: 2448.00,
        paidBy: wasiur._id,
        splitType: 'INDIVIDUAL'
      },
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'DEPOSIT',
        category: 'Monthly advance deposit',
        amount: 2349.94,
        paidBy: zesrab._id,
        splitType: 'INDIVIDUAL'
      },
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'DEPOSIT',
        category: 'Monthly advance deposit',
        amount: 2874.01,
        paidBy: borno._id,
        splitType: 'INDIVIDUAL'
      },
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'DEPOSIT',
        category: 'Monthly advance deposit',
        amount: 2769.92,
        paidBy: taharat._id,
        splitType: 'INDIVIDUAL'
      }
    ]);
    console.log('Transactions created.');

    // 4. Create DailyMeals for July-2026 (matching spreadsheet totals)
    console.log('Creating daily meals...');
    const dailyMeals = [];
    // We want the total counts over 31 days to be wasiur: 35, zesrab: 34, borno: 40, taharat: 38
    const baseW = 1, baseZ = 1, baseB = 1, baseT = 1;
    // We need additional: wasiur: 4, zesrab: 3, borno: 9, taharat: 7
    for (let day = 1; day <= 31; day++) {
      let wCount = baseW;
      let zCount = baseZ;
      let bCount = baseB;
      let tCount = baseT;

      // Add extra meals on specific days to reach the target totals
      if (day <= 4) wCount += 1;
      if (day <= 3) zCount += 1;
      if (day <= 9) bCount += 1;
      if (day <= 7) tCount += 1;

      dailyMeals.push({
        date: new Date(`2026-07-${day < 10 ? '0' + day : day}T12:00:00Z`),
        monthId: 'July-2026',
        guestMeals: 0,
        meals: [
          { user: wasiur._id, count: wCount },
          { user: zesrab._id, count: zCount },
          { user: borno._id, count: bCount },
          { user: taharat._id, count: tCount }
        ]
      });
    }
    await DailyMeal.create(dailyMeals);
    console.log('Daily meals created.');

    console.log('Seeding process completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seed();
