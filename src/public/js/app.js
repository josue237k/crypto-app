/**
 * CryptoAlert — Premium Modular Frontend Orchestrator
 * Structured as an ES6 module to coordinate the modular components.
 */

import { initTheme } from './components/theme.js';
import { renderTicker, renderTable } from './components/table.js';
import { drawChart } from './components/chart.js';
import { initNews, fetchAndRenderNews } from './components/news.js';
import { fetchAndRenderAlerts, createAlert, showToast, playAlertSound } from './components/alerts.js';

// ─── State Variables ─────────────────────────────────────────────────────────
let selectedSymbol = 'BTC';
let marketTickers = {};
let priceHistory = [];
let currentIndicators = {};
let selectedTriggerType = 'above';
let sseSource = null;

// Track previous price for pulse animation
let lastPrice = 0;

// ─── Event Listeners & Startup ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Call initTheme() to activate theme switching
  initTheme();

  // Call initNews() to start news feeds
  initNews();

  // Wire up form inputs
  setupSearchInput();
  setupTriggerToggle();
  setupAlertForm();
  setupClearHistory();
  setupExpressConverter();

  // Fetch initial coin data
  fetchInitialCoinData(selectedSymbol);

  // Fetch all latest tickers instantly to avoid waiting for the first SSE tick
  fetchLatestTickers();

  // Initialize client-side hash router
  initRouter();

  // Connect to live SSE stream
  connectSSE();
});

async function fetchLatestTickers() {
  try {
    const res = await fetch('/api/price/latest');
    if (res.ok) {
      const tickers = await res.json();
      Object.keys(tickers).forEach(symbol => {
        marketTickers[symbol] = tickers[symbol];
      });
      renderTicker(marketTickers);
      renderTable(marketTickers, selectedSymbol, handleCoinSelect);
      updateGlobalSentiment();
      updateConverterDisplay();
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des derniers tickers:', error);
  }
}

// ─── Setup Form & Search Inputs Helpers ──────────────────────────────────────
function setupSearchInput() {
  const coinSearch = document.getElementById('coinSearch');
  if (coinSearch) {
    coinSearch.addEventListener('input', () => {
      // Re-render table on user keystroke to filter top coins
      renderTable(marketTickers, selectedSymbol, handleCoinSelect);
    });
  }
}

function setupTriggerToggle() {
  const toggleButtons = document.querySelectorAll('.btn-toggle');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      
      // Update trigger type state variable
      selectedTriggerType = btn.dataset.type || 'above';
    });
  });
}

function setupAlertForm() {
  const alertForm = document.getElementById('alertForm');
  const targetPriceInput = document.getElementById('targetPrice');
  
  if (alertForm) {
    alertForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!targetPriceInput) return;

      const price = parseFloat(targetPriceInput.value);
      if (isNaN(price) || price <= 0) return;

      // call createAlert to submit the target alert limit
      const success = await createAlert(selectedSymbol, price, selectedTriggerType);
      if (success) {
        // Clear input on success
        targetPriceInput.value = '';
      }
    });
  }
}

function setupClearHistory() {
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/alerts/triggered', { method: 'DELETE' });
        if (res.ok) {
          // Reload alerts for the currently active coin
          await fetchAndRenderAlerts(selectedSymbol);
          
          // Show toast notification
          const toastContainer = document.getElementById('toastContainer');
          if (toastContainer) {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `
              <div class="toast-icon">🗑️</div>
              <div class="toast-body">
                <div class="toast-title">Historique vidé</div>
                <div class="toast-desc">Toutes les alertes déclenchées ont été supprimées.</div>
              </div>
            `;
            toastContainer.appendChild(toast);
            setTimeout(() => {
              toast.classList.add('fade-out');
              toast.addEventListener('transitionend', () => toast.remove());
            }, 3000);
          }
        } else {
          console.error('Erreur API lors du nettoyage des alertes déclenchées');
        }
      } catch (error) {
        console.error('Erreur lors du nettoyage de l\'historique des alertes:', error);
      }
    });
  }
}

function setupExpressConverter() {
  const cryptoInput = document.getElementById('converterCryptoInput');
  const usdtInput = document.getElementById('converterUsdtInput');
  
  if (cryptoInput && usdtInput) {
    cryptoInput.addEventListener('input', () => {
      const activePrice = marketTickers[selectedSymbol]?.price || 0;
      if (activePrice > 0) {
        const val = parseFloat(cryptoInput.value);
        if (!isNaN(val) && val >= 0) {
          usdtInput.value = (val * activePrice).toFixed(2);
        } else {
          usdtInput.value = '';
        }
      }
    });

    usdtInput.addEventListener('input', () => {
      const activePrice = marketTickers[selectedSymbol]?.price || 0;
      if (activePrice > 0) {
        const val = parseFloat(usdtInput.value);
        if (!isNaN(val) && val >= 0) {
          cryptoInput.value = (val / activePrice).toFixed(6);
        } else {
          cryptoInput.value = '';
        }
      }
    });
  }
}

