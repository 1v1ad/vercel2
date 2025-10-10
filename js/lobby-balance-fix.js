/**
 * Lobby balance & identity fix for provider-specific view.
 * - Resolves API_BASE robustly (Netlify front + Render back).
 * - Fetches exact user by id: GET {API_BASE}/api/user/:id
 * - Updates balance, name, avatar, provider label.
 * - Makes "link accounts" buttons clickable if present.
 */
(function (){
  function getApiBase(){
    if (typeof window.API_BASE === 'string' && window.API_BASE) return window.API_BASE;
    try { const v = localStorage.getItem('admin_api'); if (v) return v; } catch {}
    const mt = document.querySelector('meta[name="api-base"]'); if (mt?.content) return mt.content;
    return 'https://vercel2pr.onrender.com';
  }
  const API = getApiBase();

  function qs(){
    const q = new URLSearchParams(location.search);
    return Object.fromEntries(q.entries());
  }
  const q = qs();
  const provider = (q.provider || '').trim();
  const rawId = (q.id || '').trim();
  const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN;

  const balanceNode = document.querySelector('[data-balance]') || document.getElementById('balance') || document.querySelector('.balance-value');
  const srcNode = document.querySelector('[data-source]') || document.getElementById('data_source');
  const nameNode = document.querySelector('[data-user-name]') || document.querySelector('.user-name');
  const avatarNode = document.querySelector('[data-user-avatar]') || document.querySelector('.user-avatar, .avatar img');

  async function updateById(){
    if (!Number.isFinite(id)) return;
    try {
      const res = await fetch(`${API}/api/user/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || data.ok === false) return;
      const u = data.user || data;

      if (u && typeof u.balance === 'number' && balanceNode) {
        balanceNode.textContent = String(u.balance);
      }
      if (srcNode && (u.provider || provider)) {
        srcNode.textContent = String(u.provider || provider).toUpperCase();
      }
      const first = u.first_name || '';
      const last = u.last_name || '';
      if (nameNode && (first || last)) {
        nameNode.textContent = (first + (last? ' ' + last : '')).trim();
      }
      if (avatarNode && u.avatar) {
        if (avatarNode.tagName && avatarNode.tagName.toLowerCase() === 'img') {
          avatarNode.src = u.avatar;
        } else if (avatarNode.querySelector) {
          const img = avatarNode.querySelector('img');
          if (img) img.src = u.avatar;
        }
      }
    } catch (e) {
      console.warn('lobby-balance-fix error:', e);
    }
  }

  function wireLinkers(){
    const btnVK = document.getElementById('btnLinkVK') || document.querySelector('[data-link-vk]');
    const btnTG = document.getElementById('btnLinkTG') || document.querySelector('[data-link-tg]');
    const open = (url) => { try{ location.href = url; }catch{ window.open(url, '_self'); } };

    if (btnVK) btnVK.addEventListener('click', (e) => {
      e.preventDefault();
      open(`${API}/api/profile/link/start?vk=1`);
    });
    if (btnTG) btnTG.addEventListener('click', (e) => {
      e.preventDefault();
      open(`${API}/api/profile/link/start?tg=1`);
    });
  }

  wireLinkers();
  updateById();
})();
