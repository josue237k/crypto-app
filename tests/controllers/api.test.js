/**
 * Tests d'intégration API — utilise Supertest pour tester les routes Express
 * sans démarrer un vrai serveur. La BDD de test (crypto-alerts-test) est isolée.
 */

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const connectDB = require('../../src/config/db');
const Alert = require('../../src/models/Alert');
const PriceHistory = require('../../src/models/PriceHistory');
const alertRoutes = require('../../src/routes/alertRoutes');
const priceRoutes = require('../../src/routes/priceRoutes');

// ─── App Express de test ───────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/alerts', alertRoutes);
app.use('/api/price', priceRoutes);

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.MONGO_DB_NAME = 'crypto-alerts-test';
  await connectDB();
});

afterEach(async () => {
  await Alert.deleteMany({});
  await PriceHistory.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

// ─── GET /api/alerts ──────────────────────────────────────────────────────────

describe('GET /api/alerts', () => {
  it('should return an empty array when no alerts exist', async () => {
    const res = await request(app).get('/api/alerts');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should return all alerts sorted by createdAt descending', async () => {
    await Alert.create({ targetPrice: 60000, type: 'above', createdAt: new Date('2025-01-01T00:00:00Z') });
    await Alert.create({ targetPrice: 50000, type: 'below', createdAt: new Date('2025-01-02T00:00:00Z') });

    const res = await request(app).get('/api/alerts');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    // La plus récente en premier
    expect(res.body[0].targetPrice).toBe(50000);
    expect(res.body[1].targetPrice).toBe(60000);
  });
});

// ─── POST /api/alerts ─────────────────────────────────────────────────────────

describe('POST /api/alerts', () => {
  it('should create a new alert and return 201 with the created document', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .send({ symbol: 'BTC', targetPrice: 65000, type: 'above' });

    expect(res.statusCode).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.symbol).toBe('BTC');
    expect(res.body.targetPrice).toBe(65000);
    expect(res.body.type).toBe('above');
    expect(res.body.status).toBe('active');
    expect(res.body.triggeredAt).toBeNull();
  });

  it('should create a new alert with a specific symbol', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .send({ symbol: 'ETH', targetPrice: 3000, type: 'below' });

    expect(res.statusCode).toBe(201);
    expect(res.body.symbol).toBe('ETH');
    expect(res.body.targetPrice).toBe(3000);
    expect(res.body.type).toBe('below');
  });

  it('should return 400 if targetPrice is missing', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .send({ type: 'above' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if type is missing', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .send({ targetPrice: 65000 });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 for an invalid type value (validation error)', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .send({ targetPrice: 65000, type: 'sideways' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 for a negative targetPrice', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .send({ targetPrice: -500, type: 'above' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ─── DELETE /api/alerts/:id ───────────────────────────────────────────────────

describe('DELETE /api/alerts/:id', () => {
  it('should delete an existing alert and return 200', async () => {
    const alert = await Alert.create({ targetPrice: 65000, type: 'above' });

    const res = await request(app).delete(`/api/alerts/${alert._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('supprimée');
    expect(res.body.alert._id).toBe(String(alert._id));

    // Vérifier que l'alerte a bien été supprimée de la BDD
    const found = await Alert.findById(alert._id);
    expect(found).toBeNull();
  });

  it('should return 404 when alert does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/api/alerts/${fakeId}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 for an invalid MongoDB ObjectId', async () => {
    const res = await request(app).delete('/api/alerts/invalid-id');

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ─── DELETE /api/alerts/triggered ─────────────────────────────────────────────

describe('DELETE /api/alerts/triggered', () => {
  it('should delete all alerts with status triggered and keep active ones', async () => {
    // Create some active and triggered alerts
    await Alert.create({ symbol: 'BTC', targetPrice: 60000, type: 'above', status: 'active' });
    await Alert.create({ symbol: 'ETH', targetPrice: 3000, type: 'below', status: 'triggered', triggeredAt: new Date() });
    await Alert.create({ symbol: 'SOL', targetPrice: 150, type: 'above', status: 'triggered', triggeredAt: new Date() });

    const res = await request(app).delete('/api/alerts/triggered');

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('vidé avec succès');
    expect(res.body.count).toBe(2);

    // Verify DB state
    const allAlerts = await Alert.find({});
    expect(allAlerts).toHaveLength(1);
    expect(allAlerts[0].symbol).toBe('BTC');
    expect(allAlerts[0].status).toBe('active');
  });
});

// ─── GET /api/price/history ───────────────────────────────────────────────────

describe('GET /api/price/history', () => {
  it('should return empty history and null indicators when no price history exists', async () => {
    const res = await request(app).get('/api/price/history');

    expect(res.statusCode).toBe(200);
    expect(res.body.symbol).toBe('BTC');
    expect(res.body.history).toEqual([]);
    expect(res.body.indicators).toBeDefined();
    expect(res.body.indicators.rsi).toBeNull();
  });

  it('should return price history sorted from oldest to newest with indicators', async () => {
    await PriceHistory.create({ price: 60000 });
    await PriceHistory.create({ price: 65000 });
    await PriceHistory.create({ price: 70000 });

    const res = await request(app).get('/api/price/history');

    expect(res.statusCode).toBe(200);
    expect(res.body.symbol).toBe('BTC');
    expect(res.body.history).toHaveLength(3);
    // Du plus ancien au plus récent
    expect(res.body.history[0].price).toBe(60000);
    expect(res.body.history[2].price).toBe(70000);
    expect(res.body.indicators).toBeDefined();
  });

  it('should return at most 100 records', async () => {
    const records = Array.from({ length: 105 }, (_, i) => ({ price: 60000 + i }));
    await PriceHistory.insertMany(records);

    const res = await request(app).get('/api/price/history');

    expect(res.statusCode).toBe(200);
    expect(res.body.history.length).toBeLessThanOrEqual(100);
  });

  it('should support filtering by symbol in query parameters', async () => {
    await PriceHistory.create({ symbol: 'ETH', price: 3000 });
    await PriceHistory.create({ symbol: 'BTC', price: 65000 });

    const res = await request(app).get('/api/price/history?symbol=ETH');

    expect(res.statusCode).toBe(200);
    expect(res.body.symbol).toBe('ETH');
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].price).toBe(3000);
  });
});

// ─── GET /api/price/stream (SSE) ─────────────────────────────────────────────

describe('GET /api/price/stream', () => {
  it('should call sseService.registerClient with req and res', () => {
    // Tester directement le contrôleur pour éviter les connexions SSE persistantes
    const priceController = require('../../src/controllers/priceController');
    const sseService = require('../../src/services/sseService');

    const mockReq = { on: jest.fn() };
    const mockRes = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };

    const registerSpy = jest.spyOn(sseService, 'registerClient').mockImplementation(() => {});

    priceController.streamPrice(mockReq, mockRes);

    expect(registerSpy).toHaveBeenCalledWith(mockReq, mockRes);

    registerSpy.mockRestore();
  });
});

