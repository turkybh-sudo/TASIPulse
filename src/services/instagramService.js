const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://graph.instagram.com/v21.0';

const postToInstagram = async ({ enBuffer, arBuffer, enriched }) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!token || !accountId) throw new Error('Instagram credentials not configured');

  const caption = buildCaption(enriched);
  console.log('[IG] Starting Instagram carousel post...');

  // Upload both images to imgbb first
  const enUrl = await uploadToImgbb(enBuffer);
  console.log(`[IG] EN image uploaded`);
  const arUrl = await uploadToImgbb(arBuffer);
  console.log(`[IG] AR image uploaded`);

  // Create carousel children (no caption on children)
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
  const res = await axios.post(`${BASE_URL}/${accountId}/media`, {
    image_url: imageUrl,
    is_carousel_item: true,
    access_token: token
  });
  if (!res.data?.id) throw new Error('Failed to create carousel child');
  return res.data.id;
};

const createCarouselContainer = async (childIds, caption, token, accountId) => {
  const res = await axios.post(`${BASE_URL}/${accountId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: token
  });
  if (!res.data?.id) throw new Error('Failed to create carousel container');
  return res.data.id;
};

const publishContainer = async (containerId, token, accountId) => {
  const res = await axios.post(`${BASE_URL}/${accountId}/media_publish`, {
    creation_id: containerId,
    access_token: token
  });
  if (!res.data?.id) throw new Error('Failed to publish media');
  return res.data.id;
};

const waitForContainer = async (containerId, token) => {
  for (let i = 0; i < 10; i++) {
    const res = await axios.get(`${BASE_URL}/${containerId}`, {
      params: { fields: 'status_code', access_token: token }
    });
    const status = res.data?.status_code;
    console.log(`[IG] Container ${containerId} status: ${status}`);
    if (status === 'FINISHED') return;
    if (status === 'ERROR') throw new Error(`Container ${containerId} processing failed`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Media container timeout');
};

const uploadToImgbb = async (imageBuffer) => {
  const form = new FormData();
  form.append('image', imageBuffer.toString('base64'));

  const res = await axios.post(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    form,
    { headers: form.getHeaders() }
  );

  const url = res.data?.data?.url;
  if (!url) throw new Error('imgbb upload failed');
  return url;
};

const buildCaption = (enriched) => {
  const en = enriched.caption_en || enriched.headline_en || '';
  const ar = enriched.caption_ar || enriched.headline_ar || '';
  const full = `${en}\n\n${ar}`;
  return full.length <= 2200 ? full : full.substring(0, 2197) + '...';
};

module.exports = { postToInstagram };
