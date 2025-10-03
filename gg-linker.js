
/*! gg-linker.js — auto-link VK/TG accounts by device_id (for static sites) */
(function () {
  const LS_KEY = 'gg_device_id';
  const COOKIE_NAME = 'device_id';

  function uuid() {
    try { return crypto.randomUUID(); } catch (_) {
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }
  function getDeviceId() {
    let did = null;
    try { did = localStorage.getItem(LS_KEY); } catch(_) {}
    if (!did) {
      did = uuid();
      try { localStorage.setItem(LS_KEY, did); } catch(_) {}
    }
    try {
      const oneYear = 365 * 24 * 3600;
      document.cookie = COOKIE_NAME + "=" + encodeURIComponent(did) + "; path=/; max-age=" + oneYear + "; samesite=lax";
    } catch(_) {}
    return did;
  }
  async function fetchMe() {
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  }
  function detectProvider(me) {
    const vk = String(me?.user?.vk_id ?? '');
    if (!vk) return null;
    if (vk.startsWith('tg:')) return { provider: 'tg', id: vk.slice(3) };
    return { provider: 'vk', id: vk };
  }
  async function linkBackground() {
    const me = await fetchMe();
    if (!me || !me.user) return;
    const info = detectProvider(me);
    if (!info) return;
    const device_id = getDeviceId();
    try {
      await fetch("/api/link/background", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: info.provider,
          provider_user_id: info.id,
          username: null,
          device_id
        })
      });
    } catch (_) {}
  }
  // ensure VK login links carry device_id
  function patchLoginLinks() {
    const did = getDeviceId();
    const anchors = Array.from(document.querySelectorAll("a[href*='/api/auth/vk']"));
    anchors.forEach(a => {
      try {
        const url = new URL(a.getAttribute("href"), location.origin);
        if (!url.searchParams.has("device_id")) {
          url.searchParams.set("device_id", did);
          a.setAttribute("href", url.toString());
        }
      } catch(_) {}
    });
  }
  // small API for manual run
  window.GG = Object.assign(window.GG || {}, { getDeviceId, linkAccountsNow: linkBackground });
  // boot
  patchLoginLinks();
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(linkBackground, 300);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(linkBackground, 300));
  }
})();
