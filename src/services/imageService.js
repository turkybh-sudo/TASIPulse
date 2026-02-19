// src/services/imageService.js
// Uses Puppeteer to render the card HTML and capture a high-res PNG

const puppeteer = require('puppeteer');
const { generateCardHtml } = require('../templates/cardTemplate');

const captureCard = async (config) => {
  const { platform } = config;
  const isStory = platform === 'story';

  const width = isStory ? 360 : 450;
  const height = isStory ? 640 : 450;

  // Scale 3x for high resolution (1350x1350 or 1080x1920)
  const scale = 3;

  const html = generateCardHtml(config);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none' // better text rendering
      ]
    });

    const page = await browser.newPage();

    // Set viewport to card size (pre-scaled)
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: scale
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Extra settle time for gradients/blur
    await new Promise(r => setTimeout(r, 300));

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height },
      omitBackground: false
    });

    return screenshot; // Returns a Buffer

  } finally {
    if (browser) await browser.close();
  }
};

// Generate both EN and AR cards for an enriched article
const generatePostImages = async (enriched, articleDate) => {
  const date = articleDate || new Date();

  const hasFigures = enriched.figures && enriched.figures.length > 0;

  const [enBuffer, arBuffer] = await Promise.all([
    captureCard({
      headline: enriched.headline_en,
      summary: enriched.summary_en,
      keyPoints: enriched.key_points_en,
      figures: hasFigures ? enriched.figures : [],
      date,
      lang: 'en',
      platform: 'instagram', // square format
      source: ''
    }),
    captureCard({
      headline: enriched.headline_ar,
      summary: enriched.summary_ar,
      keyPoints: enriched.key_points_ar,
      figures: hasFigures ? enriched.figures : [],
      date,
      lang: 'ar',
      platform: 'instagram',
      source: ''
    })
  ]);

  console.log(`[Image] Generated EN + AR cards (${enBuffer.length + arBuffer.length} bytes total)`);

  return {
    enBuffer,   // PNG Buffer - English card
    arBuffer,   // PNG Buffer - Arabic card
    enBase64: enBuffer.toString('base64'),
    arBase64: arBuffer.toString('base64')
  };
};

module.exports = { generatePostImages };
