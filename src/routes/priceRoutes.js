/**
 * Routes API pour l'historique de prix et le flux SSE.
 * Base: /api/price
 */

const express = require('express');
const router = express.Router();
const { getPriceHistory, streamPrice } = require('../controllers/priceController');
const binanceService = require('../services/binanceService');

// GET /api/price/history → Historique des 100 derniers prix
router.get('/history', getPriceHistory);

// GET /api/price/stream  → Flux SSE en temps réel
router.get('/stream', streamPrice);

// GET /api/price/latest  → Derniers tickers en mémoire
router.get('/latest', (req, res) => {
  res.json(binanceService.getLatestTickers());
});

module.exports = router;
