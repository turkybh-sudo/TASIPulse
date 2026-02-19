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

// ── Importance scoring weights ───────────────────────────────────────────────

// High-impact companies — major market movers
const TIER1_COMPANIES = [
  'aramco', 'sabic', 'stc', 'al rajhi', 'alrajhi', 'samba', 'snb',
  'riyad bank', 'maaden', 'sabic', 'acwa', 'neom', 'pif',
  'public investment fund', 'vision 2030'
];

// High-impact event keywords — market-moving news
const HIGH_IMPACT_KEYWORDS = [
  'ipo', 'merger', 'acquisition', 'bankruptcy', 'default',
  'dividend', 'earnings', 'profit', 'loss', 'revenue', 'results',
  'interest rate', 'inflation', 'gdp', 'oil price', 'crude',
  'tasi', 'tadawul', 'suspend', 'halt', 'record high', 'record low',
  'billion', 'trillion', 'quarterly', 'annual report', 'guidance',
  'sama', 'cma', 'ministry of finance', 'vision 2030'
];

// Medium-impact keywords — still relevant but lower priority
const MEDIUM_IMPACT_KEYWORDS = [
  'saudi', 'riyal', 'sar', 'bank', 'market', 'shares', 'stock',
  'investment', 'financial', 'million', 'percent', 'growth',
  'quarter', 'contract', 'partnership', 'expansion', 'launch'
];

// Keywords that reduce importance — minor/routine news
const LOW_IMPACT_KEYWORDS = [
  'appointment', 'board member', 'agm', 'general assembly',
  'minor', 'routine', 'reminder', 'clarification'
];

const FINANCIAL_KEYWORDS = [...HIGH_IMPACT_KEYWORDS, ...MEDIUM_IMPACT_KEYWORDS];

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

// ── Score an article by importance ──────────────────────────────────────────

const scoreArticle = (article) => {
  const text = (article.title + ' ' + article.description).toLowerCase();
  let score = 0;

  // Tier 1 company mention = very high value
  for (const company of TIER1_COMPANIES) {
    if (text.includes(company)) {
      score += 40;
      break; // Only count once even if multiple mentions
    }
  }

  // High-impact event keywords
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(kw)) score += 15;
  }

  // Medium-impact keywords
  for (const kw of MEDIUM_IMPACT_KEYWORDS) {
    if (text.includes(kw)) score += 5;
  }

  // Low-impact penalty
  for (const kw of LOW_IMPACT_KEYWORDS) {
    if (text.includes(kw)) score -= 10;
  }

  // Numerical figures boost (market-moving news usually has numbers)
  const numberMatches = text.match(/\d+(\.\d+)?[\s]*(billion|million|trillion|%|percent|sar|riyal)/g);
  if (numberMatches) score += numberMatches.length * 8;

  // Recency boost — articles from last 6 hours get a bonus
  const ageHours = (Date.now() - new Date(article.date).getTime()) / (1000 * 60 * 60);
  if (ageHours < 2) score += 20;
  else if (ageHours < 6) score += 10;
  else if (ageHours > 24) score -= 15; // Penalize old news

  // Source boost — Argaam main news is more curated than disclosures
  if (article.source === 'Argaam') score += 10;

  return Math.max(0, score); // Never negative
};

const fetchSource = async (name, url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TasiPulse/1.0)' }
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
        description: description.substring(0, 1000),
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

  // Filter to financially relevant articles only
  const filtered = articles.filter(a => {
    if (a.source === 'Disclosures') return true;
    const text = (a.title + ' ' + a.description).toLowerCase();
    return FINANCIAL_KEYWORDS.some(kw => text.includes(kw));
  });

  // Score and sort by importance
  const scored = filtered
    .map(a => ({ ...a, score: scoreArticle(a) }))
    .sort((a, b) => b.score - a.score);

  // Log top candidates so you can see why articles were chosen
  console.log('[RSS] Top scored articles:');
  scored.slice(0, 6).forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.score}pts] ${a.title.substring(0, 70)}`);
  });

  const selected = scored.slice(0, limit);
  console.log(`[RSS] Selected ${selected.length} articles after importance scoring`);
  return selected;
};

module.exports = { fetchTopArticles };
