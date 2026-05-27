/**
 * Table & Ticker Module.
 * Renders the top ticker and the Top 50 sortable crypto market table.
 */

let lastPrices = {}; // Keep track of previous prices for pulse animation
let visibleCount = 10;
let lastSearchQuery = '';

export function renderTicker(tickers) {
  const tickerTape = document.getElementById('tickerTape');
  if (!tickerTape) return;

  const coreCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
  
  // Clean tape
  tickerTape.innerHTML = '';

  coreCoins.forEach(symbol => {
    const data = tickers[symbol];
    if (!data) return;

    const tickerItem = document.createElement('div');
    tickerItem.className = 'ticker-item';
    tickerItem.dataset.symbol = symbol;

    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: symbol === 'BNB' || symbol === 'SOL' ? 2 : (data.price < 1 ? 4 : 2)
    }).format(data.price);

    const changeClass = data.changePercent >= 0 ? 'up' : 'down';
    const changeSign = data.changePercent >= 0 ? '+' : '';

    tickerItem.innerHTML = `
      <span class="ticker-symbol">${symbol}</span>
      <span class="ticker-price">${formattedPrice}</span>
      <span class="ticker-change ${changeClass}">${changeSign}${data.changePercent.toFixed(2)}%</span>
    `;

    tickerTape.appendChild(tickerItem);
  });
}

function generateSparklineSVG(ticker) {
  const change = ticker.changePercent;
  const isUp = change >= 0;
  const strokeColor = isUp ? 'var(--emerald-neon)' : 'var(--corail-neon)';
  
  const seed = ticker.symbol.charCodeAt(0) + ticker.symbol.charCodeAt(ticker.symbol.length - 1);
  const points = [];
  const count = 7;
  
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * 60; // 60px width
    const rand = Math.sin(seed + i * 2.3) * 6;
    const trend = (i / (count - 1)) * change * 0.8;
    const y = 15 - rand - trend;
    points.push(`${x},${Math.max(2, Math.min(28, y))}`);
  }
  
  const pathData = `M ${points.join(' L ')}`;
  
  return `
    <svg class="sparkline-svg" width="60" height="30" viewBox="0 0 60 30" style="overflow: visible; filter: drop-shadow(0 0 4px ${isUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'});">
      <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

export function renderTable(tickers, selectedSymbol, onSelectCallback) {
  const tableBody = document.getElementById('marketTableBody');
  if (!tableBody) return;

  const query = document.getElementById('coinSearch')?.value.toLowerCase() || '';

  // Reset pagination count if query changes
  if (query !== lastSearchQuery) {
    visibleCount = 10;
    lastSearchQuery = query;
  }

  // Get and sort tickers by 24h USD volume (volume * price)
  const tickersList = Object.values(tickers).sort((a, b) => b.volume * b.price - a.volume * a.price);

  // Filter based on search input
  let filteredList = tickersList;
  if (query) {
    filteredList = tickersList.filter(ticker => ticker.symbol.toLowerCase().includes(query));
  }

  tableBody.innerHTML = '';

  if (filteredList.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-msg">Aucune donnée de marché disponible</td></tr>`;
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  // Slice list by visibleCount
  const slicedList = filteredList.slice(0, visibleCount);

  // Handle Load More Button visibility
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    if (filteredList.length > visibleCount) {
      loadMoreBtn.style.display = 'inline-block';
      loadMoreBtn.onclick = () => {
        visibleCount += 10;
        renderTable(tickers, selectedSymbol, onSelectCallback);
      };
    } else {
      loadMoreBtn.style.display = 'none';
    }
  }

  slicedList.forEach(ticker => {
    const symbol = ticker.symbol;
    const isSelected = symbol === selectedSymbol;
    
    const tr = document.createElement('tr');
    tr.className = isSelected ? 'market-row active' : 'market-row';
    tr.dataset.symbol = symbol;

    // Detect price movement for visual pulse
    const prev = lastPrices[symbol];
    let pulseClass = '';
    if (prev !== undefined) {
      if (ticker.price > prev) pulseClass = 'pulse-up';
      else if (ticker.price < prev) pulseClass = 'pulse-down';
    }
    lastPrices[symbol] = ticker.price;

    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: ticker.price < 1 ? 4 : 2
    }).format(ticker.price);

    const formattedHigh = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: ticker.price < 1 ? 4 : 2
    }).format(ticker.high);

    const formattedLow = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: ticker.price < 1 ? 4 : 2
    }).format(ticker.low);

    const changeClass = ticker.changePercent >= 0 ? 'pct-up' : 'pct-down';
    const changeSign = ticker.changePercent >= 0 ? '+' : '';

    // Find the rank in the entire volume-sorted tickers list
    const rank = tickersList.indexOf(ticker) + 1;

    const sparklineHTML = generateSparklineSVG(ticker);

    tr.innerHTML = `
      <td>
        <div class="coin-info">
          <span class="coin-rank">#${rank}</span>
          <span class="coin-symbol">${symbol}</span>
        </div>
      </td>
      <td class="price-cell ${pulseClass}">${formattedPrice}</td>
      <td class="change-cell ${changeClass}">${changeSign}${ticker.changePercent.toFixed(2)}%</td>
      <td class="high-low-cell">${formattedHigh} / ${formattedLow}</td>
      <td>
        <div class="sparkline-wrapper">${sparklineHTML}</div>
      </td>
      <td>
        <button class="btn-select-coin">${isSelected ? 'Actif' : 'Analyser'}</button>
      </td>
    `;

    // Hook row click
    tr.addEventListener('click', () => {
      onSelectCallback(symbol);
    });

    tableBody.appendChild(tr);
  });
}
