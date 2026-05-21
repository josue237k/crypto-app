/**
 * News Feed & Reader Module.
 * Fetches crypto news RSS feed and provides an integrated, distraction-free
 * reader modal to display the full body.
 */

let cachedArticles = [];
let activeCategory = 'all';
let newsSearchQuery = '';

export async function initNews() {
  const modal = document.getElementById('newsReaderModal');
  const closeBtn = document.getElementById('closeReaderModal');
  
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', closeReader);
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeReader();
    });
  }

  // Setup category pills click handler
  const categoryPills = document.querySelectorAll('#newsCategories .category-pill');
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeCategory = pill.dataset.category || 'all';
      renderNews(cachedArticles);
    });
  });

  // Setup search input listener
  const newsSearch = document.getElementById('newsSearch');
  if (newsSearch) {
    newsSearch.addEventListener('input', () => {
      newsSearchQuery = newsSearch.value.toLowerCase();
      renderNews(cachedArticles);
    });
  }

  await fetchAndRenderNews();
}

export async function fetchAndRenderNews() {
  const newsContainer = document.getElementById('newsFeedContainer');
  if (!newsContainer) return;

  try {
    newsContainer.innerHTML = '<div class="news-loading">Chargement des actualités en cours…</div>';
    
    const response = await fetch('/api/news');
    if (!response.ok) throw new Error('HTTP error');

    const result = await response.json();
    if (result.success && result.data) {
      cachedArticles = result.data;
      renderNews(cachedArticles);
    } else {
      newsContainer.innerHTML = '<div class="empty-msg">Aucune actualité disponible pour le moment.</div>';
    }
  } catch (error) {
    console.error('Erreur de chargement des actualités:', error);
    newsContainer.innerHTML = '<div class="empty-msg">Impossible de charger les actualités crypto.</div>';
  }
}

function classifyCategory(title, body) {
  const text = (title + ' ' + body).toLowerCase();
  if (text.match(/defi|decentralized finance|yield|swap|liquidity|staking|lending/i)) {
    return 'defi';
  }
  if (text.match(/regulation|sec|law|court|ban|legal|government|sec\b|cbdc|fca|cftc/i)) {
    return 'regulations';
  }
  if (text.match(/tech|protocol|upgrade|fork|developer|code|node|ai|security|hack|bug/i)) {
    return 'tech';
  }
  if (text.match(/market|price|usdt|bull|bear|chart|trade|volume|etf|invest|institutional/i)) {
    return 'markets';
  }
  return 'markets'; // default category
}

function getSeedCount(title, reactionType) {
  let hash = 0;
  const combined = title + reactionType;
  for (let i = 0; i < combined.length; i++) {
    hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 45) + 5; // Generates a number between 5 and 50
}

