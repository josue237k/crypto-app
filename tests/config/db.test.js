const mongoose = require('mongoose');
const connectDB = require('../../src/config/db');

describe('Database Connection Test', () => {
  afterAll(async () => {
    // Close the database connection to prevent hanging handles
    await mongoose.connection.close();
  });

  it('should successfully connect to MongoDB database and have readyState 1', async () => {
    const conn = await connectDB();
    
    // Assert that the connection is active and readyState is 1 (connected)
    expect(mongoose.connection.readyState).toBe(1);
    
    // Verify connection details are present
    expect(conn).toBeDefined();
    expect(conn.connection.host).toBeDefined();
  });
});
