const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: [true, 'Le symbole de la crypto est requis'],
    uppercase: true,
    trim: true,
    default: 'BTC'
  },
  targetPrice: {
    type: Number,
    required: true,
    min: [0, 'Le prix cible doit être supérieur ou égal à 0']
  },
  type: {
    type: String,
    enum: {
      values: ['above', 'below'],
      message: 'Le type doit être "above" (supérieur à) ou "below" (inférieur à)'
    },
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'triggered'],
    default: 'active'
  },
  triggeredAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index composé pour optimiser l'évaluation des alertes actives par symbole
alertSchema.index({ symbol: 1, status: 1 });

module.exports = mongoose.model('Alert', alertSchema);
