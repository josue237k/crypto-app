/**
 * Routes API pour les actualités crypto.
 * Base: /api/news
 */

const express = require('express');
const router = express.Router();
const { getNews } = require('../controllers/newsController');

// GET /api/news → Flux d'actualités en temps réel
router.get('/', getNews);

module.exports = router;
