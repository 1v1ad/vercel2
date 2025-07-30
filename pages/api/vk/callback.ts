import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing code');
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.VK_CLIENT_ID || '',
      client_secret: process.env.VK_CLIENT_SECRET || '',
      redirect_uri: process.env.VK_REDIRECT_URI || '',
      code,
    });

    const { data } = await axios.get(`https://oauth.vk.com/access_token?${params.toString()}`);

    // Примитивная авторизация: записываем user_id в cookie
    res.setHeader('Set-Cookie', serialize('vk_user_id', String(data.user_id), {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
    }));

    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка авторизации');
  }
}