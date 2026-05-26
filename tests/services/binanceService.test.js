const mongoose = require('mongoose');
const connectDB = require('../../src/config/db');
const Alert = require('../../src/models/Alert');
const PriceHistory = require('../../src/models/PriceHistory');
const sseService = require('../../src/services/sseService');
const { 
  pollBinancePrice, 
  startPolling, 
  stopPolling, 
  isPolling, 
  calculateIndicators 
} = require('../../src/services/binanceService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Crée un mock de réponse Binance pour un ou plusieurs prix donnés.
 */
function mockBinanceFetch(pricesMap) {
  let tickers = [];
  if (typeof pricesMap === 'number') {
    tickers = [{
      symbol: 'BTCUSDT',
      lastPrice: String(pricesMap),
      priceChangePercent: '1.5',
      highPrice: String(pricesMap + 100),
      lowPrice: String(pricesMap - 100),
      volume: '1000'
    }];
  } else {
    tickers = Object.entries(pricesMap).map(([symbol, price]) => ({
      symbol: `${symbol}USDT`,
      lastPrice: String(price),
      priceChangePercent: '1.5',
      highPrice: String(price + 100),
      lowPrice: String(price - 100),
      volume: '1000'
    }));
  }

  // S'assurer qu'au moins BTC est là si vide
  if (tickers.length === 0) {
    tickers.push({
      symbol: 'BTCUSDT',
      lastPrice: '65000.5',
      priceChangePercent: '1.5',
      highPrice: '66000',
      lowPrice: '64000',
      volume: '1000'
    });
  }

  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => tickers
  });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

