const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    default: 'BTC'
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Le prix doit être supérieur ou égal à 0']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: { expires: '24h' }
  }
});

priceHistorySchema.index({ symbol: 1, timestamp: -1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
