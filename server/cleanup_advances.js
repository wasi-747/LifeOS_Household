const mongoose = require('mongoose');
require('dotenv').config();

const Transaction = require('./models/Transaction');
const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const monthId = 'July-2026';
  
  console.log('Deleting "Monthly advance deposit" transactions for July-2026...');
  const result = await Transaction.deleteMany({
    monthId,
    type: 'DEPOSIT',
    category: 'Monthly advance deposit'
  });
  
  console.log(`Deleted ${result.deletedCount} transactions.`);
  await mongoose.disconnect();
}

run().catch(console.error);
