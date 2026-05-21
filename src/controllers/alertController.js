/**
 * Contrôleur des alertes de prix.
 * Gère la création, la récupération et la suppression des alertes.
 */

const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const { TARGET_COINS } = require('../services/binanceService');

/**
 * GET /api/alerts
 * Retourne toutes les alertes (actives + déclenchées), triées par date de création décroissante.
 */
async function getAllAlerts(req, res, next) {
  try {
    const filter = {};
    if (req.query.symbol) {
      if (typeof req.query.symbol !== 'string' || req.query.symbol.trim() === '') {
        return res.status(400).json({ error: 'Le filtre de symbole doit être une chaîne non vide.' });
      }
      filter.symbol = req.query.symbol.toUpperCase();
    }
    const alerts = await Alert.find(filter).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/alerts
 * Crée une nouvelle alerte de prix.
 * Body attendu: { symbol: String, targetPrice: Number, type: 'above' | 'below' }
 */
async function createAlert(req, res, next) {
  try {
    const { symbol, targetPrice, type } = req.body;

    const sym = symbol !== undefined && symbol !== null ? symbol : 'BTC';

    if (typeof sym !== 'string' || sym.trim() === '') {
      return res.status(400).json({ error: 'Le symbole doit être une chaîne non vide.' });
    }

    const upperSym = sym.toUpperCase();
    if (!TARGET_COINS.includes(upperSym)) {
      return res.status(400).json({ error: 'Symbole non supporté.' });
    }

    if (targetPrice === undefined || targetPrice === null || typeof targetPrice !== 'number' || isNaN(targetPrice) || targetPrice <= 0) {
      return res.status(400).json({ error: 'Le prix cible doit être un nombre positif.' });
    }

    if (type !== 'above' && type !== 'below') {
      return res.status(400).json({ error: 'Le type d\'alerte doit être "above" ou "below".' });
    }

    const alert = await Alert.create({ 
      symbol: upperSym, 
      targetPrice, 
      type 
    });
    res.status(201).json(alert);
  } catch (error) {
    // Erreur de validation Mongoose
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * DELETE /api/alerts/:id
 * Supprime une alerte par son identifiant MongoDB.
 */
async function deleteAlert(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Identifiant d\'alerte invalide.' });
    }

    const deleted = await Alert.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Alerte introuvable.' });
    }

    res.json({ message: 'Alerte supprimée avec succès.', alert: deleted });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/alerts/triggered
 * Supprime toutes les alertes de statut 'triggered' (historique des alertes).
 */
async function clearTriggeredAlerts(req, res, next) {
  try {
    const result = await Alert.deleteMany({ status: 'triggered' });
    res.json({ message: 'Historique des alertes vidé avec succès.', count: result.deletedCount });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllAlerts,
  createAlert,
  deleteAlert,
  clearTriggeredAlerts
};
