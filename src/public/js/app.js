// State Variables
let currentPrice = 0;
let lastPrice = 0;
let priceHistory = [];
let selectedTriggerType = 'above';
let sseSource = null;

// DOM Elements
const btcPriceEl = document.getElementById('btcPrice');
const btcTrendEl = document.getElementById('btcTrend');
const connStatusEl = document.getElementById('connStatus');
const alertForm = document.getElementById('alertForm');
const targetPriceInput = document.getElementById('targetPrice');
const activeAlertList = document.getElementById('activeAlertList');
const triggeredAlertList = document.getElementById('triggeredAlertList');
const toastContainer = document.getElementById('toastContainer');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupTriggerToggle();
  fetchInitialData();
  connectSSE();

  alertForm.addEventListener('submit', handleAlertSubmit);
});

// Setup Toggle Buttons for Above / Below Alert Type
function setupTriggerToggle() {
  const toggleButtons = document.querySelectorAll('.btn-toggle');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTriggerType = btn.dataset.type;
    });
  });
}

// Fetch Initial Historical Prices and Alerts
async function fetchInitialData() {
  try {
    // 1. Fetch History for the SVG Chart
    const historyRes = await fetch('/api/price/history');
    if (historyRes.ok) {
      priceHistory = await historyRes.json();
      if (priceHistory.length > 0) {
        const latestRecord = priceHistory[priceHistory.length - 1];
        updatePriceDisplay(latestRecord.price, false);
        drawSVGChart();
      }
    }

    // 2. Fetch Alerts List
    fetchAlerts();
  } catch (error) {
    console.error('Erreur lors du chargement des données initiales:', error);
  }
}

// Connect to Server-Sent Events Stream
function connectSSE() {
  if (sseSource) {
    sseSource.close();
  }

  sseSource = new EventSource('/api/price/stream');

  sseSource.onopen = () => {
    connStatusEl.className = 'status-badge live';
    connStatusEl.querySelector('.status-text').textContent = 'EN DIRECT';
  };

  sseSource.onerror = () => {
    connStatusEl.className = 'status-badge disconnected';
    connStatusEl.querySelector('.status-text').textContent = 'HORS LIGNE';
    // Reconexion automatique gérée par EventSource nativement
  };

  // Listen to Price Updates
  sseSource.addEventListener('priceUpdate', (e) => {
    const data = JSON.parse(e.data);
    updatePriceDisplay(data.price, true);
    
    // Add to history and draw chart
    priceHistory.push(data);
    if (priceHistory.length > 100) {
      priceHistory.shift();
    }
    drawSVGChart();
  });

  // Listen to Triggered Alerts
  sseSource.addEventListener('alertTriggered', (e) => {
    const alert = JSON.parse(e.data);
    playAlertSound();
    showToast(alert);
    fetchAlerts(); // Reload list to update status
  });
}

// Update Hero Price display with vibrant green/red pulse animations
function updatePriceDisplay(price, animate = true) {
  lastPrice = currentPrice;
  currentPrice = price;

  btcPriceEl.textContent = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(price);

  if (!animate || lastPrice === 0) {
    btcTrendEl.className = 'trend-indicator neutral';
    btcTrendEl.querySelector('.trend-arrow').textContent = '─';
    btcTrendEl.querySelector('.trend-pct').textContent = '0.00%';
    return;
  }

  const diff = currentPrice - lastPrice;
  const pct = (diff / lastPrice) * 100;

  // Pulse animation classes
  btcPriceEl.classList.remove('price-up', 'price-down');
  void btcPriceEl.offsetWidth; // Trigger DOM reflow

  if (diff > 0) {
    btcPriceEl.classList.add('price-up');
    btcTrendEl.className = 'trend-indicator up';
    btcTrendEl.querySelector('.trend-arrow').textContent = '▲';
    btcTrendEl.querySelector('.trend-pct').textContent = `+${pct.toFixed(4)}%`;
  } else if (diff < 0) {
    btcPriceEl.classList.add('price-down');
    btcTrendEl.className = 'trend-indicator down';
    btcTrendEl.querySelector('.trend-arrow').textContent = '▼';
    btcTrendEl.querySelector('.trend-pct').textContent = `${pct.toFixed(4)}%`;
  }
}

