// src/templates/cardTemplate.js
// Generates the HTML that Puppeteer renders to capture the card image.
// This mirrors the CanvasGenerator React component exactly.

const getHeadlineSize = (text, isStory) => {
  const len = (text || '').length;
  if (isStory) {
    if (len > 100) return 'font-size:18px;line-height:1.3';
    if (len > 60) return 'font-size:20px;line-height:1.25';
    return 'font-size:24px;line-height:1.25';
  } else {
    if (len > 100) return 'font-size:20px;line-height:1.3';
    if (len > 60) return 'font-size:24px;line-height:1.25';
    return 'font-size:30px;line-height:1.1';
  }
};

const getBodySize = (keyPoints, hasFigures, isStory) => {
  const totalChars = keyPoints.join('').length;
  if (isStory) {
    if (totalChars > 320) return 'font-size:11px;line-height:1.3';
    if (totalChars > 220) return 'font-size:12px;line-height:1.4';
    return 'font-size:14px;line-height:1.5';
  } else {
    if (hasFigures) {
      if (totalChars > 420) return 'font-size:11px;line-height:1.3';
      if (totalChars > 340) return 'font-size:12px;line-height:1.4';
      if (totalChars > 250) return 'font-size:13px;line-height:1.4';
      return 'font-size:14px;line-height:1.6';
    } else {
      if (totalChars > 450) return 'font-size:12px;line-height:1.6';
      if (totalChars > 350) return 'font-size:14px;line-height:1.6';
      return 'font-size:16px;line-height:1.6';
    }
  }
};

const trendIcon = (trend) => {
  if (trend === 'up') return `<span style="color:#34d399;font-size:12px">▲</span>`;
  if (trend === 'down') return `<span style="color:#f87171;font-size:12px">▼</span>`;
  return '';
};

const generateCardHtml = (config) => {
  const { headline, summary, keyPoints, figures, date, lang, platform } = config;

  const isArabic = lang === 'ar';
  const isStory = platform === 'story';

  // Dimensions
  const width = isStory ? 360 : 450;
  const height = isStory ? 640 : 450;

  const dateStr = new Date(date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'Asia/Riyadh'
  });

  const headlineStyle = getHeadlineSize(headline, isStory);
  const bodyStyle = getBodySize(keyPoints || [], figures?.length > 0, isStory);
  const hasFigures = figures && figures.length > 0;
  const dir = isArabic ? 'rtl' : 'ltr';
  const textAlign = isArabic ? 'right' : 'left';

  const pointsToShow = (keyPoints || []).slice(0, isStory ? 5 : 4);

  const figuresCols = hasFigures ? (figures.length > 1 ? `repeat(${Math.min(figures.length, 3)}, 1fr)` : '1fr') : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: #04060c;
    font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
  }

  /* Arabic font fallback */
  .arabic-text {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
  }

  .card {
    width: ${width}px;
    height: ${height}px;
    background: #04060c;
    color: white;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Grid background */
  .grid-bg {
    position: absolute;
    inset: 0;
    opacity: 0.2;
    background-image:
      linear-gradient(rgba(56,189,248,0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56,189,248,0.1) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  /* Decorative blobs */
  .blob-top {
    position: absolute;
    top: -150px; right: -150px;
    width: 360px; height: 360px;
    background: rgba(37,99,235,0.1);
    border-radius: 50%;
    filter: blur(100px);
  }
  .blob-bottom {
    position: absolute;
    bottom: -120px; left: -120px;
    width: 270px; height: 270px;
    background: rgba(8,145,178,0.1);
    border-radius: 50%;
    filter: blur(80px);
  }

  .content {
    position: relative;
    z-index: 10;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 24px;
    direction: ${dir};
    text-align: ${textAlign};
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    flex-shrink: 0;
  }
  .brand-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: white;
  }
  .brand-sub {
    font-size: 8px;
    color: #64748b;
    font-family: monospace;
    letter-spacing: 3px;
    margin-top: 2px;
  }

  /* Main content */
  .main-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .headline {
    font-weight: 700;
    margin-bottom: 12px;
    color: white;
    ${headlineStyle};
    ${isArabic ? 'font-family: "Segoe UI", Tahoma, Arial, sans-serif;' : ''}
  }

  .accent-line {
    height: 4px;
    width: 64px;
    background: linear-gradient(to right, #22d3ee, #2563eb);
    border-radius: 999px;
    margin-bottom: 16px;
    flex-shrink: 0;
    ${isArabic ? 'margin-right: 0;' : 'margin-left: 0;'}
  }

  .points-area {
    flex: 1;
    overflow: hidden;
  }

  .point-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .point-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #06b6d4;
    box-shadow: 0 0 8px rgba(6,182,212,0.8);
    margin-top: 5px;
  }

  .point-text {
    color: #e2e8f0;
    font-weight: 500;
    ${bodyStyle};
    ${isArabic ? 'font-family: "Segoe UI", Tahoma, Arial, sans-serif;' : ''}
  }

  /* Stats */
  .stats-box {
    background: rgba(15,20,30,0.8);
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 10px;
    margin-top: 16px;
    flex-shrink: 0;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: ${figuresCols};
    gap: 4px;
    ${figures?.length > 1 ? 'divide-x: 1px solid #1e293b;' : ''}
  }
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0 4px;
    ${figures?.length > 1 ? 'border-right: 1px solid #1e293b;' : ''}
  }
  .stat-item:last-child { border-right: none; border-left: none; }
  .stat-label {
    font-size: 8px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 2px;
    font-family: monospace;
    ${isArabic ? 'font-family: "Segoe UI", Tahoma, Arial, sans-serif;' : ''}
  }
  .stat-value {
    color: white;
    font-weight: 700;
    font-size: 14px;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Footer */
  .footer {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-shrink: 0;
  }
  .footer-date {
    font-family: monospace;
    font-size: 9px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }
  .footer-brand {
    color: #60a5fa;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.05em;
  }
</style>
</head>
<body>
<div class="card">
  <div class="grid-bg"></div>
  <div class="blob-top"></div>
  <div class="blob-bottom"></div>

  <div class="content">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand-name">TasiPulse</div>
        <div class="brand-sub">MARKET INTELLIGENCE</div>
      </div>
    </div>

    <!-- Main -->
    <div class="main-area">
      <h1 class="headline">${headline || 'Headline goes here...'}</h1>
      <div class="accent-line"></div>

      <div class="points-area">
        ${pointsToShow.length > 0
          ? pointsToShow.map(point => `
            <div class="point-item">
              <div class="point-dot"></div>
              <p class="point-text">${point}</p>
            </div>
          `).join('')
          : `<p style="color:#94a3b8;font-style:italic;font-size:14px">${summary || ''}</p>`
        }
      </div>
    </div>

    <!-- Stats -->
    ${hasFigures ? `
    <div class="stats-box">
      <div class="stats-grid">
        ${figures.slice(0, 3).map(fig => `
          <div class="stat-item">
            <div class="stat-label">${isArabic ? fig.label_ar : fig.label_en}</div>
            <div class="stat-value">${fig.value} ${trendIcon(fig.trend)}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <span class="footer-date">${dateStr}</span>
      <span class="footer-brand">@TasiPulse</span>
    </div>
  </div>
</div>
</body>
</html>`;
};

module.exports = { generateCardHtml };
