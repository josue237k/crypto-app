/**
 * Chart Module.
 * Renders the premium multi-line SVG chart containing the main price line,
 * EMA 20, EMA 50, and linear regression forecast.
 */

// Helper: Calculate EMA for the entire series
function computeHistoricalEMA(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  let ema = prices[0];
  const emas = [];
  
  // Fill initial elements with null or first prices
  for (let i = 0; i < period - 1; i++) {
    emas.push(null);
  }
  
  emas.push(parseFloat(ema.toFixed(2)));
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] * k) + ema * (1 - k);
    emas.push(parseFloat(ema.toFixed(2)));
  }
  return emas;
}

export function drawChart(historyData, indicators) {
  if (!historyData || historyData.length < 2) return;

  const svg = document.getElementById('priceChart');
  const pathLine = document.getElementById('chartLine');
  const pathFill = document.getElementById('chartFill');
  const pathEMA20 = document.getElementById('chartEMA20');
  const pathEMA50 = document.getElementById('chartEMA50');
  const pathForecast = document.getElementById('chartForecast');

  const width = 500;
  const height = 200;
  const padding = 15;

  const prices = historyData.map(d => d.price);
  
  // Extract forecast from indicators
  const forecast = indicators?.forecast || [];
  
  // Find overall min and max including forecast to scale properly
  const allValues = [...prices, ...forecast];
  const minPrice = Math.min(...allValues) * 0.999;
  const maxPrice = Math.max(...allValues) * 1.001;
  const priceRange = maxPrice - minPrice;

  // Total horizontal points = history length + forecast length
  const totalSteps = historyData.length + forecast.length - 1;
  
  // Points calculation helper
  const getCoords = (index, value) => {
    const x = padding + (index / totalSteps) * (width - 2 * padding);
    const y = height - padding - ((value - minPrice) / priceRange) * (height - 2 * padding);
    return { x, y };
  };

  // 1. Draw Main Price Line
  let points = prices.map((p, i) => getCoords(i, p));
  const linePathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  pathLine.setAttribute('d', linePathD);

  // Draw Main Price Fill Gradient
  const fillPathD = `${linePathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  pathFill.setAttribute('d', fillPathD);

  // 2. Draw EMA 20 & 50 lines
  const emas20 = computeHistoricalEMA(prices, 20);
  const emas50 = computeHistoricalEMA(prices, 50);

  if (emas20.length > 0 && pathEMA20) {
    const ema20Points = emas20.map((v, i) => v !== null ? getCoords(i, v) : null);
    const firstValidIndex = ema20Points.findIndex(p => p !== null);
    if (firstValidIndex !== -1) {
      const ema20PathD = ema20Points.slice(firstValidIndex).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      pathEMA20.setAttribute('d', ema20PathD);
      pathEMA20.style.display = 'block';
    } else {
      pathEMA20.style.display = 'none';
    }
  }

  if (emas50.length > 0 && pathEMA50) {
    const ema50Points = emas50.map((v, i) => v !== null ? getCoords(i, v) : null);
    const firstValidIndex = ema50Points.findIndex(p => p !== null);
    if (firstValidIndex !== -1) {
      const ema50PathD = ema50Points.slice(firstValidIndex).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      pathEMA50.setAttribute('d', ema50PathD);
      pathEMA50.style.display = 'block';
    } else {
      pathEMA50.style.display = 'none';
    }
  }

  // 3. Draw Linear Regression Forecast Line (Extending from the last history point)
  if (forecast.length > 0 && pathForecast) {
    const forecastPoints = [];
    // Start from the last history point
    const lastHistIdx = prices.length - 1;
    forecastPoints.push(getCoords(lastHistIdx, prices[lastHistIdx]));

    forecast.forEach((v, i) => {
      forecastPoints.push(getCoords(lastHistIdx + 1 + i, v));
    });

    const forecastPathD = forecastPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    pathForecast.setAttribute('d', forecastPathD);
    pathForecast.style.display = 'block';
  } else if (pathForecast) {
    pathForecast.style.display = 'none';
  }

  // 4. Update the Consensus & RSI visual badges
  updateIndicatorsInfo(indicators, prices[prices.length - 1]);
}

function updateIndicatorsInfo(indicators, currentPrice) {
  const rsiValEl = document.getElementById('rsiValue');
  const consensusEl = document.getElementById('consensusBadge');
  const trendProjEl = document.getElementById('trendProjection');

  if (rsiValEl) {
    if (indicators && indicators.rsi !== null) {
      rsiValEl.textContent = `RSI(14) : ${indicators.rsi}`;
      
      // Dynamic styling depending on oversold/overbought
      rsiValEl.className = 'indicator-badge';
      if (indicators.rsi < 30) rsiValEl.classList.add('oversold');
      else if (indicators.rsi > 70) rsiValEl.classList.add('overbought');
    } else {
      rsiValEl.textContent = 'RSI(14) : —';
      rsiValEl.className = 'indicator-badge';
    }
  }

  if (consensusEl) {
    if (indicators && indicators.consensus) {
      consensusEl.textContent = indicators.consensus;
      
      // Map class to consensus score
      consensusEl.className = 'consensus-badge';
      if (indicators.consensus.includes('ACHAT FORT')) {
        consensusEl.classList.add('strong-buy');
      } else if (indicators.consensus.includes('ACHAT')) {
        consensusEl.classList.add('buy');
      } else if (indicators.consensus.includes('VENTE FORTE')) {
        consensusEl.classList.add('strong-sell');
      } else if (indicators.consensus.includes('VENTE')) {
        consensusEl.classList.add('sell');
      } else {
        consensusEl.classList.add('neutral');
      }
    } else {
      consensusEl.textContent = 'NEUTRE';
      consensusEl.className = 'consensus-badge neutral';
    }
  }

  if (trendProjEl && indicators && indicators.forecast && indicators.forecast.length > 0) {
    const start = currentPrice;
    const end = indicators.forecast[indicators.forecast.length - 1];
    const diffPct = ((end - start) / start) * 100;
    const sign = diffPct >= 0 ? '+' : '';
    trendProjEl.textContent = `Proj. 24h : ${sign}${diffPct.toFixed(2)}%`;
    trendProjEl.className = diffPct >= 0 ? 'projection-badge positive' : 'projection-badge negative';
  } else if (trendProjEl) {
    trendProjEl.textContent = 'Proj. 24h : —';
    trendProjEl.className = 'projection-badge';
  }
}
