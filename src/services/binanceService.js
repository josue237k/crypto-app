const PriceHistory = require('../models/PriceHistory');
const Alert = require('../models/Alert');
const sseService = require('./sseService');
// dotenv is loaded once at the entry point (server.js)

let intervalId = null;

/**
 * Effectue un fetch sur l'API Binance pour récupérer le prix du BTCUSDT,
 * l'enregistre en base de données, diffuse le prix via SSE, et évalue les alertes actives.
 * 
 * @returns {Promise<Object|null>} L'enregistrement PriceHistory créé, ou null en cas d'erreur.
 */
async function pollBinancePrice() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const price = parseFloat(data.price);

    if (isNaN(price)) {
      throw new Error('Le prix obtenu de l\'API Binance n\'est pas un nombre valide');
    }

    // Sauvegarde du prix dans PriceHistory
    const priceRecord = await PriceHistory.create({ price });

    // Diffusion de la mise à jour aux clients SSE
    sseService.broadcast('priceUpdate', {
      price: priceRecord.price,
      timestamp: priceRecord.timestamp
    });

    // Récupération de toutes les alertes actives
    const activeAlerts = await Alert.find({ status: 'active' });

    for (const alert of activeAlerts) {
      let isTriggered = false;

      if (alert.type === 'above' && price >= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.type === 'below' && price <= alert.targetPrice) {
        isTriggered = true;
      }

      if (isTriggered) {
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        await alert.save();

        // Diffusion immédiate de l'alerte déclenchée
        // Diffusion immédiate de l'alerte déclenchée (plain object pour éviter
        // de sérialiser les internals Mongoose comme __v)
        sseService.broadcast('alertTriggered', alert.toObject());
      }
    }

    return priceRecord;
  } catch (error) {
    console.error('Erreur lors du polling du prix Binance:', error);
    return null;
  }
}

/**
 * Démarre le polling du prix Binance à intervalle régulier.
 * 
 * @param {number} [intervalMs] - L'intervalle de temps en millisecondes.
 */
function startPolling(intervalMs) {
  if (intervalId) {
    return;
  }

  const pollInterval = intervalMs || parseInt(process.env.BINANCE_POLL_INTERVAL, 10) || 5000;

  // Lance le polling immédiatement au démarrage
  pollBinancePrice();

  intervalId = setInterval(pollBinancePrice, pollInterval);
}

/**
 * Arrête le polling du prix Binance.
 */
function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Indique si le polling est actuellement actif.
 * @returns {boolean}
 */
function isPolling() {
  return intervalId !== null;
}

module.exports = {
  pollBinancePrice,
  startPolling,
  stopPolling,
  isPolling
};
