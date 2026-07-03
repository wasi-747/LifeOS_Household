const mongoose = require('mongoose');
require('dotenv').config();

const DeviceTelemetry = require('./models/DeviceTelemetry');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lifeos_household';

async function seed() {
  try {
    console.log('Connecting to MongoDB Atlas to seed telemetry...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected. Clearing existing telemetry data...');

    await DeviceTelemetry.deleteMany({});
    console.log('Telemetry collection cleared.');

    const now = new Date();
    const mockData = [];

    // Generate 15 telemetry entries in 5-minute increments (oldest first)
    for (let i = 15; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);
      
      // Simulating a system starting low and running high load
      const cpuUsage = Math.round(20 + Math.sin(i * 0.8) * 15 + Math.random() * 20); // 10% - 60%
      const ramUsage = Math.round(55 + (15 - i) * 1.5 + Math.random() * 5); // gradual RAM rise
      const uptime = 3600 + (15 - i) * 300; // Uptime increments by 300s each step

      // Activity breakdowns (representing ticks)
      const Coding = i % 3 === 0 ? 3 : 1;
      const Gaming = i % 4 === 0 ? 2 : 0;
      const Browsing = i % 2 === 0 ? 2 : 1;
      const Other = 1;

      mockData.push({
        deviceId: 'jashore-laptop',
        timestamp,
        cpuUsage,
        ramUsage,
        uptime,
        activityBreakdown: { Coding, Gaming, Browsing, Other }
      });
    }

    console.log('Inserting telemetry logs...');
    await DeviceTelemetry.create(mockData);
    console.log('Telemetry mock data inserted successfully!');
  } catch (err) {
    console.error('Error seeding telemetry:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seed();
