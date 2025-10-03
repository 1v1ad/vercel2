/*! gg-linker.js v2 — auto-link VK/TG accounts by device_id with explicit API base + logging */
(function () {
  const LS_KEY = 'gg_device_id';
  const COOKIE_NAME = 'device_id';
  const RETRY_DELAY = 1500;

  function trimApiBase(value) {
    return String(value).trim().replace(/\/+$/, '');
  }

  function getApiBase() {
    try {
      const ls = localStorage.getItem('api_base');
      if (ls && typeof ls === 'string' && ls.trim()) return trimApiBase(ls);
    } catch (_) {}
    if (typeof window !== 'undefined' && window.API_BASE) {
      try { return trimApiBase(window.API_BASE); } catch (_) {}
    }
    return '';
  }

  function uuid() {
    try { return crypto.randomUUID(); } catch (_) {
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  function getDeviceId() {
    let did = null;
    try { did = localStorage.getItem(LS_KEY); } catch (_) {}
    if (!did) {
      did = uuid();
      try { localStorage.setItem(LS_KEY, did); } catch (_) {}
    }
    try {
      const oneYear = 365 * 24 * 3600;
      document.cookie = COOKIE_NAME + '=' + encodeURIComponent(did) + '; path=/; max-age=' + oneYear + '; SameSite=Lax';
    } catch (_) {}
    return did;
  }

  async function fetchMe(apiBase) {
    const url = (apiBase ? apiBase : '') + '/api/me';
    try {
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) {
      return null;
    }
  }

  function detectProvider(me) {
    const vk = String(me?.user?.vk_id ?? '');
    if (!vk) return null;
    if (vk.startsWith('tg:')) return { provider: 'tg', id: vk.slice(3) };
    return { provider: 'vk', id: vk };
  }

  async function postLink(apiBase, payload) {
    const url = (apiBase ? apiBase : '') + '/api/link/background';
    console.log('[gg-linker] POST /api/link/background', payload);
    try {
      const r = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let body;
      try {
        body = await r.clone().json();
      } catch (_) {
        try { body = await r.text(); } catch (_) { body = null; }
      }
      console.log('[gg-linker] response', r.status, body);
      return r.ok;
    } catch (e) {
      console.warn('[gg-linker] POST failed', e);
      return false;
    }
  }

  async function linkBackground({ retry } = {}) {
    const apiBase = getApiBase();
    const me = await fetchMe(apiBase);
    if (!me || !me.user) return;

    const info = detectProvider(me);
    if (!info) return;

    const device_id = getDeviceId();
    const payload = { provider: info.provider, provider_user_id: info.id, username: null, device_id };
    const ok = await postLink(apiBase, payload);
    if (!ok && !retry) {
      setTimeout(() => linkBackground({ retry: true }), RETRY_DELAY);
    }
  }

  function patchLoginLinks() {
    const did = getDeviceId();
    const anchors = Array.from(document.querySelectorAll("a[href*='/api/auth/vk']"));
    anchors.forEach((a) => {
      try {
        const href = a.getAttribute('href');
        const url = new URL(href, location.href);
        if (!url.searchParams.has('device_id')) {
          url.searchParams.set('device_id', did);
          a.setAttribute('href', url.toString());
          console.log('[gg-linker] patched VK href', a.getAttribute('href'));
        }
      } catch (_) {}
    });
  }

  function init() {
    const apiBase = getApiBase();
    const deviceId = getDeviceId();
    console.log('[gg-linker] init api_base=' + (apiBase || '(relative)') + ', device_id=' + deviceId);
    patchLoginLinks();
    const launch = () => setTimeout(() => linkBackground(), 300);
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      launch();
    } else {
      document.addEventListener('DOMContentLoaded', launch, { once: true });
    }
  }

  init();
})();
