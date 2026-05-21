/**
 * Routes API pour la gestion des alertes de prix.
 * Base: /api/alerts
 */

const express = require('express');
const router = express.Router();
const { getAllAlerts, createAlert, deleteAlert } = require('../controllers/alertController');

// GET  /api/alerts      → Récupérer toutes les alertes
router.get('/', getAllAlerts);

// POST /api/alerts      → Créer une nouvelle alerte
router.post('/', createAlert);

// DELETE /api/alerts/:id → Supprimer une alerte par son ID
router.delete('/:id', deleteAlert);

module.exports = router;
