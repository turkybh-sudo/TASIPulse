const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://graph.instagram.com/v21.0';

const postToInstagram = async ({ enBuffer, arBuffer, enriched }) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!token || !accountId) throw new Error('Instagram credentials not configured');

  const caption = buildCaption(enriched);
  console.log('[IG] Starting Instagram post...');

  // Upload EN image as container
  const enMediaId = await uploadImage(enBuffer, caption, token, accountId);
  console.log(`[IG] EN container created: ${enMediaId}`);

  // Publish
  const postId = await publishContainer(enMediaId, token, accountId);
  console.log(`[IG] ✅ Posted! Post ID: ${postId}`);

  return { success: true, postId, platform: 'instagram' };
};

const uploadImage = async (imageBuffer, caption, token, accountId) => {
  // Step 1: Upload image to imgbb or use container URL approach
  // Instagram requires a public URL, so we upload buffer to a temp host
  const imageUrl = await uploadToImgbb(imageBuffer);

  const res = await axios.post(`${BASE_URL}/${accountId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: token
  });

  if (!res.data?.id) throw new Error('Failed to create media container');
  return res.data.id;
};

const publishContainer = async (containerId, token, accountId) => {
  // Wait for container to be ready
  await waitForContainer(containerId, token);

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
    console.log(`[IG] Container status: ${status}`);
    if (status === 'FINISHED') return;
    if (status === 'ERROR') throw new Error('Media container processing failed');
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
  console.log(`[IG] Image uploaded to: ${url}`);
  return url;
};

const buildCaption = (enriched) => {
  const en = enriched.caption_en || enriched.headline_en || '';
  const ar = enriched.caption_ar || enriched.headline_ar || '';
  const full = `${en}\n\n${ar}`;
  return full.length <= 2200 ? full : full.substring(0, 2197) + '...';
};

module.exports = { postToInstagram };
