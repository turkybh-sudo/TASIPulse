// src/services/geminiService.js
const axios = require('axios');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const getApiKeys = () => {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean);

  if (keys.length === 0) throw new Error('No GEMINI_API_KEY configured');
  console.log(`[Gemini] ${keys.length} API key(s) available`);
  return keys;
};

const enrichArticle = async (article) => {
  const apiKeys = getApiKeys();
  let lastError;

  console.log(`[Gemini] Enriching: "${article.title.substring(0, 60)}..."`);

  const prompt = `
You are a professional financial news editor for "TasiPulse", a Saudi market news outlet.

Task: Analyze the following news article and extract/generate content for a social media post.

Input Title: ${article.title}
Input Text: ${article.description}

Requirements:
1. Translate the core message to Arabic (Saudi business dialect, proper RTL Arabic - NOT transliterated).
2. Provide a punchy Headline in both English and Arabic (max 80 chars each).
3. Provide a short 2-sentence summary in both languages.
4. Extract 3-4 key bullet points in both languages (concise, max 60 chars each).
5. Generate a social media caption with relevant Arabic/English hashtags (max 300 chars).
6. Extract any numerical figures (prices, %, billions, etc.) into a structured list. Max 3 figures. If no specific figures exist, return empty array.
   For the "trend" field use intelligent analysis:
   - "up" if the figure represents growth, increase, profit, rise, positive return, or improvement
   - "down" if the figure represents decline, loss, drop, decrease, negative return, or contraction
   - "neutral" if the figure is a static value like a price, rate, count, or percentage with no directional context

IMPORTANT: Arabic text must be real Arabic script (عربي), not romanized transliteration.
IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanation. Just the raw JSON object.

Schema:
{
  "headline_en": "string",
  "headline_ar": "string",
  "summary_en": "string",
  "summary_ar": "string",
  "key_points_en": ["string", "string", "string"],
  "key_points_ar": ["string", "string", "string"],
  "caption_en": "string",
  "caption_ar": "string",
  "figures": [
    {
      "key": "string",
      "value": "string",
      "label_en": "string",
      "label_ar": "string",
      "trend": "up|down|neutral"
    }
  ]
}
`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
      maxOutputTokens: 4000
    }
  };

  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
    const apiKey = apiKeys[keyIndex];
    console.log(`[Gemini] Trying API key ${keyIndex + 1}/${apiKeys.length}...`);

    try {
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${apiKey}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');

      const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
      const enriched = JSON.parse(cleanJson);

      console.log(`[Gemini] ✅ Enriched with key ${keyIndex + 1}: "${enriched.headline_en?.substring(0, 50)}"`);
      return enriched;

    } catch (err) {
      lastError = err;
      const is429 = err.response?.status === 429;

      if (is429) {
        console.warn(`[Gemini] Key ${keyIndex + 1} rate limited (429) — trying next key...`);
        await sleep(2000);
      } else {
        console.error(`[Gemini] Key ${keyIndex + 1} error: ${err.message}`);
        throw err;
      }
    }
  }

  console.error(`[Gemini] ❌ All ${apiKeys.length} API keys rate limited`);
  throw lastError;
};

const enrichArticles = async (articles) => {
  const results = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    if (i > 0) {
      console.log('[Gemini] Waiting 15s before next article...');
      await sleep(15000);
    }

    try {
      const enriched = await enrichArticle(article);
      results.push({ article, enriched });
    } catch (err) {
      console.error(`[Gemini] ❌ Failed to enrich "${article.title}": ${err.message}`);
    }
  }

  console.log(`[Gemini] Successfully enriched ${results.length}/${articles.length} articles`);
  return results;
};

module.exports = { enrichArticles };
