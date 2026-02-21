// src/pipeline.js
const { fetchTopArticles, savePostedTitles } = require('./services/rssService');
const { enrichArticles } = require('./services/geminiService');
const { generatePostImages } = require('./services/imageService');
const { postToInstagram } = require('./services/instagramService');

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

  if (articles.length === 0) {
    throw new Error('No fresh articles found — all recent articles already posted');
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

  // ── STEP 3 & 4: Generate images and post ─────────────────────────────────
  const successfullyPosted = [];

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

    // Step 4: Post to Instagram
    console.log('[Pipeline] Step 4: Publishing to Instagram...');
    try {
      const igResult = await postToInstagram({ ...images, enriched });
      articleResult.platforms.instagram = igResult;
      console.log(`[Pipeline] ✅ Instagram: Post ${igResult.postId}`);
      successfullyPosted.push({ title: article.title, url: article.url });
    } catch (err) {
      console.error(`[Pipeline] ❌ Instagram failed: ${err.message}`);
      articleResult.platforms.instagram = { success: false, error: err.message };
    }

    results.push(articleResult);

    if (i < enrichedPairs.length - 1) {
      console.log('[Pipeline] Waiting 5s before next article...');
      await sleep(5000);
    }
  }

  // ── Save successfully posted articles to history ───────────────────────────
  if (successfullyPosted.length > 0) {
    await savePostedTitles(successfullyPosted);
    console.log(`[Pipeline] 📝 Saved ${successfullyPosted.length} articles to history`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const successCount = results.filter(r => r.platforms?.instagram?.success).length;

  console.log('\n========================================');
  console.log(`[Pipeline] ✅ Done in ${duration}s`);
  console.log('========================================\n');

  console.log('📊 Pipeline Summary:');
  console.log(`   Articles processed: ${results.length}`);
  console.log(`   Successfully posted: ${successCount}`);
  console.log(`   Duration: ${duration}s`);
  results.forEach((r, idx) => {
    const igStatus = r.platforms?.instagram?.success
      ? `✅ Post ${r.platforms.instagram.postId}`
      : `❌ ${r.platforms?.instagram?.error || r.error}`;
    console.log(`   [${idx + 1}] ${r.title.substring(0, 55)}`);
    console.log(`       instagram: ${igStatus}`);
  });

  if (successCount === 0) {
    throw new Error('No posts were successfully published.');
  }

  return {
    success: true,
    duration: `${duration}s`,
    articlesProcessed: results.length,
    results
  };
};

module.exports = { runPipeline };
