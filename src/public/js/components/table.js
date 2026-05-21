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
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-msg">Aucune donnée de marché disponible</td></tr>`;
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
