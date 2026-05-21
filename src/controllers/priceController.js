/**
 * Contrôleur de l'historique de prix et du flux SSE.
 * Gère la récupération de l'historique des prix et l'enregistrement des clients SSE.
 */

const PriceHistory = require('../models/PriceHistory');
const sseService = require('../services/sseService');

/**
 * GET /api/price/history
 * Retourne les 100 derniers enregistrements de prix, triés par timestamp croissant.
 */
async function getPriceHistory(req, res) {
  try {
    const history = await PriceHistory.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    // Retourner du plus ancien au plus récent pour le graphique
    res.json(history.reverse());
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique des prix:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération de l\'historique.' });
  }
}

/**
 * GET /api/price/stream
 * Établit une connexion SSE pour recevoir les mises à jour de prix en temps réel.
 */
function streamPrice(req, res) {
  sseService.registerClient(req, res);
}

module.exports = {
  getPriceHistory,
  streamPrice
};
