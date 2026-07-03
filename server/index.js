const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lifeos_household';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const apiRoutes = require('./routes/apiRoutes');
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'LifeOS-Household Server is running' });
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Connect to MongoDB in background
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
  })
  .catch((err) => {
    console.error('Database connection error in background:', err.message);
  });
