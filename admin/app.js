// Admin UI logic with FlagCDN flags
(() => {
  const $ = (id) => document.getElementById(id);

  const DEFAULT_BACKEND = "https://vercel2pr.onrender.com"; // поменяй при необходимости

  // State
  const state = {
    backend: localStorage.getItem('admin.backend') || DEFAULT_BACKEND,
    pwd: localStorage.getItem('admin.pwd') || '',
    user: { skip: 0, take: 25, total: 0, search: '' },
    ev: { skip: 0, take: 50, total: 0, type: '', user: '' },
    chart: null
  };

  // Init
  function loadCreds() {
    $('backendUrl').value = state.backend;
    $('adminPwd').value = state.pwd;
  }
  function saveCreds() {
    state.backend = $('backendUrl').value.trim();
    state.pwd = $('adminPwd').value;
    localStorage.setItem('admin.backend', state.backend);
    localStorage.setItem('admin.pwd', state.pwd);
  }

  async function call(path, params={}) {
    const url = state.backend.replace(/\/$/, '') + path;
    const headers = { 'X-Admin-Password': state.pwd };
    let r;
    if (params.method === 'POST') {
      headers['Content-Type'] = 'application/json';
      r = await fetch(url, { method: 'POST', body: JSON.stringify(params.body || {}), headers });
    } else {
      r = await fetch(url, { headers });
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }

  // KPIs + Summary
  async function refreshSummary() {
    const s = await call('/api/admin/summary');
    $('kpiUsers').textContent = s.users ?? '0';
    const total = Object.values(s.eventsByType || {}).reduce((a,b)=>a+b,0);
    $('kpiEvents').textContent = total;

    const info = await aggregateAuthLast7d();
    $('kpiAuth7d').textContent = info.totalAuth;
    $('kpiUnique7d').textContent = info.uniqueUsers;
    drawWeeklyChart(info.byWeekday, info.uniqueByWeekday);
  }

  async function aggregateAuthLast7d() {
    const pageSize = 200;
    let skip = 0;
    let all = [];
    let total = 0;
    let first = await call(`/api/admin/events?type=auth_success&take=1&skip=0`);
    total = first.total || 0;
    const limit = Math.min(total, 5000);
    while (skip < limit) {
      const take = Math.min(pageSize, limit - skip);
      const batch = await call(`/api/admin/events?type=auth_success&take=${take}&skip=${skip}`);
      all = all.concat(batch.items || []);
      skip += take;
      if ((batch.items || []).length < take) break;
    }
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7*24*60*60*1000);
    const recent = all.filter(e => new Date(e.created_at) >= sevenDaysAgo);

    const byWeekday = [0,0,0,0,0,0,0];       // Sun..Sat
    const uniqueByWeekday = [0,0,0,0,0,0,0];
    const seenPerDay = [new Set(),new Set(),new Set(),new Set(),new Set(),new Set(),new Set()];
    for (const e of recent) {
      const d = new Date(e.created_at).getDay();
      byWeekday[d] += 1;
      if (e.user_id && !seenPerDay[d].has(e.user_id)) {
        seenPerDay[d].add(e.user_id);
      }
    }
    for (let i=0;i<7;i++) uniqueByWeekday[i] = seenPerDay[i].size;

    const uniqueUsers = new Set(recent.map(e => e.user_id).filter(Boolean)).size;
    return { totalAuth: recent.length, uniqueUsers, byWeekday, uniqueByWeekday };
  }

  function drawWeeklyChart(by, uniqueBy) {
    const ctx = document.getElementById('weeklyChart');
    const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    if (state.chart) { state.chart.destroy(); }
    state.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Авторизации', data: by },
          { label: 'Уникальные', data: uniqueBy }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });
    ctx.parentElement.style.height = '320px';
  }

  // Users table
  async function loadUsers() {
    const q = new URLSearchParams({ take: state.user.take, skip: state.user.skip });
    if (state.user.search) q.set('search', state.user.search);
    const data = await call('/api/admin/users?' + q.toString());
    state.user.total = data.total || 0;
    $('userInfo').textContent = `Записей: ${data.total} · показано ${data.items.length} · skip=${state.user.skip}`;
    const tbody = $('userRows'); tbody.innerHTML = '';
    for (const u of data.items) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.id}</td>
                      <td>${u.vk_id ?? ''}</td>
                      <td>${escapeHtml(u.first_name ?? '')}</td>
                      <td>${escapeHtml(u.last_name ?? '')}</td>
                      <td>${u.balance ?? 0}</td>
                      <td title="${u.country_code || ''}">${flagFromCC(u.country_code)} ${u.country_name || u.country_code || ''}</td>
                      <td>${fmtDate(u.created_at)}</td>`;
      tbody.appendChild(tr);
    }
  }

  // Events table
  async function loadEvents() {
    const q = new URLSearchParams({ take: state.ev.take, skip: state.ev.skip });
    if (state.ev.type) q.set('type', state.ev.type);
    if (state.ev.user) q.set('user_id', state.ev.user);
    const data = await call('/api/admin/events?' + q.toString());
    state.ev.total = data.total || 0;
    $('eventInfo').textContent = `Записей: ${data.total} · показано ${data.items.length} · skip=${state.ev.skip}`;
    const tbody = $('eventRows'); tbody.innerHTML = '';
    for (const e of data.items) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${e.id}</td>
                      <td>${e.user_id ?? ''}</td>
                      <td>${escapeHtml(e.type)}</td>
                      <td>${e.ip ?? ''}</td>
                      <td title="${escapeHtml(e.ua ?? '')}">${ellipsize(e.ua ?? '', 48)}</td>
                      <td>${fmtDate(e.created_at)}</td>`;
      tbody.appendChild(tr);
    }
  }

  // Helpers
  function flagFromCC(cc) {
    if (!cc || cc.length !== 2) return '';
    const code = cc.toLowerCase();
    return `<img class="flag" src="https://flagcdn.com/24x18/${code}.png" alt="${cc}" width="18" height="13" loading="lazy">`;
  }
  function fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleString();
  }
  function escapeHtml(s) { return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function ellipsize(s, n) { return s.length > n ? s.slice(0, n-1)+'…' : s; }

  // Events wiring
  $('saveBtn').addEventListener('click', async () => { saveCreds(); await init(); });
  $('healthBtn').addEventListener('click', async () => {
    try { await call('/api/admin/health'); alert('OK'); } catch (e) { alert('Ошибка: ' + e.message); }
  });

  $('userReload').addEventListener('click', async () => { state.user.skip = 0; state.user.search = $('userSearch').value.trim(); await loadUsers(); });
  $('userPrev').addEventListener('click', async () => { state.user.skip = Math.max(0, state.user.skip - state.user.take); await loadUsers(); });
  $('userNext').addEventListener('click', async () => { if (state.user.skip + state.user.take < state.user.total) state.user.skip += state.user.take; await loadUsers(); });

  $('eventReload').addEventListener('click', async () => { state.ev.skip = 0; state.ev.type = $('eventType').value.trim(); state.ev.user = $('eventUserId').value.trim(); await loadEvents(); });
  $('eventPrev').addEventListener('click', async () => { state.ev.skip = Math.max(0, state.ev.skip - state.ev.take); await loadEvents(); });
  $('eventNext').addEventListener('click', async () => { if (state.ev.skip + state.ev.take < state.ev.total) state.ev.skip += state.ev.take; await loadEvents(); });

  async function init() {
    loadCreds();
    await refreshSummary();
    await loadUsers();
    await loadEvents();
  }

  // boot
  loadCreds();
  init();
})();