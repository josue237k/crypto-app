'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const alertRoutes = require('./routes/alertRoutes');
const priceRoutes = require('./routes/priceRoutes');
const newsRoutes = require('./routes/newsRoutes');
const binanceService = require('./services/binanceService');

// ─── Application ──────────────────────────────────────────────────────────────

const app = express();

// Production hardening ( Helmet & Compression )
if (process.env.NODE_ENV === 'production') {
  const helmet = require('helmet');
  const compression = require('compression');
  app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: [
            "'self'",
            "https://api.binance.com",
            "wss://stream.binance.com",
            "https://cointelegraph.com",
            "https://*.binance.com",
            "wss://*.binance.com",
            "https://*.cointelegraph.com"
          ],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    })
  );
}

// Middlewares
app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/alerts', alertRoutes);
app.use('/api/price', priceRoutes);
app.use('/api/news', newsRoutes);

// Fichiers statiques (frontend)
app.use(express.static(path.join(__dirname, 'public')));
// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

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
