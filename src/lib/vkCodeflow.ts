// src/lib/vkCodeflow.ts — минимальный клиент для VK OAuth code flow
export function startVkLogin(nextPath: string = '/') {
  const backend = import.meta.env.VITE_BACKEND_URL || '';
  if (!backend) {
    console.error('[vkCodeflow] VITE_BACKEND_URL is empty');
    return;
  }
  const origin = window.location.origin;
  const next = nextPath.startsWith('http') ? nextPath : origin + nextPath;
  window.location.href = `${backend}/api/auth/vk/login?next=${encodeURIComponent(next)}`;
}
