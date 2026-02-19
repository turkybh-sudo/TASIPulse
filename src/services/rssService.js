// src/services/rssService.js
const axios = require('axios');
const xml2js = require('xml2js');

const SOURCES = {
  argaam: {
    name: 'Argaam',
    url: 'https://www.argaam.com/en/rss/ho-main-news?sectionid=1524'
  },
  'argaam-disc': {
    name: 'Disclosures',
    url: 'https://www.argaam.com/en/rss/ho-company-disclosures?sectionid=244'
  },
  alarabiya: {
    name: 'Al Arabiya',
    url: 'https://english.alarabiya.net/feed/rss2/en/business.xml'
  }
};

const FINANCIAL_KEYWORDS = [
  'saudi', 'tadawul', 'tasi', 'sar', 'riyal', 'aramco', 'sabic',
  'bank', 'dividend', 'earnings', 'profit', 'revenue', 'market',
  'ipo', 'shares', 'stock', 'investment', 'financial', 'billion',
  'million', 'percent', 'growth', 'quarter', 'annual'
];

// Strip HTML tags from a string
const stripHtml = (html) => {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const fetchSource = async (name, url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TasiPulse/1.0)'
      }
    });

    const parsed = await xml2js.parseStringPromise(response.data, {
      explicitArray: false,
      ignoreAttrs: false
    });

    const channel = parsed?.rss?.channel;
    if (!channel) return [];

    const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);

    return items.map((item, idx) => {
      const title = (item.title || '').replace(/^\u200f/, '').trim();
      const rawDesc = item.description || item.summary || '';
      const description = stripHtml(typeof rawDesc === 'object' ? rawDesc._ || '' : rawDesc);
      const link = typeof item.link === 'object' ? item.link._ : (item.link || '#');
      const pubDate = item.pubDate || item['dc:date'] || null;

      return {
        id: `${name}-${idx}-${Date.now()}`,
        title,
        description: description.substring(0, 1000), // cap description length
        source: name,
        url: link,
        date: pubDate ? new Date(pubDate) : new Date(),
        category: 'General'
      };
    });

  } catch (err) {
    console.error(`[RSS] Failed to fetch ${name}: ${err.message}`);
    return [];
  }
};

const fetchTopArticles = async (limit = 3) => {
  console.log('[RSS] Fetching from all sources...');

  const results = await Promise.allSettled(
    Object.entries(SOURCES).map(([, { name, url }]) => fetchSource(name, url))
  );

  let articles = [];
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      articles = [...articles, ...result.value];
    }
  });

  console.log(`[RSS] Fetched ${articles.length} total articles`);

  if (articles.length === 0) {
    throw new Error('All RSS sources failed to return articles');
  }

  // Filter to financially relevant articles
  const filtered = articles.filter(a => {
    if (a.source === 'Disclosures') return true;
    const text = (a.title + ' ' + a.description).toLowerCase();
    return FINANCIAL_KEYWORDS.some(kw => text.includes(kw));
  });

  // Sort by date descending, take top N
  const sorted = filtered
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);

  console.log(`[RSS] Selected ${sorted.length} articles after filtering`);
  return sorted;
};

module.exports = { fetchTopArticles };
