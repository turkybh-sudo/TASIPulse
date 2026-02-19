import { Article } from '../types';

// Real Sources from original code
export const SOURCES = {
  argaam: { name: 'Argaam', url: 'https://www.argaam.com/en/rss/ho-main-news?sectionid=1524' },
  'argaam-disc': { name: 'Disclosures', url: 'https://www.argaam.com/en/rss/ho-company-disclosures?sectionid=244' },
  alarabiya: { name: 'Al Arabiya', url: 'https://english.alarabiya.net/feed/rss2/en/business.xml' }
};

const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Fallback Mock Data
const MOCK_ARTICLES: Article[] = [
  {
    id: 'mock-1',
    title: 'TASI closes higher as banks and petrochemicals rally',
    description: 'The Tadawul All Share Index (TASI) rose by 0.5% on Sunday, driven by gains in the banking and materials sectors. Al Rajhi Bank added 1.2% while SABIC climbed 0.8%. Trading volume reached 250 million shares.',
    source: 'Argaam',
    url: '#',
    date: new Date(),
    category: 'Markets'
  },
  {
    id: 'mock-2',
    title: 'Aramco announces Q3 dividends distribution',
    description: 'Saudi Aramco has declared a base dividend of $20.3 billion for the third quarter of 2024, in addition to a performance-linked dividend of $10.8 billion, to be paid in the fourth quarter.',
    source: 'Saudi Exchange',
    url: '#',
    date: new Date(Date.now() - 3600000), 
    category: 'Dividends'
  },
  {
    id: 'mock-3',
    title: 'Saudi non-oil exports surge 12% in August',
    description: 'Saudi Arabia’s non-oil exports increased by 12% year-on-year in August 2024, reaching SAR 25 billion. Plastics and chemical products led the growth, accounting for 35% of total non-oil exports.',
    source: 'GASTAT',
    url: '#',
    date: new Date(Date.now() - 7200000), 
    category: 'Economy'
  }
];

const fetchWithTimeout = (url: string, ms: number) => {
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    fetch(url).then(res => { clearTimeout(timer); resolve(res); }).catch(err => { clearTimeout(timer); reject(err); });
  });
};

const fetchWithProxy = async (url: string): Promise<string> => {
  for (const proxyFn of PROXIES) {
    try {
      const resp = await fetchWithTimeout(proxyFn(url), 6000);
      if (!resp.ok) continue;
      const text = await resp.text();
      // Basic validation to check if it's XML/RSS
      if (text && (text.includes('<rss') || text.includes('<feed') || text.includes('<channel') || text.includes('<?xml'))) {
        return text;
      }
    } catch (e) {
      continue;
    }
  }
  throw new Error('All proxies failed');
};

const parseRSS = (xmlText: string, sourceName: string): Article[] => {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const items = Array.from(xml.querySelectorAll('item'));
    
    return items.map((item, idx) => {
      const title = item.querySelector('title')?.textContent?.replace(/^\u200f/, '').trim() || 'No Title';
      // Strip HTML tags from description
      const rawDesc = item.querySelector('description')?.textContent || '';
      const div = document.createElement('div');
      div.innerHTML = rawDesc;
      const description = div.textContent || rawDesc;
      
      const link = item.querySelector('link')?.textContent || '#';
      const pubDate = item.querySelector('pubDate')?.textContent;
      const date = pubDate ? new Date(pubDate) : new Date();
      
      return {
        id: `${sourceName}-${idx}-${Date.now()}`,
        title,
        description: description.trim(),
        source: sourceName,
        url: link,
        date,
        category: 'General'
      };
    });
  } catch (e) {
    console.error(`Error parsing RSS for ${sourceName}`, e);
    return [];
  }
};

export const fetchNews = async (sourceKey: string): Promise<Article[]> => {
  let articles: Article[] = [];
  
  const sourcesToFetch = sourceKey === 'all' 
    ? Object.entries(SOURCES) 
    : Object.entries(SOURCES).filter(([key]) => key === sourceKey);

  const results = await Promise.allSettled(
    sourcesToFetch.map(async ([key, config]) => {
      try {
        const xml = await fetchWithProxy(config.url);
        return parseRSS(xml, config.name);
      } catch (e) {
        console.warn(`Failed to fetch ${config.name}`, e);
        return [];
      }
    })
  );

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      articles = [...articles, ...result.value];
    }
  });

  // If real fetch fails completely, return mock data to ensure app usability
  if (articles.length === 0) {
    console.log("Using fallback mock data due to RSS fetch failure");
    return MOCK_ARTICLES;
  }

  // Filter keywords to keep relevant financial news
  const keywords = ['saudi','tadawul','tasi','sar','riyal','aramco','sabic','bank','dividend','earnings','profit','revenue','market','ipo'];
  const filtered = articles.filter(a => {
    // Always keep Argaam Disclosures as they are strictly financial
    if (a.source === 'Disclosures') return true;
    const text = (a.title + ' ' + a.description).toLowerCase();
    return keywords.some(kw => text.includes(kw));
  });

  return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
};