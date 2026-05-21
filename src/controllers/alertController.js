/**
 * Contrôleur des alertes de prix.
 * Gère la création, la récupération et la suppression des alertes.
 */

const Alert = require('../models/Alert');

/**
 * GET /api/alerts
 * Retourne toutes les alertes (actives + déclenchées), triées par date de création décroissante.
 */
async function getAllAlerts(req, res) {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    console.error('Erreur lors de la récupération des alertes:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des alertes.' });
  }
}

/**
 * POST /api/alerts
 * Crée une nouvelle alerte de prix.
 * Body attendu: { targetPrice: Number, type: 'above' | 'below' }
 */
async function createAlert(req, res) {
  try {
    const { targetPrice, type } = req.body;

    if (targetPrice === undefined || !type) {
      return res.status(400).json({ error: 'Les champs targetPrice et type sont requis.' });
    }

    const alert = await Alert.create({ targetPrice, type });
    res.status(201).json(alert);
  } catch (error) {
    // Erreur de validation Mongoose
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors de la création de l\'alerte:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la création de l\'alerte.' });
  }
}

/**
 * DELETE /api/alerts/:id
 * Supprime une alerte par son identifiant MongoDB.
 */
async function deleteAlert(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Alert.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Alerte introuvable.' });
    }

    res.json({ message: 'Alerte supprimée avec succès.', alert: deleted });
  } catch (error) {
    // ObjectId invalide
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Identifiant d\'alerte invalide.' });
    }
    console.error('Erreur lors de la suppression de l\'alerte:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression de l\'alerte.' });
  }
}

module.exports = {
  getAllAlerts,
  createAlert,
  deleteAlert
};
