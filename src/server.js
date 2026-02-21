// src/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { runPipeline } = require('./pipeline');
const { getDrafts, getDraftFile } = require('./services/draftService');

const app = express();
app.use(express.json({ limit: '2mb' }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).send('ok'));

// ── Auth helper ───────────────────────────────────────────────────────────────
function isAuthorized(req) {
  const expected = process.env.TRIGGER_SECRET;
  if (!expected) return true;
  const provided =
    req.get('x-trigger-secret') ||
    req.query.secret ||
    req.body?.secret;
  return provided === expected;
}

// ── Run pipeline ──────────────────────────────────────────────────────────────
let running = false;

app.post('/run', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
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

// ── Drafts UI ─────────────────────────────────────────────────────────────────
app.get('/drafts', (req, res) => {
  const drafts = getDrafts();

  const cards = drafts.length === 0
    ? `<div class="empty">No drafts available yet. Pipeline runs at 06:00, 12:00, 18:00, 00:00 Riyadh time.</div>`
    : drafts.map(d => `
        <div class="card">
          <div class="card-header">Draft ${d.index}</div>
          <div class="images">
            ${d.enImage ? `
              <div class="img-block">
                <div class="img-label">🇬🇧 English</div>
                <img src="/drafts/file/${d.enImage}" />
                <a class="btn" href="/drafts/file/${d.enImage}" download>⬇ Download EN</a>
              </div>` : ''}
            ${d.arImage ? `
              <div class="img-block">
                <div class="img-label">🇸🇦 Arabic</div>
                <img src="/drafts/file/${d.arImage}" />
                <a class="btn" href="/drafts/file/${d.arImage}" download>⬇ Download AR</a>
              </div>` : ''}
          </div>
          ${d.caption ? `
            <div class="caption-block">
              <pre>${d.caption}</pre>
              <a class="btn" href="/drafts/file/draft_${d.index}_caption.txt" download>⬇ Download Caption</a>
            </div>` : ''}
        </div>
      `).join('');

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TasiPulse Drafts</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #04060c;
      color: #e2e8f0;
      font-family: system-ui, sans-serif;
      padding: 24px;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: white;
      margin-bottom: 4px;
    }
    .subtitle {
      color: #64748b;
      font-size: 13px;
      margin-bottom: 32px;
      font-family: monospace;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .status {
      background: #0f1520;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #94a3b8;
    }
    .card {
      background: #0f1520;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card-header {
      font-size: 18px;
      font-weight: 700;
      color: #22d3ee;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .images {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .img-block {
      flex: 1;
      min-width: 200px;
    }
    .img-label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    img {
      width: 100%;
      max-width: 450px;
      border-radius: 8px;
      display: block;
      margin-bottom: 8px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(to right, #22d3ee, #2563eb);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
    }
    .caption-block {
      background: #04060c;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 16px;
    }
    pre {
      font-family: monospace;
      font-size: 13px;
      color: #94a3b8;
      white-space: pre-wrap;
      word-break: break-word;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    .empty {
      color: #64748b;
      font-size: 14px;
      text-align: center;
      padding: 48px;
      border: 1px dashed #1e293b;
      border-radius: 16px;
    }
    .refresh-btn {
      display: inline-block;
      background: #1e293b;
      color: #e2e8f0;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13px;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <h1>TasiPulse</h1>
  <div class="subtitle">Draft Posts — Ready to publish</div>
  <div class="status">
    📅 Pipeline runs at: 06:00 · 12:00 · 18:00 · 00:00 Riyadh time &nbsp;|&nbsp;
    📦 ${drafts.length} draft(s) available
  </div>
  <a class="refresh-btn" href="/drafts">🔄 Refresh</a>
  ${cards}
</body>
</html>`);
});

// ── Serve draft files ─────────────────────────────────────────────────────────
app.get('/drafts/file/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = getDraftFile(filename);

  if (!filepath) {
    return res.status(404).send('File not found');
  }

  if (filename.endsWith('.png')) {
    res.setHeader('Content-Type', 'image/png');
  } else if (filename.endsWith('.txt')) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  }

  res.sendFile(filepath);
});

// ── Start server ──────────────────────────────────────────────────────────────
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`[Service] listening on ${port}`);
});
