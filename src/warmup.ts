const BACKEND = import.meta.env.VITE_BACKEND_URL;

async function warmUp() {
  if (!BACKEND) return;
  const url = `${BACKEND}/api/health`;
  for (let i = 0; i < 3; i++) {
    try {
      await fetch(url, { method: 'GET', keepalive: true, cache: 'no-store' });
      break;
    } catch {
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}
warmUp();
export {};
