// src/run.js
// Direct entrypoint for GitHub Actions.
// No HTTP server needed — Actions just runs this script and exits.

require('dotenv').config(); // no-op in Actions (env vars come from secrets), useful for local testing
const { runPipeline } = require('./pipeline');

(async () => {
  try {
    const result = await runPipeline();

    console.log('\n📊 Pipeline Summary:');
    console.log(`   Articles processed: ${result.articlesProcessed}`);
    console.log(`   Duration: ${result.duration}`);

    result.results.forEach((r, i) => {
      console.log(`\n   [${i + 1}] ${r.title.substring(0, 60)}`);
      if (r.error) {
        console.log(`       ❌ Error: ${r.error}`);
      } else {
        Object.entries(r.platforms).forEach(([platform, res]) => {
          const icon = res.success ? '✅' : '❌';
          const detail = res.tweetId ? `Tweet: ${res.tweetId}` : (res.error || '');
          console.log(`       ${icon} ${platform}: ${detail}`);
        });
      }
    });

    // Exit 1 if ALL articles failed — marks the Actions run as failed
    const anySuccess = result.results.some(r =>
      !r.error && Object.values(r.platforms).some(p => p.success)
    );

    if (!anySuccess) {
      console.error('\n❌ No posts were successfully published.');
      process.exit(1);
    }

    console.log('\n✅ Pipeline complete.\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Fatal pipeline error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
