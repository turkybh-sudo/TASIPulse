// src/services/rssService.js
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');

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

const POSTED_FILE = 'posted.json';
const MAX_HISTORY = 100; // Remember last 100 posted titles

// ── Posted history helpers ───────────────────────────────────────────────────

const loadPostedTitles = () => {
  try {
    if (fs.existsSync(POSTED_FILE)) {
      const data = JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8'));
      console.log(`[RSS] Loaded ${data.length} previously posted titles`);
      return data;
    }
  } catch (e) {
    console.warn('[RSS] Could not load posted history, starting fresh');
  }
  return [];
};

const savePostedTitles = (newTitles) => {
  try {
    const existing = loadPostedTitles();
    const combined = [...existing, ...newTitles];
    const kept = combined.slice(-MAX_HISTORY); // Keep last 100
    fs.writeFileSync(POSTED_FILE, JSON.stringify(kept, null, 2));
    console.log(`[RSS] Saved ${newTitles.length} new titles to history (total: ${kept.length})`);
  } catch (e) {
    console.warn('[RSS] Could not save posted history:', e.message);
  }
};

// ── Importance scoring weights ───────────────────────────────────────────────

const TIER1_COMPANIES = [
  'aramco', 'sabic', 'stc', 'al rajhi', 'alrajhi', 'samba', 'snb',
  'riyad bank', 'maaden', 'acwa', 'neom', 'pif',
  'public investment fund', 'vision 2030'
];

const HIGH_IMPACT_KEYWORDS = [
  'ipo', 'merger', 'acquisition', 'bankruptcy', 'default',
  'dividend', 'earnings', 'profit', 'loss', 'revenue', 'results',
  'interest rate', 'inflation', 'gdp', 'oil price', 'crude',
  'tasi', 'tadawul', 'suspend', 'halt', 'record high', 'record low',
  'billion', 'trillion', 'quarterly', 'annual report', 'guidance',
  'sama', 'cma', 'ministry of finance', 'vision 2030'
];

const MEDIUM_IMPACT_KEYWORDS = [
  'saudi', 'riyal', 'sar', 'bank', 'market', 'shares', 'stock',
  'investment', 'financial', 'million', 'percent', 'growth',
  'quarter', 'contract', 'partnership', 'expansion', 'launch'
];

const LOW_IMPACT_KEYWORDS = [
  'appointment', 'board member', 'agm', 'general assembly',
  'minor', 'routine', 'reminder', 'clarification'
];

const FINANCIAL_KEYWORDS = [...HIGH_IMPACT_KEYWORDS, ...MEDIUM_IMPACT_KEYWORDS];

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const scoreArticle = (article) => {
  const text = (article.title + ' ' + article.description).toLowerCase();
  let score = 0;

  for (const company of TIER1_COMPANIES) {
    if (text.includes(company)) {
      score += 40;
      break;
    }
  }

  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(kw)) score += 15;
  }

  for (const kw of MEDIUM_IMPACT_KEYWORDS) {
    if (text.includes(kw)) score += 5;
  }

  for (const kw of LOW_IMPACT_KEYWORDS) {
    if (text.includes(kw)) score -= 10;
  }

  const numberMatches = text.match(/\d+(\.\d+)?[\s]*(billion|million|trillion|%|percent|sar|riyal)/g);
  if (numberMatches) score += numberMatches.length * 8;

  const ageHours = (Date.now() - new Date(article.date).getTime()) / (1000 * 60 * 60);
  if (ageHours < 2) score += 20;
  else if (ageHours < 6) score += 10;
  else if (ageHours > 24) score -= 15;

  if (article.source === 'Argaam') score += 10;

  return Math.max(0, score);
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

  // Filter to financially relevant articles
  const filtered = articles.filter(a => {
    if (a.source === 'Disclosures') return true;
    const text = (a.title + ' ' + a.description).toLowerCase();
    return FINANCIAL_KEYWORDS.some(kw => text.includes(kw));
  });

  // Score articles
  const scored = filtered
    .map(a => ({ ...a, score: scoreArticle(a) }))
    .sort((a, b) => b.score - a.score);

  // Log top candidates
  console.log('[RSS] Top scored articles:');
  scored.slice(0, 6).forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.score}pts] ${a.title.substring(0, 70)}`);
  });

  // Filter out already posted articles
  const postedTitles = loadPostedTitles();
  const deduped = scored.filter(a => {
    const normalised = a.title.toLowerCase().trim();
    const alreadyPosted = postedTitles.some(t =>
      t.toLowerCase().trim() === normalised
    );
    if (alreadyPosted) {
      console.log(`[RSS] ⏭️  Skipping already posted: ${a.title.substring(0, 60)}`);
    }
    return !alreadyPosted;
  });

  console.log(`[RSS] ${deduped.length} fresh articles after deduplication`);

  const selected = deduped.slice(0, limit);
  console.log(`[RSS] Selected ${selected.length} articles after importance scoring`);
  return selected;
};

module.exports = { fetchTopArticles, savePostedTitles };
