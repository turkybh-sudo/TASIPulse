// src/services/geminiService.js
const axios = require('axios');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const enrichArticle = async (article) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  console.log(`[Gemini] Enriching: "${article.title.substring(0, 60)}..."`);

  const prompt = `
You are a professional financial news editor for "TasiPulse", a Saudi market news outlet.

Task: Analyze the following news article and extract/generate content for a social media post.

Input Source: ${article.source}
Input Title: ${article.title}
Input Text: ${article.description}

Requirements:
1. Translate the core message to Arabic (Saudi business dialect, proper RTL Arabic - NOT transliterated).
2. Provide a punchy Headline in both English and Arabic (max 80 chars each).
3. Provide a short 2-sentence summary in both languages.
4. Extract 3-4 key bullet points in both languages (concise, max 60 chars each).
5. Generate a social media caption with relevant Arabic/English hashtags (max 300 chars).
6. Extract any numerical figures (prices, %, billions, etc.) into a structured list. Max 3 figures. If no specific figures exist, return empty array.

IMPORTANT: Arabic text must be real Arabic script (عربي), not romanized transliteration.

Return ONLY valid JSON, no markdown, matching this exact schema:
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
      maxOutputTokens: 1500
    }
  };

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

  // Clean up any markdown code fences just in case
  const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
  const enriched = JSON.parse(cleanJson);

  console.log(`[Gemini] Enriched successfully: "${enriched.headline_en?.substring(0, 50)}"`);
  return enriched;
};

const enrichArticles = async (articles) => {
  const results = [];

  for (const article of articles) {
    try {
      const enriched = await enrichArticle(article);
      results.push({ article, enriched });

      // Small delay between API calls to avoid rate limiting
      if (articles.indexOf(article) < articles.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`[Gemini] Failed to enrich "${article.title}": ${err.message}`);
      // Skip failed articles rather than crashing the whole pipeline
    }
  }

  console.log(`[Gemini] Successfully enriched ${results.length}/${articles.length} articles`);
  return results;
};

module.exports = { enrichArticles };
