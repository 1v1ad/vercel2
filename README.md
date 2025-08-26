# GGRoom Frontend (Vite + React + Shadcn)

This is adapted from your archive. It uses:
- `VITE_BACKEND_URL` for POST `/api/log-auth`
- VK login via `window.VK.Auth.login(...)`
- Telegram Login Widget (hardcoded bot in `TelegramLoginButton.tsx`, change or wire to `VITE_TELEGRAM_BOT` if desired)

## Setup
1) Copy `.env.example` to `.env.local` and set `VITE_BACKEND_URL` to your Render backend.
2) `npm i` then `npm run dev` (local) or deploy to Netlify.
