const PriceHistory = require('../models/PriceHistory');
const Alert = require('../models/Alert');
const sseService = require('./sseService');

let intervalId = null;
let latestTickers = {}; // Cache mémoire des derniers tickers { BTC: { price: 67000, changePercent: 1.5, high: 68000, low: 66000 } }

// Top 50 des cryptomonnaies cibles par rapport à l'USDT
const TARGET_COINS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'SHIB', 'AVAX', 'DOT',
  'LINK', 'NEAR', 'MATIC', 'LTC', 'BCH', 'UNI', 'APT', 'SUI', 'ATOM', 'FIL',
  'ETC', 'ICP', 'IMX', 'GRT', 'LDO', 'HBAR', 'VET', 'RNDR', 'OP', 'ARB',
  'MKR', 'AAVE', 'EGLD', 'THETA', 'INJ', 'TIA', 'STX', 'WIF', 'PEPE', 'FLOKI',
  'BONK', 'FTM', 'RUNE', 'GALA', 'BEAM', 'AGIX', 'FET', 'OCEAN', 'JASMY', 'SEI'
];

const CORE_COINS = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP']);

/**
 * Récupère le cours en temps réel pour le Top 50 des cryptomonnaies via l'API Binance (en une seule requête groupée),
 * enregistre l'historique des pièces actives, évalue les alertes et diffuse les prix par SSE.
 * 
 * @returns {Promise<Array|null>} La liste des tickers mis à jour, ou null en cas d'erreur.
 */
async function pollBinancePrice() {
  try {
    const symbolsQuery = TARGET_COINS.map(coin => `"${coin}USDT"`).join(',');
    // Render hosts in the USA where standard api.binance.com is geoblocked.
    // We use api-g.binance.com (or api.binance.us or a public proxy/alternative domain) to avoid 451.
    const url = `https://api-g.binance.com/api/v3/ticker/24hr?symbols=[${symbolsQuery}]`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rawTickers = await response.json();
    const timestamp = new Date();

    const updatedTickers = [];
    const priceHistoriesToInsert = [];
    const triggeredAlertPromises = [];

    // Récupération de toutes les alertes actives pour cibler les cryptos à sauvegarder
    const activeAlerts = await Alert.find({ status: 'active' });
    const coinsWithAlerts = new Set(activeAlerts.map(a => a.symbol));

    for (const raw of rawTickers) {
      const symbol = raw.symbol.replace('USDT', '');
      const price = parseFloat(raw.lastPrice);
      const changePercent = parseFloat(raw.priceChangePercent);
      const high = parseFloat(raw.highPrice);
      const low = parseFloat(raw.lowPrice);
      const volume = parseFloat(raw.volume);

      if (isNaN(price)) continue;

      // Mettre à jour le cache mémoire
      latestTickers[symbol] = {
        symbol,
        price,
        changePercent,
        high,
        low,
        volume,
        timestamp
      };

      updatedTickers.push(latestTickers[symbol]);

      // Sauvegarde sélective de l'historique pour éviter d'inonder MongoDB
      if (CORE_COINS.has(symbol) || coinsWithAlerts.has(symbol)) {
        priceHistoriesToInsert.push({
          symbol,
          price,
          timestamp
        });
      }

      // Évaluer les alertes actives pour cette cryptomonnaie
      const alertsForCoin = activeAlerts.filter(a => a.symbol === symbol);
      for (const alert of alertsForCoin) {
        let isTriggered = false;

        if (alert.type === 'above' && price >= alert.targetPrice) {
          isTriggered = true;
        } else if (alert.type === 'below' && price <= alert.targetPrice) {
          isTriggered = true;
        }

        if (isTriggered) {
          alert.status = 'triggered';
          alert.triggeredAt = timestamp;
          
          triggeredAlertPromises.push(
            (async () => {
              await alert.save();
              sseService.broadcast('alertTriggered', alert.toObject());
            })()
          );
        }
      }
    }

    // Effectuer l'insertion groupée de l'historique des prix
    if (priceHistoriesToInsert.length > 0) {
      await PriceHistory.insertMany(priceHistoriesToInsert);
    }

    // Exécuter en parallèle la sauvegarde des alertes déclenchées
    if (triggeredAlertPromises.length > 0) {
      await Promise.all(triggeredAlertPromises);
    }

    // Diffuser la mise à jour globale des prix aux clients connectés
    sseService.broadcast('priceUpdate', updatedTickers);

    return updatedTickers;
  } catch (error) {
    console.error('Erreur lors du polling global Binance:', error);
    return null;
  }
}

