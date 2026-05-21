/**
 * Alerts Manager Module.
 * Creates, fetches, and deletes custom price alerts for the selected coin,
 * and manages custom synthesizers for audio notifications.
 */

const toastContainer = document.getElementById('toastContainer');

export async function fetchAndRenderAlerts(symbol) {
  const activeAlertList = document.getElementById('activeAlertList');
  const triggeredAlertList = document.getElementById('triggeredAlertList');
  
  if (!activeAlertList || !triggeredAlertList) return;

  try {
    // Fetch all alerts filtered by symbol
    const res = await fetch(`/api/alerts?symbol=${symbol}`);
    if (!res.ok) throw new Error('API fetch error');

    const alerts = await res.json();

    const active = alerts.filter(a => a.status === 'active');
    const triggered = alerts.filter(a => a.status === 'triggered');

    renderList(active, activeAlertList, true, symbol);
    renderList(triggered, triggeredAlertList, false, symbol);
  } catch (error) {
    console.error('Erreur de chargement des alertes:', error);
  }
}

function renderList(alerts, container, isActiveList, currentSymbol) {
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

    const statusBadge = isActiveList 
      ? `<span class="alert-status status-active">Actif</span>` 
      : `<span class="alert-status status-triggered">Déclenché</span>`;

    li.innerHTML = `
      <div class="alert-info">
        <span class="alert-tag ${alert.type}">${alert.type === 'above' ? 'HAUSSE >' : 'BAISSE <'}</span>
        <span class="alert-price">${formattedPrice}</span>
        ${statusBadge}
      </div>
      <div class="alert-actions">
        <span class="alert-time">${timeString}</span>
        ${isActiveList ? `<button class="btn-delete" data-id="${alert._id}" aria-label="Supprimer l'alerte">🗑️</button>` : ''}
      </div>
    `;

    // Hook up delete button click explicitly rather than using inline onclick
    if (isActiveList) {
      const deleteBtn = li.querySelector('.btn-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await deleteAlert(alert._id, currentSymbol);
        });
      }
    }

    container.appendChild(li);
  });
}

export async function createAlert(symbol, targetPrice, type) {
  const submitBtn = document.querySelector('#alertForm button[type="submit"]') || document.querySelector('.btn-submit');
  let originalText = '';
  if (submitBtn) {
    originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-btn"></span> Création...';
  }

  try {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        targetPrice,
        type
      })
    });

    if (res.ok) {
      await fetchAndRenderAlerts(symbol);
      return true;
    } else {
      const err = await res.json();
      alert(`Erreur: ${err.error}`);
      return false;
    }
  } catch (error) {
    console.error('Erreur lors de la création de l\'alerte:', error);
    return false;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

async function deleteAlert(id, symbol) {
  try {
    const res = await fetch(`/api/alerts/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchAndRenderAlerts(symbol);
    }
  } catch (error) {
    console.error('Erreur suppression alerte:', error);
  }
}

// Show a gorgeous Premium Toast popup with coin-specific symbol
export function showToast(alert) {
  if (!toastContainer) return;

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
      <div class="toast-desc">Le ${alert.symbol} a franchi le seuil de <strong>${formattedPrice}</strong> (${alert.type === 'above' ? 'Hausse' : 'Baisse'}).</div>
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

// Web Audio API Synthesizer - Gorgeous professional chime sound effect
export function playAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // First high note (D5)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    // Second higher harmony note (A5, slightly delayed for crystal chime effect)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
    gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.55);
    
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.35);
    osc2.start(audioCtx.currentTime + 0.08);
    osc2.stop(audioCtx.currentTime + 0.55);
  } catch (error) {
    console.error('Impossible de jouer le son d\'alerte (Web Audio bloqué):', error);
  }
}