// Draw a Premium SVG Linear Chart
function drawSVGChart() {
  if (priceHistory.length < 2) return;

  const svg = document.getElementById('priceChart');
  const pathLine = document.getElementById('chartLine');
  const pathFill = document.getElementById('chartFill');

  const width = 500;
  const height = 200;
  const padding = 10;

  const prices = priceHistory.map(d => d.price);
  const minPrice = Math.min(...prices) * 0.9998;
  const maxPrice = Math.max(...prices) * 1.0002;
  const priceRange = maxPrice - minPrice;

  let points = [];

  for (let i = 0; i < priceHistory.length; i++) {
    const x = padding + (i / (priceHistory.length - 1)) * (width - 2 * padding);
    // Invert Y coordinate because SVG origin is top-left
    const y = height - padding - ((prices[i] - minPrice) / priceRange) * (height - 2 * padding);
    points.push({ x, y });
  }

  // Draw line path
  const linePathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  pathLine.setAttribute('d', linePathD);

  // Draw filled area path
  const fillPathD = `${linePathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  pathFill.setAttribute('d', fillPathD);
}

// Fetch Alerts from Backend
async function fetchAlerts() {
  try {
    const res = await fetch('/api/alerts');
    if (!res.ok) throw new Error('Erreur API');

    const alerts = await res.json();
    
    const active = alerts.filter(a => a.status === 'active');
    const triggered = alerts.filter(a => a.status === 'triggered');

    renderAlertList(active, activeAlertList, true);
    renderAlertList(triggered, triggeredAlertList, false);
  } catch (error) {
    console.error('Erreur de chargement des alertes:', error);
  }
}

// Render alert list into specific container
function renderAlertList(alerts, container, isActiveList) {
  container.innerHTML = '';

  if (alerts.length === 0) {
    container.innerHTML = `<li class="empty-msg">Aucune alerte ${isActiveList ? 'active' : 'déclenchée'}</li>`;
    return;
  }

  alerts.forEach(alert => {
    const li = document.createElement('li');
    li.className = 'alert-item';

    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(alert.targetPrice);

    const timeString = alert.triggeredAt 
      ? new Date(alert.triggeredAt).toLocaleTimeString('fr-FR')
      : new Date(alert.createdAt).toLocaleTimeString('fr-FR');

    li.innerHTML = `
      <div class="alert-info">
        <span class="alert-tag ${alert.type}">${alert.type === 'above' ? 'HAUSSE >' : 'BAISSE <'}</span>
        <span class="alert-price">${formattedPrice}</span>
      </div>
      <div>
        <span class="alert-time">${timeString}</span>
        ${isActiveList ? `<button class="btn-delete" onclick="deleteAlert('${alert._id}')">🗑️</button>` : ''}
      </div>
    `;

    container.appendChild(li);
  });
}

// Submit New Alert
async function handleAlertSubmit(e) {
  e.preventDefault();

  const targetPrice = parseFloat(targetPriceInput.value);
  if (isNaN(targetPrice) || targetPrice <= 0) return;

  try {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPrice,
        type: selectedTriggerType
      })
    });

    if (res.ok) {
      targetPriceInput.value = '';
      fetchAlerts();
    } else {
      const err = await res.json();
      alert(`Erreur: ${err.error}`);
    }
  } catch (error) {
    console.error('Erreur création alerte:', error);
  }
}

// Delete Active Alert
async function deleteAlert(id) {
  try {
    const res = await fetch(`/api/alerts/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      fetchAlerts();
    }
  } catch (error) {
    console.error('Erreur suppression alerte:', error);
  }
}

// Show a gorgeous Premium Toast popup
function showToast(alert) {
  const toast = document.createElement('div');
  toast.className = 'toast';

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(alert.targetPrice);

  toast.innerHTML = `
    <div class="toast-icon">🚨</div>
    <div class="toast-body">
      <div class="toast-title">Alerte Déclenchée !</div>
      <div class="toast-desc">Le BTC a franchi le seuil de <strong>${formattedPrice}</strong> (${alert.type === 'above' ? 'Hausse' : 'Baisse'}).</div>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 5000);
}

// Web Audio API Synthesizer - Coin sound effect (Premium detail!)
function playAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // First high note
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    // Second higher harmony note (plays slightly delayed)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
    gain2.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.48);
    
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.3);
    osc2.start(audioCtx.currentTime + 0.08);
    osc2.stop(audioCtx.currentTime + 0.48);
  } catch (error) {
    console.error('Impossible de jouer le son d\'alerte (Web Audio bloqué):', error);
  }
}
