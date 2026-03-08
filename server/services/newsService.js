/**
 * WealthPulse — News Aggregation Service
 * Fetches financial news from Google News RSS (free, no API key)
 */

const cache = { data: null, time: 0 };
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const NEWS_QUERIES = [
  { query: 'Indian stock market BSE NSE', category: 'Markets' },
  { query: 'gold silver commodity prices India', category: 'Commodities' },
  { query: 'RBI monetary policy interest rate India', category: 'Policy' },
  { query: 'global economy recession inflation', category: 'Economy' },
  { query: 'mutual fund NAV SIP India', category: 'Markets' },
];

async function fetchRSS(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const text = await res.text();

    // Simple XML parsing for RSS
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const itemXml = match[1];
      const title = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const pubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const source = (itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';

      if (title) {
        items.push({
          title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
          url: link.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
          source: source.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        });
      }
    }
    return items.slice(0, 5); // Max 5 per query
  } catch (e) {
    console.warn(`[News] RSS fetch failed for "${query}":`, e.message);
    return [];
  }
}

async function getNews() {
  // Check cache
  if (cache.data && Date.now() - cache.time < CACHE_TTL) {
    return cache.data;
  }

  const allNews = [];

  for (const { query, category } of NEWS_QUERIES) {
    const items = await fetchRSS(query);
    items.forEach(item => {
      item.category = category;
      allNews.push(item);
    });
    // Small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  // Sort by date, newest first
  allNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // De-duplicate by title similarity
  const seen = new Set();
  const unique = allNews.filter(item => {
    const key = item.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  cache.data = unique.slice(0, 30); // Max 30 news items
  cache.time = Date.now();

  return cache.data;
}

module.exports = { getNews, fetchArticleContent };

/**
 * Fetch and extract readable text content from a news article URL
 */
async function fetchArticleContent(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    const finalUrl = res.url || url;

    // Try to extract article content using common patterns
    let content = '';

    // 1. Try <article> tag
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    }

    // 2. Fallback: try common content div patterns
    if (!content) {
      const contentPatterns = [
        /<div[^>]*class="[^"]*article[_-]?(?:body|content|text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*story[_-]?(?:body|content|text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*post[_-]?(?:body|content|text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*id="[^"]*(?:article|story|content|main)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ];
      for (const pattern of contentPatterns) {
        const m = html.match(pattern);
        if (m && m[1].length > 200) { content = m[1]; break; }
      }
    }

    // 3. Fallback: extract all <p> tags from body
    if (!content) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      content = bodyMatch ? bodyMatch[1] : html;
    }

    // Extract text from <p> tags
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    while ((pMatch = pRegex.exec(content)) !== null) {
      let text = pMatch[1]
        .replace(/<[^>]+>/g, '') // strip HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 30) paragraphs.push(text);
    }

    // Get meta description as fallback summary
    const metaDesc = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) || [])[1] || '';
    const ogDesc = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i) || [])[1] || '';
    const ogImage = (html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i) || [])[1] || '';

    const articleText = paragraphs.slice(0, 25).join('\n\n');

    return {
      success: true,
      content: articleText || metaDesc || ogDesc || 'Could not extract article content.',
      description: metaDesc || ogDesc || '',
      image: ogImage || '',
      finalUrl,
      paragraphCount: paragraphs.length,
    };
  } catch (e) {
    return { success: false, content: '', error: e.message };
  }
}