function updateConverterDisplay() {
  const cryptoSymbolEl = document.getElementById('converterCryptoSymbol');
  const rateTextEl = document.getElementById('converterRateText');
  const cryptoInput = document.getElementById('converterCryptoInput');
  const usdtInput = document.getElementById('converterUsdtInput');

  if (cryptoSymbolEl) cryptoSymbolEl.textContent = selectedSymbol;

  const activePrice = marketTickers[selectedSymbol]?.price || 0;
  if (rateTextEl) {
    if (activePrice > 0) {
      const formattedPrice = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: activePrice < 1 ? 4 : 2
      }).format(activePrice);
      rateTextEl.textContent = `1 ${selectedSymbol} = ${formattedPrice}`;
    } else {
      rateTextEl.textContent = `1 ${selectedSymbol} = — USDT`;
    }
  }

  // Update USDT target value based on current activePrice and cryptoInput value
  if (cryptoInput && usdtInput && activePrice > 0) {
    const val = parseFloat(cryptoInput.value);
    if (!isNaN(val) && val >= 0) {
      usdtInput.value = (val * activePrice).toFixed(2);
    }
  }
}

function updateGlobalSentiment() {
  const tickersArray = Object.values(marketTickers);
  if (tickersArray.length === 0) return;

  // Filter down to the Top 50 tickers by volume
  const top50 = tickersArray
    .sort((a, b) => (b.volume * b.price) - (a.volume * a.price))
    .slice(0, 50);

  const bullishCount = top50.filter(t => t.changePercent >= 0).length;
  const bullishPct = Math.round((bullishCount / top50.length) * 100);
  const bearishPct = 100 - bullishPct;

  const gaugeFill = document.getElementById('sentimentGaugeFill');
  const bullishPctEl = document.getElementById('bullishPct');
  const bearishPctEl = document.getElementById('bearishPct');
  const summaryTextEl = document.getElementById('sentimentSummaryText');

  if (gaugeFill) {
    gaugeFill.style.width = `${bullishPct}%`;
  }
  if (bullishPctEl) bullishPctEl.textContent = `${bullishPct}%`;
  if (bearishPctEl) bearishPctEl.textContent = `${bearishPct}%`;

  if (summaryTextEl) {
    if (bullishPct > 55) {
      summaryTextEl.textContent = `Le sentiment global est haussier. Les signaux du Top 50 sont dominés par les acheteurs (${bullishPct}% de hausse).`;
    } else if (bullishPct < 45) {
      summaryTextEl.textContent = `Le sentiment global est baissier. Les signaux du Top 50 indiquent une pression vendeuse (${bearishPct}% de baisse).`;
    } else {
      summaryTextEl.textContent = `Le marché est équilibré. Les forces du Top 50 sont partagées à parts égales (${bullishPct}% / ${bearishPct}%).`;
    }
  }
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * Fetches the historical price series and indicators for the given crypto symbol
 * @param {string} symbol - Symbol of the cryptocurrency (e.g. 'BTC')
 */
async function fetchInitialCoinData(symbol) {
  try {
    const res = await fetch(`/api/price/history?symbol=${symbol}`);
    if (res.ok) {
      const data = await res.json();
      
      // Extract from the response wrapper { symbol, history, indicators }
      priceHistory = data.history || [];
      currentIndicators = data.indicators || {};

      // Trigger initial selected price display update without animating pulse classes
      const latestPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : 0;
      updatePriceDisplay(latestPrice, false);

      // Draw premium SVGs with computed technical indicators
      drawChart(priceHistory, currentIndicators);

      // Fetch existing active and triggered alerts for the symbol
      await fetchAndRenderAlerts(symbol);

      // Update Express Converter display values
      updateConverterDisplay();
    } else {
      console.error('Erreur API lors de la récupération de l\'historique');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données initiales:', error);
  }
}

/**
 * Establishes real-time connection to Server-Sent Events stream
 */
function connectSSE() {
  if (sseSource) {
    sseSource.close();
  }

  sseSource = new EventSource('/api/price/stream');

  const connStatusEl = document.getElementById('connStatus');

  sseSource.onopen = () => {
    if (connStatusEl) {
      connStatusEl.className = 'status-badge live';
      const statusText = connStatusEl.querySelector('.status-text');
      if (statusText) statusText.textContent = 'EN DIRECT';
    }
  };

  sseSource.onerror = () => {
    if (connStatusEl) {
      connStatusEl.className = 'status-badge disconnected';
      const statusText = connStatusEl.querySelector('.status-text');
      if (statusText) statusText.textContent = 'HORS LIGNE';
    }
  };

  // Listen to Price Updates
  sseSource.addEventListener('priceUpdate', (e) => {
    try {
      const tickers = JSON.parse(e.data);
      if (!Array.isArray(tickers)) return;

      // Update local memory cache with latest Binance information
      tickers.forEach(ticker => {
        marketTickers[ticker.symbol] = ticker;
      });

      // Update horizontal ticker tape and Top 50 market table
      renderTicker(marketTickers);
      renderTable(marketTickers, selectedSymbol, handleCoinSelect);

      // Update the Global Market Sentiment gauge dynamically
      updateGlobalSentiment();

      // Check if update applies to currently analyzed cryptocurrency
      const activeTicker = tickers.find(t => t.symbol === selectedSymbol);
      if (activeTicker) {
        // Update hero elements with price pulse animations
        updatePriceDisplay(activeTicker.price, true);

        // Keep rolling array size to maximum 100 entries
        priceHistory.push({
          symbol: selectedSymbol,
          price: activeTicker.price,
          timestamp: activeTicker.timestamp || new Date().toISOString()
        });
        if (priceHistory.length > 100) {
          priceHistory.shift();
        }

        // Re-draw chart with new real-time price point
        drawChart(priceHistory, currentIndicators);

        // Keep Express Converter live rates and calculated targets in sync
        updateConverterDisplay();
      }
    } catch (err) {
      console.error('Erreur de parsing dans le flux priceUpdate:', err);
    }
  });

  // Listen to Triggered Alerts
  sseSource.addEventListener('alertTriggered', (e) => {
    try {
      const alert = JSON.parse(e.data);

      // Custom synth audio chime
      playAlertSound();

      // Premium toast visual alert card
      showToast(alert);

      // Instantly reload matching alerts list
      fetchAndRenderAlerts(selectedSymbol);
    } catch (err) {
      console.error('Erreur de parsing dans le flux alertTriggered:', err);
    }
  });
}

/**
 * Formats current price in USD, applies green or red price pulse class, and updates trend details
 * @param {number} price - The latest market price of the selected symbol
 * @param {boolean} animate - Whether to apply green/red CSS pulse classes
 */
function updatePriceDisplay(price, animate = true) {
  const btcPriceEl = document.getElementById('btcPrice');
  const btcTrendEl = document.getElementById('btcTrend');
  if (!btcPriceEl) return;

  // Format price in USD
  btcPriceEl.textContent = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: price < 1 ? 4 : 2
  }).format(price);

  // Computes 24h change indicators based on marketTickers[selectedSymbol] info
  const ticker = marketTickers[selectedSymbol];
  if (btcTrendEl) {
    if (ticker) {
      const changePct = ticker.changePercent;
      const arrow = changePct >= 0 ? '▲' : '▼';
      const sign = changePct >= 0 ? '+' : '';

      btcTrendEl.className = changePct >= 0 ? 'trend-indicator up' : 'trend-indicator down';

      const arrowEl = btcTrendEl.querySelector('.trend-arrow');
      if (arrowEl) arrowEl.textContent = arrow;

      const pctEl = btcTrendEl.querySelector('.trend-pct');
      if (pctEl) pctEl.textContent = `${sign}${changePct.toFixed(2)}%`;
    } else {
      btcTrendEl.className = 'trend-indicator neutral';

      const arrowEl = btcTrendEl.querySelector('.trend-arrow');
      if (arrowEl) arrowEl.textContent = '─';

      const pctEl = btcTrendEl.querySelector('.trend-pct');
      if (pctEl) pctEl.textContent = '0.00%';
    }
  }

  // Animates #btcPrice text color by temporarily applying green or red pulse CSS classes
  if (animate && lastPrice > 0 && price !== lastPrice) {
    btcPriceEl.classList.remove('price-up', 'price-down');
    void btcPriceEl.offsetWidth; // Trigger DOM reflow to restart CSS animations
    
    if (price > lastPrice) {
      btcPriceEl.classList.add('price-up');
    } else {
      btcPriceEl.classList.add('price-down');
    }
  }

  lastPrice = price;
}

