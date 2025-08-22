// Admin UI logic with FlagCDN flags
(() => {
  const $ = (id) => document.getElementById(id);

  const DEFAULT_BACKEND = "https://vercel2pr.onrender.com"; // поменяй при необходимости

  // State
  const state = {
    backend: localStorage.getItem('admin.backend') || DEFAULT_BACKEND,
    pwd: localStorage.getItem('admin.pwd') || '',
    user: { skip: 0, take: 25, total: 0, search: '' },
    ev: {
      skip: 0, take: 40, total: 0,
      types: [], users: [], countries: [], days: []
    },
    chart: null,
  };

  function applyStateToUI() {
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
    $('kpiUsers').textContent = s.users ?? '–';
    $('kpiEvents').textContent = s.events ?? '–';
    $('kpiAuth7').textContent = s.auth_7d ?? '–';
    $('kpiUniq7').textContent = s.uniq_7d ?? '–';

    const labels = (s.chart || []).map(r => r.date);
    const auth   = (s.chart || []).map(r => r.auth);
    const uniq   = (s.chart || []).map(r => r.uniq);

    if (state.chart) state.chart.destroy();
    const ctx = document.getElementById('chart').getContext('2d');
    state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Авторизаций', data: auth, tension: .35, borderWidth: 2, pointRadius: 0 },
          { label: 'Уникальные', data: uniq, tension: .35, borderWidth: 2, pointRadius: 0 },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: { x: { grid: { display:false }}, y: { grid: { color:'rgba(255,255,255,.06)' }} }
      }
    });
  }

  async function ping() {
    try {
      const r = await fetch(state.backend.replace(/\/$/,'') + '/health');
      $('apiState').className = r.ok ? 'dot ok' : 'dot bad';
    } catch {
      $('apiState').className = 'dot bad';
    }
  }

  // Users table (заглушка под будущий эндпоинт)
  async function refreshUsers() {
    // Если позже добавим /api/admin/users — сюда воткнём
    const tb = document.querySelector('#usersTable tbody');
    tb.innerHTML = '';
  }

  // Events table (заглушка под будущий эндпоинт)
  async function refreshEvents() {}

  // Bindings
  $('saveBtn').onclick = () => { saveCreds(); ping(); };
  $('healthBtn').onclick = () => { refreshSummary().catch(e => alert(e.message)); };

  // Init
  applyStateToUI();
  ping();
  // refreshSummary(); // можно включить автозагрузку
})();
