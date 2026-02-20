// src/server.js
require('dotenv').config();
const express = require('express');
const { runPipeline } = require('./pipeline');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/health', (req, res) => res.status(200).send('ok'));

// Protect trigger endpoint (recommended)
function isAuthorized(req) {
  const expected = process.env.TRIGGER_SECRET;
  if (!expected) return true; // if you don't set it, endpoint is open
  const provided =
    req.get('x-trigger-secret') ||
    req.query.secret ||
    req.body?.secret;
  return provided === expected;
}

let running = false;

app.post('/run', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // Prevent overlapping runs
  if (running) {
    return res.status(409).json({ ok: false, error: 'Pipeline already running' });
  }

  running = true;
  try {
    const result = await runPipeline();
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('[Service] Pipeline failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    running = false;
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`[Service] listening on ${port}`);
});
