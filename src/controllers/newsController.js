const newsService = require('../services/newsService');

/**
 * Récupère le flux d'actualités crypto en temps réel.
 * 
 * @param {Object} req - L'objet Request d'Express.
 * @param {Object} res - L'objet Response d'Express.
 */
async function getNews(req, res, next) {
  try {
    const news = await newsService.fetchLatestNews();
    return res.status(200).json({
      success: true,
      count: news.length,
      data: news
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNews
};