describe('Binance Service Unit Tests', () => {
  let broadcastSpy;

  beforeAll(async () => {
    process.env.MONGO_DB_NAME = 'crypto-alerts-test';
    await connectDB();
  });

  beforeEach(async () => {
    // Nettoyer les collections avant chaque test pour s'assurer d'une isolation parfaite
    await Alert.deleteMany({});
    await PriceHistory.deleteMany({});
    broadcastSpy = jest.spyOn(sseService, 'broadcast').mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    stopPolling();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── pollBinancePrice ──────────────────────────────────────────────────────

  describe('pollBinancePrice()', () => {
    it('should save a PriceHistory record in the database for CORE coins', async () => {
      mockBinanceFetch(65000.5);

      await pollBinancePrice();

      const records = await PriceHistory.find({ symbol: 'BTC' });
      expect(records).toHaveLength(1);
      expect(records[0].price).toBe(65000.5);
      expect(records[0].timestamp).toBeInstanceOf(Date);
    });

    it('should broadcast priceUpdate event via SSE with an array of tickers', async () => {
      mockBinanceFetch(66000);

      await pollBinancePrice();

      expect(broadcastSpy).toHaveBeenCalledWith(
        'priceUpdate',
        expect.arrayContaining([
          expect.objectContaining({
            symbol: 'BTC',
            price: 66000
          })
        ])
      );
    });

    it('should trigger an "above" alert when price >= targetPrice', async () => {
      await Alert.create({ symbol: 'BTC', targetPrice: 60000, type: 'above' });
      mockBinanceFetch(65000);

      await pollBinancePrice();

      const alert = await Alert.findOne({ symbol: 'BTC', type: 'above' });
      expect(alert.status).toBe('triggered');
      expect(alert.triggeredAt).toBeInstanceOf(Date);
    });

    it('should broadcast alertTriggered when an "above" alert is triggered', async () => {
      await Alert.create({ symbol: 'BTC', targetPrice: 60000, type: 'above' });
      mockBinanceFetch(70000);

      await pollBinancePrice();

      expect(broadcastSpy).toHaveBeenCalledWith(
        'alertTriggered',
        expect.objectContaining({ symbol: 'BTC', type: 'above', status: 'triggered' })
      );
    });

    it('should trigger a "below" alert when price <= targetPrice', async () => {
      await Alert.create({ symbol: 'BTC', targetPrice: 70000, type: 'below' });
      mockBinanceFetch(65000);

      await pollBinancePrice();

      const alert = await Alert.findOne({ symbol: 'BTC', type: 'below' });
      expect(alert.status).toBe('triggered');
      expect(alert.triggeredAt).toBeInstanceOf(Date);
    });

    it('should broadcast alertTriggered when a "below" alert is triggered', async () => {
      await Alert.create({ symbol: 'BTC', targetPrice: 70000, type: 'below' });
      mockBinanceFetch(50000);

      await pollBinancePrice();

      expect(broadcastSpy).toHaveBeenCalledWith(
        'alertTriggered',
        expect.objectContaining({ symbol: 'BTC', type: 'below', status: 'triggered' })
      );
    });

    it('should NOT trigger an "above" alert when price < targetPrice', async () => {
      await Alert.create({ symbol: 'BTC', targetPrice: 80000, type: 'above' });
      mockBinanceFetch(65000);

      await pollBinancePrice();

      const alert = await Alert.findOne({ symbol: 'BTC', type: 'above' });
      expect(alert.status).toBe('active');

      const alertTriggeredCalls = broadcastSpy.mock.calls.filter(
        call => call[0] === 'alertTriggered'
      );
      expect(alertTriggeredCalls).toHaveLength(0);
    });

    it('should NOT trigger a "below" alert when price > targetPrice', async () => {
      await Alert.create({ symbol: 'BTC', targetPrice: 50000, type: 'below' });
      mockBinanceFetch(65000);

      await pollBinancePrice();

      const alert = await Alert.findOne({ symbol: 'BTC', type: 'below' });
      expect(alert.status).toBe('active');

      const alertTriggeredCalls = broadcastSpy.mock.calls.filter(
        call => call[0] === 'alertTriggered'
      );
      expect(alertTriggeredCalls).toHaveLength(0);
    });

    it('should ignore already-triggered alerts', async () => {
      await Alert.create({
        symbol: 'BTC',
        targetPrice: 60000,
        type: 'above',
        status: 'triggered',
        triggeredAt: new Date()
      });
      mockBinanceFetch(70000);

      await pollBinancePrice();

      const alertTriggeredCalls = broadcastSpy.mock.calls.filter(
        call => call[0] === 'alertTriggered'
      );
      expect(alertTriggeredCalls).toHaveLength(0);
    });

    it('should not crash when fetch fails', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      await expect(pollBinancePrice()).resolves.toBeNull();

      const records = await PriceHistory.find({});
      expect(records).toHaveLength(0);
    });

    it('should handle multiple simultaneous active alerts independently', async () => {
      await Alert.create({ symbol: 'BTC', targetPrice: 60000, type: 'above' });
      await Alert.create({ symbol: 'BTC', targetPrice: 70000, type: 'below' });
      await Alert.create({ symbol: 'BTC', targetPrice: 80000, type: 'above' });
      mockBinanceFetch(65000);

      await pollBinancePrice();

      const aboveAlert60k = await Alert.findOne({ targetPrice: 60000 });
      const belowAlert70k = await Alert.findOne({ targetPrice: 70000 });
      const aboveAlert80k = await Alert.findOne({ targetPrice: 80000 });

      expect(aboveAlert60k.status).toBe('triggered');
      expect(belowAlert70k.status).toBe('triggered');
      expect(aboveAlert80k.status).toBe('active');
    });
  });

  // ─── calculateIndicators ───────────────────────────────────────────────────

  describe('calculateIndicators()', () => {
    it('should calculate correct EMA, RSI, consensus and forecast', async () => {
      // Pré-remplir l'historique de prix pour tester les indicateurs (RSI 14 a besoin de >14 points)
      // On va créer 60 points de prix croissants
      const basePrice = 100;
      const historyData = [];
      for (let i = 0; i < 60; i++) {
        historyData.push({
          symbol: 'BTC',
          price: basePrice + i,
          timestamp: new Date(Date.now() - (60 - i) * 1000)
        });
      }
      await PriceHistory.insertMany(historyData);

      const indicators = await calculateIndicators('BTC');

      expect(indicators.ema20).toBeDefined();
      expect(indicators.ema20).toBeGreaterThan(100);
      expect(indicators.ema50).toBeDefined();
      expect(indicators.rsi).toBe(100); // Car les prix ne font que monter
      expect(indicators.consensus).toBe('NEUTRE'); // RSI suracheté (-2) compensé par la tendance haussière (+2)
      expect(indicators.forecast).toHaveLength(10);
      expect(indicators.forecast[0]).toBeGreaterThan(159); // La projection doit continuer la hausse
    });
  });

  // ─── startPolling / stopPolling / isPolling ────────────────────────────────

  describe('startPolling() and stopPolling()', () => {
    it('should start and stop the polling interval', () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => [{
          symbol: 'BTCUSDT',
          lastPrice: '65000',
          priceChangePercent: '1.5',
          highPrice: '66000',
          lowPrice: '64000',
          volume: '1000'
        }]
      });
      jest.useFakeTimers();

      startPolling(1000);
      expect(isPolling()).toBe(true);

      stopPolling();
      expect(isPolling()).toBe(false);

      jest.useRealTimers();
    });
  });
});
