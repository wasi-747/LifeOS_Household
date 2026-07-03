const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const DailyMeal = require('./models/DailyMeal');
const Transaction = require('./models/Transaction');
const DeviceTelemetry = require('./models/DeviceTelemetry');

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
    console.log('Collections cleared.');

    // 1. Create Roommate Users
    console.log('Creating users...');
    const users = await User.create([
      { name: 'Shakil Ahmed', email: 'shakil@lifeos.com', role: 'admin', currentBalance: 0 },
      { name: 'Nafis Iqbal', email: 'nafis@lifeos.com', role: 'member', currentBalance: 0 },
      { name: 'Tanvir Rahman', email: 'tanvir@lifeos.com', role: 'member', currentBalance: 0 }
    ]);

    const [shakil, nafis, tanvir] = users;
    console.log(`Users created: ${shakil.name}, ${nafis.name}, ${tanvir.name}`);

    // 2. Create PC Telemetry Logs (July-2026)
    // We will seed device records for each roommate to calculate usage hours.
    // Shakil: 12 logs (1.0 hr active PC usage)
    // Nafis: 24 logs (2.0 hrs active PC usage)
    // Tanvir: 36 logs (3.0 hrs active PC usage)
    // Total combined PC logs in house: 72 logs (6.0 hrs)
    console.log('Creating device telemetry logs...');
    const telemetries = [];
    const now = new Date('2026-07-15T12:00:00Z');

    // Seed Shakil: jashore-laptop
    for (let i = 0; i < 12; i++) {
      telemetries.push({
        deviceId: 'jashore-laptop',
        ownerId: shakil._id,
        timestamp: new Date(now.getTime() - i * 10 * 60 * 1000), // 10-minute intervals
        cpuUsage: Math.round(15 + Math.random() * 20),
        ramUsage: Math.round(50 + Math.random() * 10),
        uptime: 1800 + i * 600,
        activityBreakdown: { Coding: 1, Gaming: 0, Browsing: 1, Other: 0 }
      });
    }

    // Seed Nafis: nafis-mac
    for (let i = 0; i < 24; i++) {
      telemetries.push({
        deviceId: 'nafis-mac',
        ownerId: nafis._id,
        timestamp: new Date(now.getTime() - i * 8 * 60 * 1000),
        cpuUsage: Math.round(25 + Math.random() * 30),
        ramUsage: Math.round(60 + Math.random() * 15),
        uptime: 3600 + i * 480,
        activityBreakdown: { Coding: 0, Gaming: 1, Browsing: 1, Other: 0 }
      });
    }

    // Seed Tanvir: tanvir-rig
    for (let i = 0; i < 36; i++) {
      telemetries.push({
        deviceId: 'tanvir-rig',
        ownerId: tanvir._id,
        timestamp: new Date(now.getTime() - i * 6 * 60 * 1000),
        cpuUsage: Math.round(35 + Math.random() * 45),
        ramUsage: Math.round(70 + Math.random() * 20),
        uptime: 7200 + i * 360,
        activityBreakdown: { Coding: 1, Gaming: 1, Browsing: 0, Other: 1 }
      });
    }

    await DeviceTelemetry.create(telemetries);
    console.log(`Ingested ${telemetries.length} telemetry logs.`);

    // 3. Create Transactions
    console.log('Creating transactions...');
    await Transaction.create([
      // Bazar (Meal Costs)
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'BAZAR',
        category: 'Weekly grocery Bazar',
        amount: 120.00,
        paidBy: shakil._id,
        splitType: 'MEAL_RATE'
      },
      {
        date: new Date('2026-07-02'),
        monthId: 'July-2026',
        type: 'BAZAR',
        category: 'Fresh vegetables and fish Bazar',
        amount: 30.00,
        paidBy: nafis._id,
        splitType: 'MEAL_RATE'
      },
      // Rent
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'RENT',
        category: 'Apartment Rent',
        amount: 750.00,
        paidBy: shakil._id,
        splitType: 'EQUAL',
        splitAmong: [
          { user: shakil._id, amountOwed: 250 },
          { user: nafis._id, amountOwed: 250 },
          { user: tanvir._id, amountOwed: 250 }
        ]
      },
      // Utility (TELEMETRY_BASED Split - Electricity Bill)
      // Total amount: $180.00.
      // Uptime share split: Shakil (1/6 = $30.00), Nafis (2/6 = $60.00), Tanvir (3/6 = $90.00)
      {
        date: new Date('2026-07-03'),
        monthId: 'July-2026',
        type: 'UTILITY',
        category: 'Smart-Meter Electricity Bill',
        amount: 180.00,
        paidBy: nafis._id,
        splitType: 'TELEMETRY_BASED'
      },
      // Deposits / Taka Givens
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'DEPOSIT',
        category: 'Monthly advance deposit',
        amount: 50.00,
        paidBy: shakil._id,
        splitType: 'INDIVIDUAL'
      },
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'DEPOSIT',
        category: 'Monthly advance deposit',
        amount: 100.00,
        paidBy: nafis._id,
        splitType: 'INDIVIDUAL'
      },
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        type: 'DEPOSIT',
        category: 'Monthly advance deposit',
        amount: 280.00,
        paidBy: tanvir._id,
        splitType: 'INDIVIDUAL'
      }
    ]);
    console.log('Transactions created.');

    // 4. Create DailyMeals for July-2026
    console.log('Creating daily meals...');
    await DailyMeal.create([
      {
        date: new Date('2026-07-01'),
        monthId: 'July-2026',
        guestMeals: 0,
        meals: [
          { user: shakil._id, count: 2 },
          { user: nafis._id, count: 1.5 },
          { user: tanvir._id, count: 2 }
        ]
      },
      {
        date: new Date('2026-07-02'),
        monthId: 'July-2026',
        guestMeals: 0,
        meals: [
          { user: shakil._id, count: 1 },
          { user: nafis._id, count: 2 },
          { user: tanvir._id, count: 1.5 }
        ]
      },
      {
        date: new Date('2026-07-03'),
        monthId: 'July-2026',
        guestMeals: 0,
        meals: [
          { user: shakil._id, count: 2 },
          { user: nafis._id, count: 2 },
          { user: tanvir._id, count: 1 }
        ]
      },
      {
        date: new Date('2026-07-04'),
        monthId: 'July-2026',
        guestMeals: 0,
        meals: [
          { user: shakil._id, count: 1.5 },
          { user: nafis._id, count: 1 },
          { user: tanvir._id, count: 2.5 }
        ]
      }
    ]);
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