function getReactions(articleId, title) {
  const key = `reactions_${articleId}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    return JSON.parse(stored);
  }
  // Create seeded initial counts
  const initial = {
    like: getSeedCount(title, 'like'),
    rocket: getSeedCount(title, 'rocket'),
    bear: getSeedCount(title, 'bear'),
    link: getSeedCount(title, 'link')
  };
  localStorage.setItem(key, JSON.stringify(initial));
  return initial;
}

function incrementReaction(articleId, reactionType, title) {
  const reactions = getReactions(articleId, title);
  const userClickedKey = `user_clicked_${articleId}_${reactionType}`;
  const hasClicked = localStorage.getItem(userClickedKey);
  
  if (hasClicked) {
    reactions[reactionType] = Math.max(0, reactions[reactionType] - 1);
    localStorage.removeItem(userClickedKey);
  } else {
    reactions[reactionType] += 1;
    localStorage.setItem(userClickedKey, 'true');
  }
  
  localStorage.setItem(`reactions_${articleId}`, JSON.stringify(reactions));
  return { reactions, isClicked: !hasClicked };
}

function showToastNotification(message) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon">🔗</div>
    <div class="toast-body">
      <div class="toast-title">Copie réussie</div>
      <div class="toast-desc">${message}</div>
    </div>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 3000);
}

function renderNews(articles) {
  const newsContainer = document.getElementById('newsFeedContainer');
  if (!newsContainer) return;

  newsContainer.innerHTML = '';

  // Filter based on activeCategory and newsSearchQuery
  const filtered = articles.filter(article => {
    const category = classifyCategory(article.title, article.body);
    const matchesCategory = activeCategory === 'all' || category === activeCategory;
    const matchesSearch = !newsSearchQuery || 
                          article.title.toLowerCase().includes(newsSearchQuery) || 
                          article.body.toLowerCase().includes(newsSearchQuery);
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    newsContainer.innerHTML = '<div class="empty-msg">Aucune actualité ne correspond à vos critères.</div>';
    return;
  }

  filtered.forEach(article => {
    const card = document.createElement('div');
    card.className = 'news-card';
    card.dataset.id = article.id;

    const formattedTime = new Date(article.timestamp).toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const category = classifyCategory(article.title, article.body);
    
    // Estimate read time based on word count
    const wordCount = (article.title + ' ' + article.body).split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    // Get reactions
    const reactions = getReactions(article.id, article.title);
    const userClickedLike = localStorage.getItem(`user_clicked_${article.id}_like`) ? 'active' : '';
    const userClickedRocket = localStorage.getItem(`user_clicked_${article.id}_rocket`) ? 'active' : '';
    const userClickedBear = localStorage.getItem(`user_clicked_${article.id}_bear`) ? 'active' : '';
    const userClickedLink = localStorage.getItem(`user_clicked_${article.id}_link`) ? 'active' : '';

    card.innerHTML = `
      ${article.image ? `<div class="news-img-wrapper"><img src="${article.image}" alt="${article.title}" loading="lazy"></div>` : ''}
      <div class="news-content">
        <div class="news-meta">
          <span class="news-source">${article.source}</span>
          <span class="news-date">${formattedTime} • ${readTime} min de lecture</span>
        </div>
        <h4 class="news-title">${article.title}</h4>
        <p class="news-snippet">${article.body.substring(0, 100)}...</p>
        <span class="category-badge ${category}">${category.toUpperCase()}</span>
        <div class="news-reactions">
          <button class="reaction-btn ${userClickedLike}" data-type="like">👍 <span class="count">${reactions.like}</span></button>
          <button class="reaction-btn ${userClickedRocket}" data-type="rocket">🚀 <span class="count">${reactions.rocket}</span></button>
          <button class="reaction-btn ${userClickedBear}" data-type="bear">🐻 <span class="count">${reactions.bear}</span></button>
          <button class="reaction-btn ${userClickedLink}" data-type="link">🔗 <span class="count">${reactions.link}</span></button>
        </div>
      </div>
    `;

    // Click handler to open full article view modal (if not clicking reaction buttons)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.reaction-btn')) return;
      openReader(article);
    });

    // Wire up reaction button click handlers
    const reactionButtons = card.querySelectorAll('.reaction-btn');
    reactionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent opening the reader modal
        const type = btn.dataset.type;
        const { reactions: updatedReactions, isClicked } = incrementReaction(article.id, type, article.title);
        btn.querySelector('.count').textContent = updatedReactions[type];
        if (isClicked) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
        if (type === 'link') {
          navigator.clipboard.writeText(article.url || window.location.href);
          showToastNotification(`Lien de l'article copié !`);
        }
      });
    });

    newsContainer.appendChild(card);
  });
}

function openReader(article) {
  const modal = document.getElementById('newsReaderModal');
  if (!modal) return;

  const modalTitle = document.getElementById('modalTitle');
  const modalSource = document.getElementById('modalSource');
  const modalDate = document.getElementById('modalDate');
  const modalBody = document.getElementById('modalBody');
  const modalImg = document.getElementById('modalImage');
  const modalExtLink = document.getElementById('modalExternalLink');
  const shareBtn = document.getElementById('modalShareBtn');

  if (modalTitle) modalTitle.textContent = article.title;
  if (modalSource) modalSource.textContent = `Source : ${article.source}`;
  if (modalDate) {
    modalDate.textContent = new Date(article.timestamp).toLocaleString('fr-FR');
  }
  if (modalBody) {
    // Generate paragraphs for a cleaner reading experience
    const paragraphs = article.body.split('\n').filter(p => p.trim());
    modalBody.innerHTML = paragraphs.map((p, idx) => {
      // Apply drop cap to the first paragraph
      if (idx === 0) {
        return `<p class="modal-para drop-cap">${p}</p>`;
      }
      return `<p class="modal-para">${p}</p>`;
    }).join('');
  }
  if (modalImg) {
    if (article.image) {
      modalImg.src = article.image;
      modalImg.style.display = 'block';
    } else {
      modalImg.style.display = 'none';
    }
  }
  if (modalExtLink) {
    modalExtLink.href = article.url;
  }

  // Handle Share Button
  if (shareBtn) {
    shareBtn.onclick = () => {
      navigator.clipboard.writeText(article.url || window.location.href);
      showToastNotification(`Lien de l'article copié !`);
    };
  }

  // Show modal and lock page scroll
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Setup scroll progress listener on the modal content container
  const modalContent = modal.querySelector('.modal-content');
  const scrollProgress = document.getElementById('modalScrollProgress');

  if (modalContent && scrollProgress) {
    scrollProgress.style.width = '0%';
    modalContent.onscroll = () => {
      const scrollTop = modalContent.scrollTop;
      const scrollHeight = modalContent.scrollHeight - modalContent.clientHeight;
      if (scrollHeight > 0) {
        const pct = (scrollTop / scrollHeight) * 100;
        scrollProgress.style.width = `${pct}%`;
      } else {
        scrollProgress.style.width = '0%';
      }
    };
  }
}

function closeReader() {
  const modal = document.getElementById('newsReaderModal');
  if (modal) {
    modal.classList.remove('active');
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) modalContent.onscroll = null;
  }
  document.body.style.overflow = '';
}
