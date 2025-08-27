// src/warmup.ts — будим Render-бэк перед первыми запросами
const backend = import.meta.env.VITE_BACKEND_URL;
if (backend) {
  fetch(`${backend}/api/health`, { credentials: 'include' }).catch(() => {});
}
