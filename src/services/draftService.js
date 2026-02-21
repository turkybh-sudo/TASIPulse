// src/services/draftService.js
const fs = require('fs');
const path = require('path');

const DRAFTS_DIR = '/tmp/drafts';

const ensureDraftsDir = () => {
  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }
};

const clearDrafts = () => {
  try {
    if (fs.existsSync(DRAFTS_DIR)) {
      fs.rmSync(DRAFTS_DIR, { recursive: true });
    }
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
    console.log('[Draft] Cleared old drafts');
  } catch (e) {
    console.warn('[Draft] Could not clear drafts:', e.message);
  }
};

const saveDraft = (index, enBuffer, arBuffer, enriched, article) => {
  ensureDraftsDir();

  const prefix = `draft_${index}`;

  // Save EN image
  fs.writeFileSync(path.join(DRAFTS_DIR, `${prefix}_EN.png`), enBuffer);

  // Save AR image
  fs.writeFileSync(path.join(DRAFTS_DIR, `${prefix}_AR.png`), arBuffer);

  // Build caption file
  const en = enriched.caption_en || enriched.headline_en || '';
  const ar = enriched.caption_ar || enriched.headline_ar || '';

  const captionContent = [
    '=== ENGLISH CAPTION ===',
    en,
    '',
    '=== ARABIC CAPTION ===',
    ar,
    '',
    '=== KEY POINTS (EN) ===',
    ...(enriched.key_points_en || []).map((p, i) => `${i + 1}. ${p}`),
    '',
    '=== KEY POINTS (AR) ===',
    ...(enriched.key_points_ar || []).map((p, i) => `${i + 1}. ${p}`),
    '',
    '=== SOURCE ===',
    `Title: ${article.title}`,
    `Source: ${article.source}`,
    `URL: ${article.url}`,
  ].join('\n');

  fs.writeFileSync(path.join(DRAFTS_DIR, `${prefix}_caption.txt`), captionContent);

  console.log(`[Draft] Saved draft ${index}: ${article.title.substring(0, 50)}`);
};

const getDrafts = () => {
  ensureDraftsDir();
  const files = fs.readdirSync(DRAFTS_DIR);
  const drafts = {};

  files.forEach(file => {
    const match = file.match(/^draft_(\d+)_(.+)$/);
    if (!match) return;
    const [, index, rest] = match;
    if (!drafts[index]) drafts[index] = { index: parseInt(index) };

    if (rest === 'EN.png') drafts[index].enImage = file;
    else if (rest === 'AR.png') drafts[index].arImage = file;
    else if (rest === 'caption.txt') {
      drafts[index].caption = fs.readFileSync(
        path.join(DRAFTS_DIR, file), 'utf8'
      );
    }
  });

  return Object.values(drafts).sort((a, b) => a.index - b.index);
};

const getDraftFile = (filename) => {
  const filepath = path.join(DRAFTS_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return filepath;
};

module.exports = { saveDraft, getDrafts, getDraftFile, clearDrafts };