/**
 * Démarre le polling récurrent Binance.
 * 
 * @param {number} [intervalMs] - L'intervalle de temps en millisecondes.
 */
function startPolling(intervalMs) {
  if (intervalId) {
    return;
  }

  const pollInterval = intervalMs || parseInt(process.env.BINANCE_POLL_INTERVAL, 10) || 5000;

  // Lancement immédiat
  pollBinancePrice();

  intervalId = setInterval(pollBinancePrice, pollInterval);
}

/**
 * Arrête le polling.
 */
function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Indique si le polling est actif.
 * @returns {boolean}
 */
function isPolling() {
  return intervalId !== null;
}

/**
 * Renvoie le cache en mémoire des derniers tickers.
 * @returns {Object}
 */
function getLatestTickers() {
  return latestTickers;
}

/**
 * Calcule l'EMA d'une série de prix.
 */
function calculateEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * k) + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(2));
}

/**
 * Calcule le RSI d'une série de prix.
 */
function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return null;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return parseFloat(rsi.toFixed(2));
}

/**
 * Projette les futurs prix à l'aide d'une régression linéaire.
 */
function calculateForecast(prices, steps = 10) {
  if (prices.length < 5) return [];
  const n = prices.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const lastPrice = prices[n - 1];

  const forecast = [];
  for (let step = 1; step <= steps; step++) {
    const projected = lastPrice + (slope * step);
    forecast.push(parseFloat(projected.toFixed(2)));
  }
  return forecast;
}

/**
 * Détermine le consensus de trading.
 */
function getConsensus(rsi, price, ema20, ema50) {
  if (rsi === null) return 'NEUTRE';

  let score = 0;
  if (rsi < 30) score += 2;
  else if (rsi < 45) score += 1;
  else if (rsi > 70) score -= 2;
  else if (rsi > 55) score -= 1;

  if (ema20 && ema50) {
    if (ema20 > ema50) score += 1;
    else score -= 1;

    if (price > ema20) score += 1;
    else score -= 1;
  }

  if (score >= 3) return 'ACHAT FORT';
  if (score >= 1) return 'ACHAT';
  if (score <= -3) return 'VENTE FORTE';
  if (score <= -1) return 'VENTE';
  return 'NEUTRE';
}

/**
 * Calcule tous les indicateurs et prédictions pour un symbole donné.
 * @param {string} symbol - Le symbole de la crypto (ex: 'BTC').
 * @returns {Promise<Object>} Les indicateurs techniques calculés.
 */
async function calculateIndicators(symbol) {
  const history = await PriceHistory.find({ symbol: symbol.toUpperCase() })
    .sort({ timestamp: 1 })
    .limit(100);

  const prices = history.map(h => h.price);
  const currentPrice = prices[prices.length - 1] || null;

  const ema20 = calculateEMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);
  const rsi = calculateRSI(prices, 14);
  const consensus = getConsensus(rsi, currentPrice, ema20, ema50);
  const forecast = calculateForecast(prices, 10);

  return {
    ema20,
    ema50,
    rsi,
    consensus,
    forecast
  };
}

module.exports = {
  pollBinancePrice,
  startPolling,
  stopPolling,
  isPolling,
  getLatestTickers,
  calculateIndicators,
  TARGET_COINS
};
