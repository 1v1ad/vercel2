// server.ts
// Бэкенд на Node.js + Express + TypeScript для авторизации через VK и управления сессиями

import express, { Request, Response } from 'express';
import session from 'express-session';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

// Загрузка переменных окружения из .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Настройки CORS — разрешить фронтенд
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// Парсинг JSON тела запросов
app.use(express.json());

// Настройка сессий с HTTP-only cookie
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'replace_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// Типизация объекта сессии
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      firstName: string;
      lastName: string;
      avatarUrl: string;
    };
  }
}

// POST /api/auth/vk — обмен кода на токен и создание сессии
app.post('/api/auth/vk', async (req: Request, res: Response) => {
  const { code, deviceId } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  try {
    // 1. Обмен кода на access_token
    const tokenResponse = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: process.env.VK_CLIENT_ID,
        client_secret: process.env.VK_CLIENT_SECRET,
        redirect_uri: process.env.VK_REDIRECT_URI,
        code,
      },
    });

    const { access_token, user_id } = tokenResponse.data;

    // 2. Запрос профиля пользователя
    const profileResponse = await axios.get('https://api.vk.com/method/users.get', {
      params: {
        user_ids: user_id,
        fields: 'photo_200',
        access_token,
        v: '5.131',
      },
    });

    const profile = profileResponse.data.response[0];

    // 3. Сохранение в сессии
    req.session.user = {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      avatarUrl: profile.photo_200,
    };

    // 4. Ответ клиенту
    res.json({ success: true });
  } catch (err: any) {
    console.error('VK Auth Error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'VK authorization failed' });
  }
});

// GET /api/user/me — получение информации о текущем пользователе
app.get('/api/user/me', (req: Request, res: Response) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

// Защита лобби: переадресация на фронтенд
app.get('/lobby', (req: Request, res: Response) => {
  if (!req.session.user) {
    return res.redirect(process.env.FRONTEND_URL || '/');
  }
  res.sendFile('lobby.html', { root: __dirname + '/../public' });
});

// Статика фронтенда
app.use(express.static(__dirname + '/../public'));

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
