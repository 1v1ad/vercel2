/* VK OpenAPI login helper (no direct calls to login.vk.com)
   Usage:
     import { attachVkLogin } from './lib/vkAuth';
     attachVkLogin('#vk-auth', { appId: Number(import.meta.env.VITE_VK_APP_ID || '54008517'),
                                 backendUrl: import.meta.env.VITE_BACKEND_URL });
*/
import { loadScript } from './loadScript';

declare global {
  interface Window { VK: any }
}

let inited = false;
async function ensureVk(appId: number) {
  if (!window.VK) {
    await loadScript('https://vk.com/js/api/openapi.js?176');
  }
  if (!inited) {
    window.VK.init({ apiId: appId });
    inited = true;
  }
}

export async function vkLogin(appId: number, backendUrl: string): Promise<boolean> {
  await ensureVk(appId);
  return new Promise<boolean>((resolve) => {
    window.VK.Auth.login(async (response: any) => {
      if (!response || !response.session) {
        resolve(false);
        return;
      }
      const mid = response.session.mid;
      try {
        await fetch(`${backendUrl}/api/log-auth`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: mid,
            action: 'vk_login',
            timestamp: Date.now(),
            userData: { provider: 'vk', id: mid }
          })
        });
        resolve(true);
      } catch (e) {
        console.error('log-auth failed', e);
        resolve(false);
      }
    }, 0);
  });
}

export function attachVkLogin(selector: string, opts: { appId: number, backendUrl: string }) {
  const btn = document.querySelector<HTMLButtonElement>(selector);
  if (!btn) return;
  btn.addEventListener('click', () => {
    vkLogin(opts.appId, opts.backendUrl);
  });
}
