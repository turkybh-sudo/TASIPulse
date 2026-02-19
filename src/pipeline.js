// src/pipeline.js
// Main automation pipeline: RSS → Gemini → Images → Publish

const { fetchTopArticles } = require('./services/rssService');
const { enrichArticles } = require('./services/geminiService');
const { generatePostImages } = require('./services/imageService');
const { postToX } = require('./services/xService');
// Future: const { postToInstagram } = require('./services/instagramService');
// Future: const { postToYouTube } = require('./services/youtubeService');
// Future: const { postToTikTok } = require('./services/tiktokService');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const runPipeline = async () => {
  const startTime = Date.now();
  const results = [];

  console.log('\n========================================');
  console.log(`[Pipeline] 🚀 Starting at ${new Date().toISOString()}`);
  console.log('========================================\n');

  // ── STEP 1: Fetch top 3 articles ──────────────────────────────────────────
  console.log('[Pipeline] Step 1: Fetching articles...');
  let articles;
  try {
    articles = await fetchTopArticles(3);
    console.log(`[Pipeline] ✅ Fetched ${articles.length} articles\n`);
  } catch (err) {
    throw new Error(`RSS fetch failed: ${err.message}`);
  }

  // ── STEP 2: Enrich with Gemini ────────────────────────────────────────────
  console.log('[Pipeline] Step 2: Enriching with Gemini AI...');
  let enrichedPairs;
  try {
    enrichedPairs = await enrichArticles(articles);
    console.log(`[Pipeline] ✅ Enriched ${enrichedPairs.length} articles\n`);
  } catch (err) {
    throw new Error(`Gemini enrichment failed: ${err.message}`);
  }

  if (enrichedPairs.length === 0) {
    throw new Error('No articles were successfully enriched');
  }

  // ── STEP 3 & 4: Generate images and post for each article ─────────────────
  for (let i = 0; i < enrichedPairs.length; i++) {
    const { article, enriched } = enrichedPairs[i];

    console.log(`\n[Pipeline] Processing article ${i + 1}/${enrichedPairs.length}`);
    console.log(`[Pipeline] 📰 "${article.title.substring(0, 70)}"`);

    const articleResult = {
      title: article.title,
      source: article.source,
      platforms: {}
    };

    // Step 3: Generate images
    console.log('[Pipeline] Step 3: Generating card images...');
    let images;
    try {
      images = await generatePostImages(enriched, article.date);
      console.log('[Pipeline] ✅ Images generated\n');
    } catch (err) {
      console.error(`[Pipeline] ❌ Image generation failed: ${err.message}`);
      articleResult.error = `Image generation failed: ${err.message}`;
      results.push(articleResult);
      continue;
    }

    // Step 4: Post to platforms
    console.log('[Pipeline] Step 4: Publishing to platforms...');

    // ── X (Twitter) ──
    try {
      const xResult = await postToX({ ...images, enriched });
      articleResult.platforms.x = xResult;
      console.log(`[Pipeline] ✅ X: Tweet ${xResult.tweetId}`);
    } catch (err) {
      console.error(`[Pipeline] ❌ X failed: ${err.message}`);
      articleResult.platforms.x = { success: false, error: err.message };
    }

    // Future platform calls go here:
    // try { articleResult.platforms.instagram = await postToInstagram({...images, enriched}); } catch (e) {...}
    // try { articleResult.platforms.youtube   = await postToYouTube({...images, enriched}); }   catch (e) {...}
    // try { articleResult.platforms.tiktok    = await postToTikTok({...images, enriched}); }    catch (e) {...}

    results.push(articleResult);

    // Delay between articles to be respectful to APIs
    if (i < enrichedPairs.length - 1) {
      console.log('[Pipeline] Waiting 5s before next article...');
      await sleep(5000);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n========================================');
  console.log(`[Pipeline] ✅ Done in ${duration}s`);
  console.log('========================================\n');

  return {
    success: true,
    duration: `${duration}s`,
    articlesProcessed: results.length,
    results
  };
};

module.exports = { runPipeline };
