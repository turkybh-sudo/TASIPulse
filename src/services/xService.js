// src/services/xService.js
// Posts to X (Twitter) using API v2 with OAuth 1.0a
// Uploads both EN and AR images, then posts a single tweet with both

const axios = require('axios');
const crypto = require('crypto');

// --- OAuth 1.0a Helpers ---

const percentEncode = (str) =>
  encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

const generateOAuthHeader = (method, url, params, credentials) => {
  const oauthParams = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: '1.0'
  };

  // Combine all params for signature
  const allParams = { ...params, ...oauthParams };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams)
  ].join('&');

  const signingKey = `${percentEncode(credentials.apiSecret)}&${percentEncode(credentials.accessTokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const headerValue = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return headerValue;
};

// --- Upload media to X (chunked upload protocol) ---

const uploadMedia = async (imageBuffer, credentials) => {
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

  // Step 1: INIT
  const initParams = {
    command: 'INIT',
    total_bytes: imageBuffer.length.toString(),
    media_type: 'image/png',
    media_category: 'tweet_image'
  };

  const initHeader = generateOAuthHeader('POST', uploadUrl, initParams, credentials);
  const initResponse = await axios.post(
    uploadUrl,
    new URLSearchParams(initParams).toString(),
    {
      headers: {
        Authorization: initHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  const mediaId = initResponse.data.media_id_string;
  console.log(`[X] Media INIT - ID: ${mediaId}`);

  // Step 2: APPEND — use multipart/form-data with Buffer (Node-native, no browser FormData)
  const appendHeader = generateOAuthHeader('POST', uploadUrl, {}, credentials);
  const boundary = `----TasiPulseBoundary${Date.now()}`;

  const bodyParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="command"\r\n\r\nAPPEND`,
    `--${boundary}\r\nContent-Disposition: form-data; name="media_id"\r\n\r\n${mediaId}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="segment_index"\r\n\r\n0`,
    `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`
  ];

  const bodyPrefix = Buffer.from(bodyParts.join('\r\n') + '\r\n');
  const bodySuffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const multipartBody = Buffer.concat([bodyPrefix, imageBuffer, bodySuffix]);

  await axios.post(uploadUrl, multipartBody, {
    headers: {
      Authorization: appendHeader,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBody.length
    },
    maxBodyLength: Infinity
  });

  console.log(`[X] Media APPEND done`);

  // Step 3: FINALIZE
  const finalizeParams = { command: 'FINALIZE', media_id: mediaId };
  const finalizeHeader = generateOAuthHeader('POST', uploadUrl, finalizeParams, credentials);
  await axios.post(
    uploadUrl,
    new URLSearchParams(finalizeParams).toString(),
    {
      headers: {
        Authorization: finalizeHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  console.log(`[X] Media FINALIZE done - mediaId: ${mediaId}`);
  return mediaId;
};

// --- Post tweet with media ---

const postToX = async ({ enBuffer, arBuffer, enriched }) => {
  const credentials = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET
  };

  if (!credentials.apiKey || !credentials.accessToken) {
    throw new Error('X credentials not configured');
  }

  console.log('[X] Starting post pipeline...');

  // Upload both images
  const [enMediaId, arMediaId] = await Promise.all([
    uploadMedia(enBuffer, credentials),
    uploadMedia(arBuffer, credentials)
  ]);

  // Build tweet text - EN caption + AR caption combined
  // X allows 280 chars. We keep it tight.
  const caption = buildXCaption(enriched);

  // Post tweet via v2 API
  const tweetUrl = 'https://api.twitter.com/2/tweets';
  const tweetBody = {
    text: caption,
    media: {
      media_ids: [enMediaId, arMediaId] // Both images in one tweet
    }
  };

  const tweetHeader = generateOAuthHeader('POST', tweetUrl, {}, credentials);
  const response = await axios.post(tweetUrl, tweetBody, {
    headers: {
      Authorization: tweetHeader,
      'Content-Type': 'application/json'
    }
  });

  const tweetId = response.data?.data?.id;
  console.log(`[X] ✅ Posted successfully! Tweet ID: ${tweetId}`);
  return { success: true, tweetId, platform: 'x' };
};

const buildXCaption = (enriched) => {
  // Build a bilingual caption that fits 280 chars
  const en = enriched.caption_en || enriched.headline_en || '';
  const ar = enriched.caption_ar || enriched.headline_ar || '';

  // Try full bilingual first
  const full = `${en}\n\n${ar}`;
  if (full.length <= 275) return full;

  // Truncate EN if needed
  const maxEn = 130;
  const truncatedEn = en.length > maxEn ? en.substring(0, maxEn - 3) + '...' : en;
  const truncated = `${truncatedEn}\n\n${ar}`;
  if (truncated.length <= 275) return truncated;

  // Last resort: EN only with hashtags
  return en.substring(0, 272) + '...';
};

module.exports = { postToX };
