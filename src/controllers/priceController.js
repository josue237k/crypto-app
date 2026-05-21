const PriceHistory = require('../models/PriceHistory');
const sseService = require('../services/sseService');
const binanceService = require('../services/binanceService');

/**
 * GET /api/price/history
 * Retourne les 100 derniers enregistrements de prix pour le symbole spécifié,
 * triés par timestamp croissant, ainsi que les indicateurs techniques calculés.
 */
async function getPriceHistory(req, res, next) {
  try {
    const symbol = (req.query.symbol || 'BTC').toUpperCase();
    const history = await PriceHistory.find({ symbol })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    // Calculer les indicateurs en utilisant le service binance
    const indicators = await binanceService.calculateIndicators(symbol);

    // Retourner l'historique trié du plus ancien au plus récent (graphique)
    res.json({
      symbol,
      history: history.reverse(),
      indicators
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/price/stream
 * Établit une connexion SSE pour recevoir les mises à jour de prix en temps réel.
 */
function streamPrice(req, res, next) {
  try {
    sseService.registerClient(req, res);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPriceHistory,
  streamPrice
};
