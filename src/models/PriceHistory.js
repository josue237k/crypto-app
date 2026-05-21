const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
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

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
