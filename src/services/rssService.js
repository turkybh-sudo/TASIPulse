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
  },
  'arabnews-biz': {
    name: 'Arab News',
    url: 'https://www.arabnews.com/cat/1/rss.xml'
  },
  'arabnews-saudi': {
    name: 'Arab News',
    url: 'https://www.arabnews.com/cat/4/rss.xml'
  }
};

const POSTED_FILE  = '/tmp/posted.json';
const GCS_BUCKET   = process.env.GCS_BUCKET;
const GCS_OBJECT   = 'posted.json';
const MAX_HISTORY  = 200;

// ── GCS helpers ──────────────────────────────────────────────────────────────

const getGCSToken = async () => {
  try {
    const res = await axios.get(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' }, timeout: 3000 }
    );
    return res.data?.access_token;
  } catch { return null; }
};

const loadFromGCS = async () => {
  if (!GCS_BUCKET) return null;
  try {
    const token = await getGCSToken();
    if (!token) return null;
    const res = await axios.get(
      `https://storage.googleapis.com/${GCS_BUCKET}/${GCS_OBJECT}`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
    );
    console.log(`[RSS] Loaded ${res.data.length} articles from GCS history`);
    return res.data;
  } catch (e) {
    if (e.response?.status === 404) { console.log('[RSS] No GCS history yet'); return []; }
    console.warn('[RSS] GCS load failed:', e.message);
    return null;
  }
};

const saveToGCS = async (data) => {
  if (!GCS_BUCKET) return false;
  try {
    const token = await getGCSToken();
    if (!token) return false;
    await axios.post(
      `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${GCS_OBJECT}`,
      JSON.stringify(data),
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    console.log(`[RSS] Saved ${data.length} articles to GCS`);
    return true;
  } catch (e) { console.warn('[RSS] GCS save failed:', e.message); return false; }
};

// ── Posted history ───────────────────────────────────────────────────────────

const loadPostedHistory = async () => {
  const gcsData = await loadFromGCS();
  if (gcsData !== null) {
    try { fs.writeFileSync(POSTED_FILE, JSON.stringify(gcsData)); } catch {}
    return gcsData;
  }
  try {
    if (fs.existsSync(POSTED_FILE)) {
      const data = JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8'));
      console.log(`[RSS] Loaded ${data.length} articles from local history`);
      return data;
    }
  } catch (e) { console.warn('[RSS] Could not load local history:', e.message); }
  return [];
};

const savePostedTitles = async (articles) => {
  try {
    const existing = await loadPostedHistory();
    const newEntries = articles.map(a => ({
      title: typeof a === 'string' ? a : a.title,
      url:   typeof a === 'string' ? null : a.url,
      postedAt: new Date().toISOString()
    }));
    const combined = [...existing, ...newEntries];
    const kept = combined.slice(-MAX_HISTORY);
    const gcsSaved = await saveToGCS(kept);
    try { fs.writeFileSync(POSTED_FILE, JSON.stringify(kept, null, 2)); } catch {}
    if (!gcsSaved) {
      console.warn('[RSS] ⚠️  GCS unavailable — history only in /tmp (resets on restart)');
      console.warn('[RSS] ⚠️  Set GCS_BUCKET env var to enable persistent history');
    }
    console.log(`[RSS] Saved ${newEntries.length} new articles to history (total: ${kept.length})`);
  } catch (e) { console.warn('[RSS] Could not save posted history:', e.message); }
};

// ── Scoring ──────────────────────────────────────────────────────────────────

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

const stripHtml = (html) =>
  html.replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g,' ').trim();

const scoreArticle = (article) => {
  const text = (article.title + ' ' + article.description).toLowerCase();
  let score = 0;
  for (const c of TIER1_COMPANIES)        { if (text.includes(c))  { score += 40; break; } }
  for (const kw of HIGH_IMPACT_KEYWORDS)  { if (text.includes(kw)) score += 15; }
  for (const kw of MEDIUM_IMPACT_KEYWORDS){ if (text.includes(kw)) score += 5;  }
  for (const kw of LOW_IMPACT_KEYWORDS)   { if (text.includes(kw)) score -= 10; }
  const nums = text.match(/\d+(\.\d+)?[\s]*(billion|million|trillion|%|percent|sar|riyal)/g);
  if (nums) score += nums.length * 8;
  const ageHours = (Date.now() - new Date(article.date).getTime()) / 3_600_000;
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
      explicitArray: false, ignoreAttrs: false
    });
    const channel = parsed?.rss?.channel;
    if (!channel) return [];
    const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);
    return items.map((item, idx) => {
      const title    = (item.title || '').replace(/^\u200f/, '').trim();
      const rawDesc  = item.description || item.summary || '';
      const description = stripHtml(typeof rawDesc === 'object' ? rawDesc._ || '' : rawDesc);
      const link     = typeof item.link === 'object' ? item.link._ : (item.link || '#');
      const pubDate  = item.pubDate || item['dc:date'] || null;
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

// ── Main ─────────────────────────────────────────────────────────────────────

const fetchTopArticles = async (limit = 3) => {
  console.log('[RSS] Fetching from all sources...');

  const results = await Promise.allSettled(
    Object.entries(SOURCES).map(([, { name, url }]) => fetchSource(name, url))
  );

  let articles = [];
  results.forEach(r => { if (r.status === 'fulfilled') articles = [...articles, ...r.value]; });
  console.log(`[RSS] Fetched ${articles.length} total articles`);

  if (articles.length === 0) throw new Error('All RSS sources failed');

  // Deduplicate by URL across sources (e.g. same story in two feeds)
  const seenUrls = new Set();
  const unique = articles.filter(a => {
    if (!a.url || seenUrls.has(a.url)) return false;
    seenUrls.add(a.url);
    return true;
  });

  // Filter to financially relevant
  const filtered = unique.filter(a => {
    if (a.source === 'Disclosures') return true;
    const text = (a.title + ' ' + a.description).toLowerCase();
    return FINANCIAL_KEYWORDS.some(kw => text.includes(kw));
  });

  // Score and sort
  const scored = filtered
    .map(a => ({ ...a, score: scoreArticle(a) }))
    .sort((a, b) => b.score - a.score);

  console.log('[RSS] Top scored articles:');
  scored.slice(0, 8).forEach((a, i) =>
    console.log(`  ${i+1}. [${a.score}pts] [${a.source}] ${a.title.substring(0, 65)}`)
  );

  // Filter out already posted
  const postedHistory = await loadPostedHistory();
  const deduped = scored.filter(a => {
    const alreadyPosted = postedHistory.some(p => {
      if (p.url && a.url) return p.url === a.url;
      return p.title?.toLowerCase().trim() === a.title.toLowerCase().trim();
    });
    if (alreadyPosted) console.log(`[RSS] ⏭️  Skipping: ${a.title.substring(0, 60)}`);
    return !alreadyPosted;
  });

  console.log(`[RSS] ${deduped.length} fresh articles after deduplication`);

  const selected = deduped.slice(0, limit);
  console.log(`[RSS] Selected ${selected.length} articles`);
  return selected;
};

module.exports = { fetchTopArticles, savePostedTitles };
