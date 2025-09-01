// admin/chart.js
// Liberal 7‑day charts that accept many payload shapes from /api/admin/daily?days=7
// Works with the existing adminAuth headers/localStorage helpers.
// No external deps except chart.js (already on the page).

(function () {
  const byId = (s) => document.getElementById(s);
  const $apiInput = document.querySelector('input[type="text"], input[name="api"]');

  function readApiBase() {
    const fromWindow = (window.adminApiBase || window.ADMIN_API || '').toString();
    const fromLS = localStorage.getItem('admin_api') || localStorage.getItem('gg_admin_api') || '';
    const fromInput = $apiInput ? $apiInput.value : '';
    const raw = fromWindow || fromLS || fromInput || '';
    return raw.replace(/\/+$/,''); // trim trailing /
  }

  function adminHeaders() {
    // Prefer global helper if present
    if (typeof window.adminHeaders === 'function') return window.adminHeaders();
    // Fallback: read password from localStorage or adjacent input
    const pwd = localStorage.getItem('admin_pwd') || localStorage.getItem('gg_admin_pwd') ||
                (document.querySelector('input[type="password"]')?.value || '');
    const h = new Headers();
    if (pwd) h.set('X-Admin-Password', pwd);
    h.set('Content-Type', 'application/json');
    return h;
  }

  function normalize(payload) {
    // Accept: [], {items:[]}, {data:[]}, {result:[]}, {rows:[]}, {ok:true,items:[]}, etc.
    const arr = Array.isArray(payload) ? payload
      : (payload?.items || payload?.data || payload?.result || payload?.rows || payload?.days || []);

    if (!Array.isArray(arr)) {
      throw new Error('unrecognized payload shape');
    }

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // Map flexible field names to our canonical schema
    return arr.map(x => ({
      date: (x.date || x.day || x.d || x.ts || x.when || '').toString().slice(0, 10),
      visits: num(x.visits ?? x.views ?? x.count ?? x.total ?? x.hits),
      uniques: num(x.uniques ?? x.unique ?? x.uq ?? x.users),
      auths: num(x.auths ?? x.auth ?? x.signins ?? x.logins ?? x.signed_in)
    }));
  }

  async function fetchDaily(days) {
    const API = readApiBase();
    if (!API) return console.warn('[admin/chart] API base is empty');
    const url = `${API}/api/admin/daily?days=${encodeURIComponent(days)}`;
    const res = await fetch(url, { headers: adminHeaders(), credentials: 'omit' });
    const data = await res.json().catch(() => ({}));
    try {
      return normalize(data);
    } catch (e) {
      console.error('daily chart errors:', e);
      console.debug('payload was:', data);
      return [];
    }
  }

  function ensureCanvas() {
    // Try common ids, else create in the analytics card
    let cv = byId('chart-7d') || byId('daily7') || byId('analytics-7d');
    if (!cv) {
      const host = document.querySelector('#analytics, .analytics, .card, main, body');
      cv = document.createElement('canvas');
      cv.id = 'chart-7d';
      cv.style.width = '100%';
      cv.style.height = '260px';
      host && host.appendChild(cv);
    }
    return cv.getContext('2d');
  }

  function renderChart(items) {
    if (!Array.isArray(items) || !items.length) return;
    const ctx = ensureCanvas();
    const labels = items.map(i => (i.date || '').slice(5)); // MM-DD
    const visits = items.map(i => i.visits || 0);
    const auths = items.map(i => i.auths || 0);

    // eslint-disable-next-line no-undef
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Посещения', data: visits, tension: 0.3 },
          { label: 'Авторизации', data: auths, tension: 0.3 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Kick
  fetchDaily(7).then(renderChart).catch(err => {
    console.error('chart boot failed:', err);
  });
})();