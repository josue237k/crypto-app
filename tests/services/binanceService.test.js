const mongoose = require('mongoose');
const connectDB = require('../../src/config/db');
const Alert = require('../../src/models/Alert');
const PriceHistory = require('../../src/models/PriceHistory');
const sseService = require('../../src/services/sseService');
const { pollBinancePrice, startPolling, stopPolling, isPolling } = require('../../src/services/binanceService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Crée un mock de réponse Binance pour un prix donné.
 */
function mockBinanceFetch(price) {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({ price: String(price) })
  });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

describe('Binance Service Unit Tests', () => {
  let broadcastSpy;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(() => {
    // Espionner sseService.broadcast pour vérifier les diffusions SSE
    broadcastSpy = jest.spyOn(sseService, 'broadcast').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Nettoyer les collections de la BDD de test après chaque test
    await Alert.deleteMany({});
    await PriceHistory.deleteMany({});
    // Restaurer tous les mocks
    jest.restoreAllMocks();
    // Arrêter le polling si un test l'a démarré
    stopPolling();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── pollBinancePrice ──────────────────────────────────────────────────────

  describe('pollBinancePrice()', () => {
    it('should save a PriceHistory record in the database', async () => {
      mockBinanceFetch(65000.5);

      await pollBinancePrice();

      const records = await PriceHistory.find({});
      expect(records).toHaveLength(1);
      expect(records[0].price).toBe(65000.5);
      expect(records[0].timestamp).toBeInstanceOf(Date);
    });

    it('should broadcast a priceUpdate event via SSE with price and timestamp', async () => {
      mockBinanceFetch(66000);

      await pollBinancePrice();

      expect(broadcastSpy).toHaveBeenCalledWith(
        'priceUpdate',
        expect.objectContaining({
          price: 66000,
          timestamp: expect.any(Date)
        })
      );
    });

    it('should trigger an "above" alert when price >= targetPrice', async () => {
      await Alert.create({ targetPrice: 60000, type: 'above' });
      mockBinanceFetch(65000); // 65000 >= 60000 → doit se déclencher

      await pollBinancePrice();

      const alert = await Alert.findOne({ type: 'above' });
      expect(alert.status).toBe('triggered');
      expect(alert.triggeredAt).toBeInstanceOf(Date);
    });

    it('should broadcast alertTriggered when an "above" alert is triggered', async () => {
      await Alert.create({ targetPrice: 60000, type: 'above' });
      mockBinanceFetch(70000);

      await pollBinancePrice();

      expect(broadcastSpy).toHaveBeenCalledWith(
        'alertTriggered',
        expect.objectContaining({ type: 'above', status: 'triggered' })
      );
    });

    it('should trigger a "below" alert when price <= targetPrice', async () => {
      await Alert.create({ targetPrice: 70000, type: 'below' });
      mockBinanceFetch(65000); // 65000 <= 70000 → doit se déclencher

      await pollBinancePrice();

      const alert = await Alert.findOne({ type: 'below' });
      expect(alert.status).toBe('triggered');
      expect(alert.triggeredAt).toBeInstanceOf(Date);
    });

    it('should broadcast alertTriggered when a "below" alert is triggered', async () => {
      await Alert.create({ targetPrice: 70000, type: 'below' });
      mockBinanceFetch(50000);

      await pollBinancePrice();

      expect(broadcastSpy).toHaveBeenCalledWith(
        'alertTriggered',
        expect.objectContaining({ type: 'below', status: 'triggered' })
      );
    });

    it('should NOT trigger an "above" alert when price < targetPrice', async () => {
      await Alert.create({ targetPrice: 80000, type: 'above' });
      mockBinanceFetch(65000); // 65000 < 80000 → ne doit pas se déclencher

      await pollBinancePrice();

      const alert = await Alert.findOne({ type: 'above' });
      expect(alert.status).toBe('active');

      // alertTriggered ne doit PAS avoir été diffusé
      const alertTriggeredCalls = broadcastSpy.mock.calls.filter(
        call => call[0] === 'alertTriggered'
      );
      expect(alertTriggeredCalls).toHaveLength(0);
    });

    it('should NOT trigger a "below" alert when price > targetPrice', async () => {
      await Alert.create({ targetPrice: 50000, type: 'below' });
      mockBinanceFetch(65000); // 65000 > 50000 → ne doit pas se déclencher

      await pollBinancePrice();

      const alert = await Alert.findOne({ type: 'below' });
      expect(alert.status).toBe('active');

      const alertTriggeredCalls = broadcastSpy.mock.calls.filter(
        call => call[0] === 'alertTriggered'
      );
      expect(alertTriggeredCalls).toHaveLength(0);
    });

    it('should ignore already-triggered alerts', async () => {
      // Créer une alerte déjà déclenchée
      await Alert.create({
        targetPrice: 60000,
        type: 'above',
        status: 'triggered',
        triggeredAt: new Date()
      });
      mockBinanceFetch(70000);

      await pollBinancePrice();

      // Vérifier qu'aucun alertTriggered n'est diffusé
      const alertTriggeredCalls = broadcastSpy.mock.calls.filter(
        call => call[0] === 'alertTriggered'
      );
      expect(alertTriggeredCalls).toHaveLength(0);
    });

    it('should not crash when fetch fails', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      // Ne doit pas lever d'exception
      await expect(pollBinancePrice()).resolves.toBeNull();

      // Aucun enregistrement en BDD
      const records = await PriceHistory.find({});
      expect(records).toHaveLength(0);
    });

    it('should handle multiple simultaneous active alerts independently', async () => {
      await Alert.create({ targetPrice: 60000, type: 'above' }); // déclenchée
      await Alert.create({ targetPrice: 70000, type: 'below' }); // non déclenchée (65000 > 70000? non: 65000 <= 70000 => déclenchée aussi)
      await Alert.create({ targetPrice: 80000, type: 'above' }); // non déclenchée (65000 < 80000)
      mockBinanceFetch(65000);

      await pollBinancePrice();

      const aboveAlert60k = await Alert.findOne({ targetPrice: 60000 });
      const belowAlert70k = await Alert.findOne({ targetPrice: 70000 });
      const aboveAlert80k = await Alert.findOne({ targetPrice: 80000 });

      expect(aboveAlert60k.status).toBe('triggered'); // 65000 >= 60000 ✓
      expect(belowAlert70k.status).toBe('triggered');  // 65000 <= 70000 ✓
      expect(aboveAlert80k.status).toBe('active');    // 65000 < 80000 ✗
    });
  });

  // ─── startPolling / stopPolling / isPolling ────────────────────────────────

  describe('startPolling() and stopPolling()', () => {
    it('should start and stop the polling interval', () => {
      // Mocker fetch pour éviter les vrais appels réseau pendant les faux timers
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ price: '65000' })
      });
      jest.useFakeTimers();

      startPolling(1000);
      expect(isPolling()).toBe(true);

      stopPolling();
      expect(isPolling()).toBe(false);

      jest.useRealTimers();
    });

    it('should not create a second interval if already polling', () => {
      // Mocker fetch pour éviter les vrais appels réseau pendant les faux timers
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ price: '65000' })
      });
      jest.useFakeTimers();

      startPolling(1000);
      startPolling(1000); // Appel en double

      expect(isPolling()).toBe(true);

      stopPolling();
      expect(isPolling()).toBe(false);

      jest.useRealTimers();
    });

    it('should be safe to call stopPolling when not polling', () => {
      expect(isPolling()).toBe(false);
      expect(() => stopPolling()).not.toThrow();
      expect(isPolling()).toBe(false);
    });
  });
});
