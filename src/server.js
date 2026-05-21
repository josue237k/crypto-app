'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const alertRoutes = require('./routes/alertRoutes');
const priceRoutes = require('./routes/priceRoutes');
const binanceService = require('./services/binanceService');

// ─── Application ──────────────────────────────────────────────────────────────

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/alerts', alertRoutes);
app.use('/api/price', priceRoutes);

// Fichiers statiques (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// ─── Démarrage du serveur ─────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

/**
 * Initialise la connexion MongoDB puis démarre le serveur Express.
 * Le polling Binance est démarré uniquement hors environnement de test.
 */
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
    });

    // Ne pas démarrer le polling en environnement de test
    if (process.env.NODE_ENV !== 'test') {
      binanceService.startPolling();
    }
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error.message);
    process.exit(1);
  }
}

// Démarrer uniquement si exécuté directement (pas importé par les tests)
if (require.main === module) {
  startServer();
}

module.exports = app;
