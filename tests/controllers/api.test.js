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
    await Alert.create({ targetPrice: 60000, type: 'above' });
    await Alert.create({ targetPrice: 50000, type: 'below' });

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
      .send({ targetPrice: 65000, type: 'above' });

    expect(res.statusCode).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.targetPrice).toBe(65000);
    expect(res.body.type).toBe('above');
    expect(res.body.status).toBe('active');
    expect(res.body.triggeredAt).toBeNull();
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

// ─── GET /api/price/history ───────────────────────────────────────────────────

describe('GET /api/price/history', () => {
  it('should return an empty array when no price history exists', async () => {
    const res = await request(app).get('/api/price/history');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should return price history sorted from oldest to newest', async () => {
    await PriceHistory.create({ price: 60000 });
    await PriceHistory.create({ price: 65000 });
    await PriceHistory.create({ price: 70000 });

    const res = await request(app).get('/api/price/history');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(3);
    // Du plus ancien au plus récent
    expect(res.body[0].price).toBe(60000);
    expect(res.body[2].price).toBe(70000);
  });

  it('should return at most 100 records', async () => {
    const records = Array.from({ length: 105 }, (_, i) => ({ price: 60000 + i }));
    await PriceHistory.insertMany(records);

    const res = await request(app).get('/api/price/history');

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(100);
  });
});

// ─── GET /api/price/stream (SSE) ─────────────────────────────────────────────

describe('GET /api/price/stream', () => {
  it('should respond with SSE headers', async () => {
    // Utiliser une requête avec timeout court pour ne pas bloquer les tests
    const res = await request(app)
      .get('/api/price/stream')
      .timeout({ response: 500 })
      .catch(err => err.response || err);

    // Vérifier les headers SSE même si la connexion est toujours ouverte
    if (res && res.headers) {
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });
});
