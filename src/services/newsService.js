/**
 * Service de gestion des actualités crypto.
 * Récupère les actualités mondiales en direct depuis le flux RSS de Cointelegraph
 * et implémente un cache de 10 minutes côté serveur.
 */

let cachedNews = null;
let lastFetchedTime = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Récupère le flux d'actualités crypto en temps réel.
 * Utilise le cache serveur si disponible et valide.
 * 
 * @returns {Promise<Array>} Liste d'articles d'actualité formatés.
 */
async function fetchLatestNews() {
  try {
    const now = Date.now();
    
    // Si le cache est valide, le renvoyer directement
    if (cachedNews && lastFetchedTime && (now - lastFetchedTime < CACHE_DURATION_MS)) {
      return cachedNews;
    }

    const response = await fetch('https://cointelegraph.com/rss', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    const items = xmlText.split('<item>');
    items.shift(); // Remove the channel header before the first item

    // Slicing to 20 to mimic original behavior of returning top 20 articles
    const itemsToProcess = items.slice(0, 20);

    const formattedNews = itemsToProcess.map((item, index) => {
      const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const title = titleMatch ? titleMatch[1].trim() : '';

      const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/);
      const url = linkMatch ? linkMatch[1].trim() : '';

      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const timestamp = pubDateMatch ? new Date(pubDateMatch[1].trim()) : new Date();

      const imageMatch = item.match(/<enclosure\s+url="([^"]+)"/) || item.match(/<media:content\s+url="([^"]+)"/) || item.match(/<img\s+src="([^"]+)"/);
      const image = imageMatch ? imageMatch[1] : '';

      const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
      let body = '';
      if (descMatch) {
        const descContent = descMatch[1];
        // Strip any <p><img ...></p> or HTML tags to leave clean body text
        body = descContent
          .replace(/<p[^>]*><img[^>]*><\/p>/g, '')
          .replace(/<[^>]*>/g, '')
          .trim();
      }

      return {
        id: url || `rss-${index}`,
        title,
        body,
        image,
        source: 'Cointelegraph',
        url,
        timestamp
      };
    });

    // Mettre à jour le cache
    cachedNews = formattedNews;
    lastFetchedTime = now;

    return cachedNews;
  } catch (error) {
    console.error('Erreur lors de la récupération des actualités:', error);
    
    // En cas d'erreur de réseau, renvoyer le cache même s'il est expiré comme solution de repli
    if (cachedNews) {
      console.log('Utilisation du cache expiré comme repli.');
      return cachedNews;
    }
    
    return [];
  }
}

/**
 * Vide manuellement le cache des actualités (utile pour les tests).
 */
function clearNewsCache() {
  cachedNews = null;
  lastFetchedTime = null;
}

module.exports = {
  fetchLatestNews,
  clearNewsCache
};
