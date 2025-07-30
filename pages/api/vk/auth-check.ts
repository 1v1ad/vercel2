import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const vkClientId = process.env.VK_CLIENT_ID;
  const redirectUri = process.env.VK_REDIRECT_URI;
  const state = Math.random().toString(36).substring(2, 15); // Можно сохранить в cookie/session

  const url = `https://oauth.vk.com/authorize?client_id=${vkClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&v=5.131&state=${state}`;

  res.redirect(url);
}