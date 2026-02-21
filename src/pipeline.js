// src/pipeline.js
const { fetchTopArticles, savePostedTitles } = require('./services/rssService');
const { enrichArticles } = require('./services/geminiService');
const { generatePostImages } = require('./services/imageService');
const { saveDraft, clearDrafts } = require('./services/draftService');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const runPipeline = async () => {
  const startTime = Date.now();
  const results = [];

  console.log('\n========================================');
  console.log(`[Pipeline] 🚀 Starting at ${new Date().toISOString()}`);
  console.log('========================================\n');

  // Clear old drafts at start of each run
  clearDrafts();

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

  // ── STEP 3 & 4: Generate images and save drafts ───────────────────────────
  const successfullyProcessed = [];

  for (let i = 0; i < enrichedPairs.length; i++) {
    const { article, enriched } = enrichedPairs[i];

    console.log(`\n[Pipeline] Processing article ${i + 1}/${enrichedPairs.length}`);
    console.log(`[Pipeline] 📰 "${article.title.substring(0, 70)}"`);

    const articleResult = {
      title: article.title,
      source: article.source,
      status: 'pending'
    };

    // Step 3: Generate images
    console.log('[Pipeline] Step 3: Generating card images...');
    let images;
    try {
      images = await generatePostImages(enriched, article.date);
      console.log('[Pipeline] ✅ Images generated\n');
    } catch (err) {
      console.error(`[Pipeline] ❌ Image generation failed: ${err.message}`);
      articleResult.status = 'failed';
      articleResult.error = err.message;
      results.push(articleResult);
      continue;
    }

    // Step 4: Save draft
    console.log('[Pipeline] Step 4: Saving draft...');
    try {
      saveDraft(i + 1, images.enBuffer, images.arBuffer, enriched, article);
      articleResult.status = 'draft_ready';
      successfullyProcessed.push({ title: article.title, url: article.url });
      console.log(`[Pipeline] ✅ Draft ${i + 1} saved`);
    } catch (err) {
      console.error(`[Pipeline] ❌ Draft save failed: ${err.message}`);
      articleResult.status = 'failed';
      articleResult.error = err.message;
    }

    results.push(articleResult);

    if (i < enrichedPairs.length - 1) {
      console.log('[Pipeline] Waiting 5s before next article...');
      await sleep(5000);
    }
  }

  // Save to posted history so we don't re-fetch same articles
  if (successfullyProcessed.length > 0) {
    savePostedTitles(successfullyProcessed);
    console.log(`[Pipeline] 📝 Saved ${successfullyProcessed.length} articles to history`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const draftCount = results.filter(r => r.status === 'draft_ready').length;

  console.log('\n========================================');
  console.log(`[Pipeline] ✅ Done in ${duration}s`);
  console.log('========================================\n');

  console.log('📊 Pipeline Summary:');
  console.log(`   Articles processed: ${results.length}`);
  console.log(`   Drafts ready: ${draftCount}`);
  console.log(`   Duration: ${duration}s`);
  results.forEach((r, idx) => {
    const status = r.status === 'draft_ready' ? '✅ Draft ready' : `❌ ${r.error}`;
    console.log(`   [${idx + 1}] ${r.title.substring(0, 55)}`);
    console.log(`       ${status}`);
  });

  if (draftCount === 0) {
    throw new Error('No drafts were successfully prepared.');
  }

  return {
    success: true,
    duration: `${duration}s`,
    articlesProcessed: results.length,
    draftsReady: draftCount,
    results
  };
};

module.exports = { runPipeline };
