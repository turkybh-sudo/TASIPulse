// src/services/imageService.js
const puppeteer = require('puppeteer');
const { generateCardHtml } = require('../templates/cardTemplate');

const captureCard = async (config) => {
  const { platform } = config;
  const isStory = platform === 'story';
  const width = isStory ? 360 : 450;
  const height = isStory ? 640 : 450;
  const scale = 3;

  const html = generateCardHtml(config);
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none'
      ]
    });

    const page = await browser.newPage();

    await page.setViewport({
      width,
      height,
      deviceScaleFactor: scale
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 300));

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height },
      omitBackground: false
    });

    return screenshot;
  } finally {
    if (browser) await browser.close();
  }
};

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
      platform: 'instagram',
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
    enBuffer,
    arBuffer,
    enBase64: enBuffer.toString('base64'),
    arBase64: arBuffer.toString('base64')
  };
};

module.exports = { generatePostImages };
