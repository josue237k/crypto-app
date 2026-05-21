const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Connect to MongoDB database using the MONGO_URI environment variable.
 * @returns {Promise<typeof mongoose>} Mongoose instance on successful connection
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crypto-alerts';
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
