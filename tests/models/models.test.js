const mongoose = require('mongoose');
const connectDB = require('../../src/config/db');
const Alert = require('../../src/models/Alert');
const PriceHistory = require('../../src/models/PriceHistory');

describe('Mongoose Models Unit Tests', () => {
  beforeAll(async () => {
    // Ensure we are connected to the test database
    await connectDB();
  });

  afterEach(async () => {
    // Clear collections to prevent test pollution
    await Alert.deleteMany({});
    await PriceHistory.deleteMany({});
  });

  afterAll(async () => {
    // Close the database connection to prevent hanging handles
    await mongoose.connection.close();
  });

  describe('Alert Model Tests', () => {
    it('should successfully create a valid active alert', async () => {
      const alertData = {
        targetPrice: 65000.5,
        type: 'above'
      };

      const alert = new Alert(alertData);
      const savedAlert = await alert.save();

      expect(savedAlert._id).toBeDefined();
      expect(savedAlert.targetPrice).toBe(65000.5);
      expect(savedAlert.type).toBe('above');
      expect(savedAlert.status).toBe('active');
      expect(savedAlert.triggeredAt).toBeNull();
      expect(savedAlert.createdAt).toBeInstanceOf(Date);
    });

    it('should allow explicitly setting status and triggeredAt', async () => {
      const triggeredDate = new Date();
      const alertData = {
        targetPrice: 60000,
        type: 'below',
        status: 'triggered',
        triggeredAt: triggeredDate
      };

      const alert = new Alert(alertData);
      const savedAlert = await alert.save();

      expect(savedAlert.status).toBe('triggered');
      expect(savedAlert.triggeredAt.getTime()).toBe(triggeredDate.getTime());
    });

    it('should fail validation if targetPrice is missing', async () => {
      const alert = new Alert({
        type: 'above'
      });

      let err;
      try {
        await alert.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.targetPrice).toBeDefined();
    });

    it('should fail validation if targetPrice is negative', async () => {
      const alert = new Alert({
        targetPrice: -100,
        type: 'above'
      });

      let err;
      try {
        await alert.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.targetPrice).toBeDefined();
      expect(err.errors.targetPrice.message).toContain('Le prix cible doit être supérieur ou égal à 0');
    });

    it('should fail validation if type is missing', async () => {
      const alert = new Alert({
        targetPrice: 65000
      });

      let err;
      try {
        await alert.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.type).toBeDefined();
    });

    it('should fail validation if type is not a valid enum value', async () => {
      const alert = new Alert({
        targetPrice: 65000,
        type: 'invalid-type'
      });

      let err;
      try {
        await alert.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.type).toBeDefined();
      expect(err.errors.type.message).toContain('Le type doit être "above" (supérieur à) ou "below" (inférieur à)');
    });

    it('should fail validation if status is not a valid enum value', async () => {
      const alert = new Alert({
        targetPrice: 65000,
        type: 'above',
        status: 'invalid-status'
      });

      let err;
      try {
        await alert.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.status).toBeDefined();
    });
  });

  describe('PriceHistory Model Tests', () => {
    it('should successfully create a valid price history entry', async () => {
      const priceData = {
        price: 66250.75
      };

      const history = new PriceHistory(priceData);
      const savedHistory = await history.save();

      expect(savedHistory._id).toBeDefined();
      expect(savedHistory.price).toBe(66250.75);
      expect(savedHistory.timestamp).toBeInstanceOf(Date);
    });

    it('should fail validation if price is missing', async () => {
      const history = new PriceHistory({});

      let err;
      try {
        await history.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.price).toBeDefined();
    });

    it('should fail validation if price is negative', async () => {
      const history = new PriceHistory({
        price: -50.25
      });

      let err;
      try {
        await history.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.price).toBeDefined();
      expect(err.errors.price.message).toContain('Le prix doit être supérieur ou égal à 0');
    });

    it('should define a TTL index of 24h on the timestamp field', () => {
      const timestampPath = PriceHistory.schema.path('timestamp');
      
      expect(timestampPath.options.index).toBeDefined();
      expect(timestampPath.options.index.expires).toBe('24h');
    });
  });
});
