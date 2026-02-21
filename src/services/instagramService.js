// src/services/instagramService.js
const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://graph.instagram.com/v21.0';

const postToInstagram = async ({ enBuffer, arBuffer, enriched }) => {
  const token     = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!token || !accountId) throw new Error('Instagram credentials not configured');

  const caption = buildCaption(enriched);
  console.log('[IG] Starting Instagram carousel post...');

  // Upload both images to imgbb
  const enUrl = await uploadToImgbb(enBuffer);
  console.log(`[IG] EN image uploaded: ${enUrl}`);
  const arUrl = await uploadToImgbb(arBuffer);
  console.log(`[IG] AR image uploaded: ${arUrl}`);

  // Create carousel children
  const enChildId = await createCarouselChild(enUrl, token, accountId);
  console.log(`[IG] EN child container: ${enChildId}`);
  const arChildId = await createCarouselChild(arUrl, token, accountId);
  console.log(`[IG] AR child container: ${arChildId}`);

  // Wait for both children to be ready
  await waitForContainer(enChildId, token);
  await waitForContainer(arChildId, token);

  // Create carousel container
  const carouselId = await createCarouselContainer(
    [enChildId, arChildId], caption, token, accountId
  );
  console.log(`[IG] Carousel container: ${carouselId}`);

  // Wait for carousel to be ready
  await waitForContainer(carouselId, token);

  // Publish
  const postId = await publishContainer(carouselId, token, accountId);
  console.log(`[IG] ✅ Posted carousel! Post ID: ${postId}`);

  return { success: true, postId, platform: 'instagram' };
};

const createCarouselChild = async (imageUrl, token, accountId) => {
  try {
    const res = await axios.post(`${BASE_URL}/${accountId}/media`, {
      image_url: imageUrl,
      is_carousel_item: true,
      access_token: token
    });
    if (!res.data?.id) throw new Error('No ID returned from carousel child creation');
    return res.data.id;
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`[IG] Carousel child error: ${detail}`);
    throw new Error(`Carousel child failed: ${detail}`);
  }
};

const createCarouselContainer = async (childIds, caption, token, accountId) => {
  try {
    const payload = {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: token
    };
    console.log(`[IG] Creating carousel with children: ${childIds.join(', ')}`);
    const res = await axios.post(`${BASE_URL}/${accountId}/media`, payload);
    if (!res.data?.id) throw new Error('No ID returned from carousel container creation');
    return res.data.id;
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`[IG] Carousel container error: ${detail}`);
    throw new Error(`Carousel container failed: ${detail}`);
  }
};

const publishContainer = async (containerId, token, accountId) => {
  try {
    const res = await axios.post(`${BASE_URL}/${accountId}/media_publish`, {
      creation_id: containerId,
      access_token: token
    });
    if (!res.data?.id) throw new Error('No ID returned from publish');
    return res.data.id;
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`[IG] Publish error: ${detail}`);
    throw new Error(`Publish failed: ${detail}`);
  }
};

const waitForContainer = async (containerId, token) => {
  for (let i = 0; i < 12; i++) {
    try {
      const res = await axios.get(`${BASE_URL}/${containerId}`, {
        params: { fields: 'status_code,status', access_token: token }
      });
      const status = res.data?.status_code;
      console.log(`[IG] Container ${containerId} status: ${status}`);
      if (status === 'FINISHED') return;
      if (status === 'ERROR') {
        const errMsg = res.data?.status || 'unknown error';
        throw new Error(`Container ${containerId} failed: ${errMsg}`);
      }
    } catch (err) {
      if (err.message.includes('Container')) throw err;
      console.warn(`[IG] Status check failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Container ${containerId} timed out after 36s`);
};

const uploadToImgbb = async (imageBuffer) => {
  try {
    const form = new FormData();
    form.append('image', imageBuffer.toString('base64'));

    const res = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      form,
      { headers: form.getHeaders(), timeout: 15000 }
    );

    const url = res.data?.data?.url;
    if (!url) throw new Error(`imgbb response missing URL: ${JSON.stringify(res.data)}`);
    return url;
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`[IG] imgbb upload error: ${detail}`);
    throw new Error(`imgbb upload failed: ${detail}`);
  }
};

const buildCaption = (enriched) => {
  const en = enriched.caption_en || enriched.headline_en || '';
  const ar = enriched.caption_ar || enriched.headline_ar || '';
  const full = `${en}\n\n${ar}`;
  return full.length <= 2200 ? full : full.substring(0, 2197) + '...';
};

module.exports = { postToInstagram };
