/**
 * lobby-balance-fix.js
 * r5: provider-aware balance/name + robust link buttons (VK/TG)
 * - читает API_BASE из: window.API_BASE -> localStorage.ADMIN_API/admin_api -> <meta name="api-base"> -> дефолт
 * - подтягивает юзера (по внутреннему id, либо по провайдеру+pid) и обновляет DOM
 * - включает кнопки "Связать VK / TG" и открывает start-эндпоинт в новом окне
 */
(function () {
  const TAG = '[LBAL]';

  // ---------- helpers
  function getApiBase() {
    if (typeof window.API_BASE === 'string' && window.API_BASE) return window.API_BASE;
    try {
      const v = localStorage.getItem('ADMIN_API') || localStorage.getItem('admin_api');
      if (v) return v;
    } catch {}
    const mt = document.querySelector('meta[name="api-base"]');
    if (mt?.content) return mt.content;
    return 'https://vercel2pr.onrender.com';
  }
  const API = getApiBase();

  const q = new URLSearchParams(location.search);
  const provider = (q.get('provider') || '').trim().toLowerCase(); // 'tg' | 'vk' | ''
  const rawId = (q.get('id') || '').trim();
  const idNum = /^\d+$/.test(rawId) ? Number(rawId) : NaN;

  function setText(node, txt) { if (node) node.textContent = String(txt); }

  function updateBalanceEverywhere(value) {
    const targets = [
      document.querySelector('[data-balance]'),
      document.getElementById('balance'),
      document.querySelector('.pill .amount'),
      document.querySelector('.balance-value')
    ].filter(Boolean);
    targets.forEach(n => setText(n, value));
    // грубая подстраховка: заменить "₽ 12345" в текстовых нодах
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const rx = '(^|\\s)[₽P]\\s*\\d[\\d\\s]*';
      const reText = new RegExp(rx);
      const reNums = /\d[\d\s]*/;
      const nodes = [];
      while (walker.nextNode()) {
        const t = walker.currentNode;
        if (reText.test(t.nodeValue)) nodes.push(t);
      }
      nodes.forEach(t => t.nodeValue = t.nodeValue.replace(reNums, String(value)));
    } catch {}
  }

  function updateNameAvatar(u) {
    const nameNode = document.querySelector('[data-user-name]')
      || document.querySelector('.user-name')
      || document.querySelector('.hdr-user .name')
      || document.querySelector('.hdr-user [class*="name"]');
    const avatarImg = document.querySelector('[data-user-avatar]')
      || document.querySelector('.user-avatar img')
      || document.querySelector('.avatar img')
      || document.querySelector('.hdr-user img');
    const first = u.first_name || '';
    const last  = u.last_name  || '';
    if (nameNode) nameNode.textContent = (first + (last ? ' ' + last : '')).trim();
    if (avatarImg && u.avatar) avatarImg.src = u.avatar;
  }

  function updateSourceLabel(u) {
    const srcNode = document.querySelector('[data-source]') || document.getElementById('data_source');
    if (srcNode) srcNode.textContent = String(u.provider || provider || '').toUpperCase();
  }

  async function fetchByInternalId() {
    if (!Number.isFinite(idNum)) return null;
    try {
      const r = await fetch(`${API}/api/user/${idNum}`, { credentials: 'include', cache: 'no-store' });
      if (r.ok) return r.json();
    } catch (e) { console.warn(TAG, 'fetchByInternalId', e); }
    return null;
  }
  async function fetchByProvider() {
    if (!provider || !rawId) return null;
    try {
      const pid = encodeURIComponent(rawId);
      const r = await fetch(`${API}/api/user/p/${provider}/${pid}`, { credentials: 'include', cache: 'no-store' });
      if (r.ok) return r.json();
    } catch (e) { console.warn(TAG, 'fetchByProvider', e); }
    return null;
  }
  async function fetchMe() {
    try {
      const r = await fetch(`${API}/api/me`, { credentials: 'include', cache: 'no-store' });
      if (r.ok) return r.json();
    } catch (e) {}
    return null;
  }

  function enable(el) { if (el) { el.hidden = false; el.disabled = false; el.classList.remove('is-disabled'); } }
  function disable(el){ if (el) { el.hidden = true;  el.disabled = true;  el.classList.add('is-disabled'); } }

  function openLink(target) {
    const ret = encodeURIComponent(location.href);
    const urlNew = `${API}/api/profile/link/start?target=${encodeURIComponent(target)}&return=${ret}`;
    // открываем в новом окне; если 404 — фолбэк на старые /api/auth/*
    const w = window.open(urlNew, '_blank', 'noopener,noreferrer');
    if (!w) {
      // popup заблокирован – уходим обычной навигацией
      location.href = urlNew;
    }
  }

  function wireLinkButtons(userOrNull) {
    const btnVK = document.getElementById('btnLinkVK') || document.querySelector('[data-link-vk]');
    const btnTG = document.getElementById('btnLinkTG') || document.querySelector('[data-link-tg]');

    // определяем, что уже привязано
    const u = userOrNull || {};
    const hasVK = !!(u.vk_id || (u.user && u.user.vk_id));
    const hasTG = !!(u.tg_id || (u.user && u.user.tg_id));

    // показываем нужную кнопку:
    // - если вошёл через TG, предлагаем привязать VK (если ещё нет)
    // - если вошёл через VK, предлагаем привязать TG (если ещё нет)
    if (provider === 'tg') {
      if (!hasVK && btnVK) enable(btnVK);
      if (btnTG) disable(btnTG);
    } else if (provider === 'vk') {
      if (!hasTG && btnTG) enable(btnTG);
      if (btnVK) disable(btnVK);
    } else {
      // неизвестный провайдер — показываем обе, если отсутствуют
      if (!hasVK && btnVK) enable(btnVK);
      if (!hasTG && btnTG) enable(btnTG);
    }

    if (btnVK) {
      btnVK.addEventListener('click', (e) => { e.preventDefault(); openLink('vk'); }, { once: false });
    }
    if (btnTG) {
      btnTG.addEventListener('click', (e) => { e.preventDefault(); openLink('tg'); }, { once: false });
    }
  }

  async function run() {
    try {
      // 1) баланс/имя/источник
      let data = await fetchByInternalId();
      if (!data || data.ok === false) data = await fetchByProvider();
      if (!data || data.ok === false) {
        console.warn(TAG, 'no user data');
      } else {
        const u = data.user || data;
        if (typeof u.balance === 'number') updateBalanceEverywhere(u.balance);
        updateNameAvatar(u);
        updateSourceLabel(u);
      }

      // 2) включение кнопок "Связать …"
      const me = await fetchMe(); // ок, если 401 — просто тихо игнорируем
      wireLinkButtons(me?.user || me);

    } catch (e) {
      console.warn(TAG, e);
    }
  }

  // DOM-ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
