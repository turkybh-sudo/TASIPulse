# TasiPulse Automation Server

Fully automated pipeline: **RSS → Gemini AI → Card Images → Social Media**
Runs every 6 hours using **GitHub Actions** — completely free, forever.

## How It Works

```
GitHub Actions cron (03:00 / 09:00 / 15:00 / 21:00 UTC)
  = 06:00 / 12:00 / 18:00 / 00:00 Riyadh time
    │
    ├─ 1. Fetch top 3 articles from RSS (Argaam, Al Arabiya)
    ├─ 2. Enrich each with Gemini AI → bilingual EN + AR content
    ├─ 3. Render EN card + AR card via Puppeteer (headless Chrome)
    ├─ 4. Post to X (Twitter) — EN + AR images in one tweet  ✅ active
    ├─ 5. Post to Instagram                                   🔜 coming soon
    ├─ 6. Post to YouTube Shorts                              🔜 coming soon
    └─ 7. Post to TikTok                                      🔜 coming soon
```

**Why GitHub Actions?**
- ✅ 100% free (2,000 min/month free; pipeline uses ~360 min/month)
- ✅ No server to maintain or keep alive
- ✅ Secrets stored securely in GitHub
- ✅ Full logs visible in the Actions tab
- ✅ Trigger manually anytime from the GitHub UI

---

## Deployment Guide

### Step 1 — Create a GitHub Repository

1. Go to [github.com](https://github.com) → **New repository**
2. Name it `tasipulse` (can be private ✅)
3. Push this project folder to it:

```bash
cd tasipulse-server
git init
git add .
git commit -m "Initial TasiPulse pipeline"
git remote add origin https://github.com/YOUR_USERNAME/tasipulse.git
git push -u origin main
```

---

### Step 2 — Add Your Secrets to GitHub

1. In your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add each one:

| Secret Name | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → API Keys |
| `X_API_KEY` | developer.twitter.com → Your App → Keys and Tokens |
| `X_API_SECRET` | Same as above |
| `X_ACCESS_TOKEN` | Same as above (must have Read+Write permission) |
| `X_ACCESS_TOKEN_SECRET` | Same as above |

> ⚠️ Make sure your X app has **Read and Write** permissions, not just Read.
> If you changed permissions after generating tokens, you must regenerate the access token + secret.

---

### Step 3 — Trigger a Test Run

1. In your GitHub repo → **Actions** tab
2. Click **TasiPulse Pipeline** in the left sidebar
3. Click **Run workflow** → **Run workflow**
4. Watch the live logs

If it succeeds, check your X account — you should see 3 new posts!

---

### Step 4 — Let It Run Automatically

That's it. The schedule is already in `.github/workflows/pipeline.yml`:

```
0 3,9,15,21 * * *  →  06:00, 12:00, 18:00, 00:00 Riyadh time
```

GitHub triggers it every 6 hours. No further setup needed.

> 💡 **Note:** GitHub pauses scheduled workflows on repos with no activity for 60 days.
> Just push any small commit or manually trigger a run to keep it active.

---

## File Structure

```
tasipulse-server/
├── .github/
│   └── workflows/
│       └── pipeline.yml          # The scheduler — runs every 6h
├── src/
│   ├── run.js                    # Entrypoint called by GitHub Actions
│   ├── pipeline.js               # Orchestrates all steps
│   ├── services/
│   │   ├── rssService.js         # Fetches RSS feeds
│   │   ├── geminiService.js      # Gemini AI enrichment
│   │   ├── imageService.js       # Puppeteer card image capture
│   │   └── xService.js           # X (Twitter) posting via API v2
│   └── templates/
│       └── cardTemplate.js       # HTML card design (mirrors your React app)
├── .env.example                  # For local testing only — never commit .env
├── package.json
└── README.md
```

---

## Local Testing

```bash
npm install
cp .env.example .env    # fill in your keys
npm start
```

---

## Monitoring

- **GitHub Actions tab** — every run shows full logs and pass/fail status
- **Email alerts** — GitHub emails you automatically on failure
- To add Slack/Discord notifications, add a notify step to `pipeline.yml`

---

## Adding More Platforms

When ready to add Instagram/YouTube/TikTok:
1. Create `src/services/instagramService.js` (etc.)
2. Uncomment the relevant lines in `src/pipeline.js`
3. Add the required secrets in GitHub → Settings → Secrets
4. Uncomment the env vars in `.github/workflows/pipeline.yml`
