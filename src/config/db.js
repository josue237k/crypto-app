const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Connect to MongoDB database using the MONGO_URI environment variable.
 * @returns {Promise<typeof mongoose>} Mongoose instance on successful connection
 */
const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crypto-alerts';
    if (process.env.NODE_ENV === 'test') {
      mongoUri = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/crypto-alerts-test';
    }
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
