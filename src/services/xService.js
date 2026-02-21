// src/services/xService.js
const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');

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

  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');
};

const uploadMedia = async (imageBuffer, credentials, label) => {
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

  // INIT
  const initParams = {
    command: 'INIT',
    total_bytes: imageBuffer.length.toString(),
    media_type: 'image/png',
    media_category: 'tweet_image'
  };

  const initHeader = generateOAuthHeader('POST', uploadUrl, initParams, credentials);

  let initResponse;
  try {
    initResponse = await axios.post(
      uploadUrl,
      new URLSearchParams(initParams).toString(),
      { headers: { Authorization: initHeader, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (err) {
    console.error(`[X] ${label} INIT failed:`, JSON.stringify(err.response?.data, null, 2));
    throw err;
  }

  const mediaId = initResponse.data.media_id_string;
  console.log(`[X] ${label} INIT - ID: ${mediaId}`);

  // APPEND
  const appendHeader = generateOAuthHeader('POST', uploadUrl, {}, credentials);

  const form = new FormData();
  form.append('command', 'APPEND');
  form.append('media_id', mediaId);
  form.append('segment_index', '0');
  form.append('media', imageBuffer, {
    filename: 'image.png',
    contentType: 'image/png',
    knownLength: imageBuffer.length
  });

  try {
    await axios.post(uploadUrl, form, {
      headers: {
        Authorization: appendHeader,
        ...form.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
  } catch (err) {
    console.error(`[X] ${label} APPEND failed:`, JSON.stringify(err.response?.data, null, 2));
    throw err;
  }

  console.log(`[X] ${label} APPEND done`);

  // FINALIZE
  const finalizeParams = { command: 'FINALIZE', media_id: mediaId };
  const finalizeHeader = generateOAuthHeader('POST', uploadUrl, finalizeParams, credentials);

  let finalizeResponse;
  try {
    finalizeResponse = await axios.post(
      uploadUrl,
      new URLSearchParams(finalizeParams).toString(),
      { headers: { Authorization: finalizeHeader, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (err) {
    console.error(`[X] ${label} FINALIZE failed:`, JSON.stringify(err.response?.data, null, 2));
    throw err;
  }

  const state = finalizeResponse.data?.processing_info?.state || 'ready';
  console.log(`[X] ${label} FINALIZE done - state: ${state}`);

  if (finalizeResponse.data?.processing_info) {
    const info = finalizeResponse.data.processing_info;
    if (info.state === 'pending' || info.state === 'in_progress') {
      const checkAfterSecs = info.check_after_secs || 2;
      await new Promise(r => setTimeout(r, checkAfterSecs * 1000));
      await waitForMediaProcessing(mediaId, credentials, label);
    }
  }

  return mediaId;
};

const waitForMediaProcessing = async (mediaId, credentials, label) => {
  const statusUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const params = { command: 'STATUS', media_id: mediaId };

  for (let i = 0; i < 15; i++) {
    const header = generateOAuthHeader('GET', statusUrl, params, credentials);

    try {
      const res = await axios.get(statusUrl, {
        params,
        headers: { Authorization: header }
      });

      const info = res.data?.processing_info;
      const state = info?.state || 'ready';
      console.log(`[X] ${label} STATUS - state: ${state}`);

      if (!info) return;
      if (state === 'succeeded') return;
      if (state === 'failed') {
        throw new Error(`[X] ${label} Media processing failed: ${JSON.stringify(info, null, 2)}`);
      }

      const wait = (info.check_after_secs || 2) * 1000;
      await new Promise(r => setTimeout(r, wait));
    } catch (err) {
      console.error(`[X] ${label} STATUS check failed:`, JSON.stringify(err.response?.data, null, 2));
      throw err;
    }
  }

  throw new Error(`[X] ${label} Media processing timeout (media_id=${mediaId})`);
};

const buildXCaption = (enriched) => {
  const en = enriched.caption_en || enriched.headline_en || '';
  const ar = enriched.caption_ar || enriched.headline_ar || '';

  const full = `${en}\n\n${ar}`;
  if (full.length <= 275) return full;

  const maxEn = 130;
  const truncatedEn = en.length > maxEn ? en.substring(0, maxEn - 3) + '...' : en;
  const truncated = `${truncatedEn}\n\n${ar}`;
  if (truncated.length <= 275) return truncated;

  return en.substring(0, 272) + '...';
};

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

  const enMediaId = await uploadMedia(enBuffer, credentials, 'EN');
  const arMediaId = await uploadMedia(arBuffer, credentials, 'AR');

  const caption = buildXCaption(enriched);
  console.log(`[X] Caption (${caption.length} chars):\n${caption}`);

  const tweetUrl = 'https://api.twitter.com/2/tweets';
  const tweetBody = {
    text: caption,
    media: { media_ids: [enMediaId, arMediaId] }
  };

  console.log('[X] Sending tweet...');

  const tweetHeader = generateOAuthHeader('POST', tweetUrl, {}, credentials);

  let response;
  try {
    response = await axios.post(tweetUrl, tweetBody, {
      headers: {
        Authorization: tweetHeader,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('[X] Tweet post failed with status:', err.response?.status);
    console.error('[X] Tweet post error detail:', JSON.stringify(err.response?.data, null, 2));
    throw err;
  }

  const tweetId = response.data?.data?.id;
  console.log(`[X] ✅ Posted! Tweet ID: ${tweetId}`);
  return { success: true, tweetId, platform: 'x' };
};

module.exports = { postToX };
