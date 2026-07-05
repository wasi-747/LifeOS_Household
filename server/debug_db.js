const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const DailyMeal = require('./models/DailyMeal');
const Transaction = require('./models/Transaction');
const MonthlyBill = require('./models/MonthlyBill');
const BazarWallet = require('./models/BazarWallet');

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const monthId = 'July-2026';
  
  const users = await User.find({});
  console.log('\n--- USERS ---');
  console.log(users.map(u => ({ id: u._id, name: u.name })));

  const monthlyBill = await MonthlyBill.findOne({ monthId });
  console.log('\n--- MONTHLY BILL CONFIG ---');
  console.log(JSON.stringify(monthlyBill, null, 2));

  const transactions = await Transaction.find({ monthId });
  console.log('\n--- TRANSACTIONS ---');
  console.log(transactions.map(t => ({ type: t.type, amount: t.amount, paidBy: t.paidBy, category: t.category })));

  const dailyMeals = await DailyMeal.find({ monthId });
  let totalMeals = 0;
  dailyMeals.forEach(dm => {
    dm.meals.forEach(m => {
      totalMeals += m.count;
    });
  });
  console.log('\n--- TOTAL MEALS ---', totalMeals);

  await mongoose.disconnect();
}

run().catch(console.error);