/**
 * Handles action when a row or cryptocurrency is chosen for analysis
 * @param {string} symbol - Symbol of selected coin
 */
function handleCoinSelect(symbol) {
  selectedSymbol = symbol;

  // Fast row transition update
  renderTable(marketTickers, selectedSymbol, handleCoinSelect);

  // Fetch new data to draw new chart history and active alerts lists
  fetchInitialCoinData(selectedSymbol);
}

/**
 * Initializes the client-side hash router for modular page/tab navigation.
 */
function initRouter() {
  function handleRoute() {
    let hash = window.location.hash;
    if (!hash) {
      hash = localStorage.getItem('activeTab') || '#dashboard';
    }

    // Support only valid tabs: #dashboard, #news, #alerts
    const validHashes = ['#dashboard', '#news', '#alerts'];
    if (!validHashes.includes(hash)) {
      hash = '#dashboard';
    }

    // Sync window location hash if it does not match
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }

    // Sync active tab in localStorage
    localStorage.setItem('activeTab', hash);

    const tabName = hash.substring(1);

    // Toggle .active class on nav-tab buttons
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Toggle .active and .fade-in classes on tab-view elements
    const tabViews = document.querySelectorAll('.tab-view');
    tabViews.forEach(view => {
      const expectedId = 'view' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
      if (view.id === expectedId) {
        view.classList.add('active');
        void view.offsetWidth; // Force browser reflow to trigger transition
        view.classList.add('fade-in');
      } else {
        view.classList.remove('active', 'fade-in');
      }
    });
  }

  // Listen to hashchange events
  window.addEventListener('hashchange', handleRoute);

  // Trigger routing logic immediately to load current/saved tab
  handleRoute();
}

