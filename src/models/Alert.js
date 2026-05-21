const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
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

module.exports = mongoose.model('Alert', alertSchema);
