const newsService = require('../../src/services/newsService');

function generateMockRssFeed(count) {
  let itemsXml = '';
  for (let i = 0; i < count; i++) {
    itemsXml += `
    <item>
      <title><![CDATA[News Title ${i}]]></title>
      <link><![CDATA[https://example.com/news-${i}]]></link>
      <pubDate>2026-05-21T10:45:40.000Z</pubDate>
      <enclosure url="https://example.com/image-${i}.png" />
      <description><![CDATA[<p><img src="https://example.com/image-${i}.png"></p>News Body ${i}]]></description>
    </item>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cointelegraph RSS Feed</title>
    <link>https://cointelegraph.com</link>
    <description>Latest news</description>${itemsXml}
  </channel>
</rss>`;
}

describe('News Service Unit Tests', () => {
  beforeEach(() => {
    newsService.clearNewsCache();
    jest.restoreAllMocks();
  });

  it('should fetch, parse and return 20 latest news articles from Cointelegraph RSS feed', async () => {
    const mockRssXml = generateMockRssFeed(25);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => mockRssXml
    });

    const news = await newsService.fetchLatestNews();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('https://cointelegraph.com/rss', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    expect(news).toHaveLength(20);
    expect(news[0]).toEqual({
      id: 'https://example.com/news-0',
      title: 'News Title 0',
      body: 'News Body 0',
      image: 'https://example.com/image-0.png',
      source: 'Cointelegraph',
      url: 'https://example.com/news-0',
      timestamp: new Date('2026-05-21T10:45:40.000Z')
    });
  });

  it('should cache fetched news and not fetch again within cache duration', async () => {
    const mockRssXml = generateMockRssFeed(1);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => mockRssXml
    });

    // First call fetches from Cointelegraph RSS feed
    const news1 = await newsService.fetchLatestNews();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(news1).toHaveLength(1);

    // Second call should return cached news
    const news2 = await newsService.fetchLatestNews();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(news2).toEqual(news1);
  });

  it('should fall back to expired cached news in case of network/fetch failure', async () => {
    const mockRssXml = generateMockRssFeed(1);

    const fetchSpy = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () => mockRssXml
      })
      .mockRejectedValueOnce(new Error('Network failure'));

    // First fetch succeeds, fills cache
    await newsService.fetchLatestNews();

    // Manually expire cache internally by shifting Date.now()
    const originalNow = Date.now;
    const nowMock = jest.spyOn(Date, 'now').mockReturnValue(originalNow() + 11 * 60 * 1000); // 11 mins later

    // Second fetch tries to fetch but rejects, should return cached news
    const news = await newsService.fetchLatestNews();
    expect(news).toHaveLength(1);
    expect(news[0].title).toBe('News Title 0');

    nowMock.mockRestore();
  });

  it('should return empty array if fetch fails and no cache exists', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    const news = await newsService.fetchLatestNews();
    expect(news).toEqual([]);
  });
});
