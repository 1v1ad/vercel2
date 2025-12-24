// admin/admin2.js
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function api(){
    const raw = (window.API || localStorage.getItem('ADMIN_API') || '').toString().trim();
    return raw ? raw.replace(/\/+$/,'') : location.origin;
  }

  function fmtInt(x){
    if (x === null || x === undefined) return '—';
    const n = Number(x);
    if (!Number.isFinite(n)) return String(x);
    return n.toLocaleString('ru-RU');
  }

  function safeJson(x){ try { return JSON.stringify(x); } catch(_) { return String(x); } }

  function fireApiChanged(){
    try{ window.dispatchEvent(new Event('adminApiChanged')); }catch(_){}
  }

  async function jget(path){
    const url = api() + path;
    const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
    const j = await r.json().catch(()=>({ ok:false, error:'bad_json' }));
    if (!r.ok || j.ok === false) throw new Error(j.error || ('http_' + r.status));
    return j;
  }

  async function jpost(path, body){
    const url = api() + path;
    const r = await fetch(url, {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, (window.adminHeaders ? window.adminHeaders() : {})),
      body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(()=>({ ok:false, error:'bad_json' }));
    if (!r.ok || j.ok === false) throw new Error(j.error || ('http_' + r.status));
    return j;
  }

  function setView(name){
    $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.view === name));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    const titleMap = {
      summary: 'Summary',
      finance: 'Финансы',
      users: 'Пользователи',
      duels: 'Дуэли',
      events: 'События',
      topup: 'Ручное пополнение',
      unmerge: 'Расклейка',
    };
    $('#page-title').textContent = titleMap[name] || name;
    if (name === 'summary') fireApiChanged();
  }

  function bindNav(){
    $$('.nav-item').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        const v = a.dataset.view;
        history.replaceState(null,'', '#' + v);
        setView(v);
        // легкая ленивая загрузка
        if (v === 'summary') loadSummary();
        if (v === 'finance') loadFinance();
        if (v === 'users') loadUsers();
        if (v === 'events') loadEvents();
        if (v === 'duels') loadDuels();
      });
    });
  }

  function bindTopbar(){
    const apiEl = $('#api');
    const pwdEl = $('#pwd');

    apiEl.value = (localStorage.getItem('ADMIN_API') || '').toString();
    pwdEl.value = (localStorage.getItem('ADMIN_PWD') || '').toString();

    $('#save').addEventListener('click', ()=>{
      localStorage.setItem('ADMIN_API', apiEl.value.trim());
      localStorage.setItem('ADMIN_PWD', pwdEl.value);
      fireApiChanged();
      // пробуем сразу подтянуть summary, чтобы пользователь видел что всё ок
      loadSummary().catch(()=>{});
    });

    $('#ping').addEventListener('click', async ()=>{
      try{
        const r = await jget('/api/admin/ping');
        $('#stat-admin').textContent = 'OK';
        $('#stat-api').textContent = api();
        console.log('admin ping:', r);
      }catch(e){
        $('#stat-admin').textContent = 'ERR';
        $('#stat-api').textContent = api();
        console.error(e);
        alert('Admin ping error: ' + (e?.message || e));
      }
    });
  }

  // ----- loaders -----

  async function loadSummary(){
    try{
      $('#stat-api').textContent = api();
      $('#stat-admin').textContent = '…';

      const [sum, fin] = await Promise.all([
        jget('/api/admin/summary?days=7'),
        jget('/api/admin/finance'),
      ]);

      $('#stat-admin').textContent = 'OK';

      // summary totals
      const t = sum.totals || {};
      const usersRaw = t.users_raw ?? 0;
      const usersHum = t.users_hum ?? 0;
      $('#sum-users').textContent = fmtInt(t.users_selected ?? usersHum ?? usersRaw);
      $('#sum-users-sub').textContent = `raw: ${fmtInt(usersRaw)} / hum: ${fmtInt(usersHum)}`;

      // events total in range
      $('#sum-events').textContent = fmtInt(t.auth_total ?? 0);

      // finance
      const dep = fin?.totals?.deposited ?? fin?.deposited ?? '0';
      const wdr = fin?.totals?.withdrawn ?? fin?.withdrawn ?? '0';
      const liab = fin?.totals?.liabilities ?? fin?.liabilities ?? '0';
      const turnover = fin?.totals?.turnover ?? fin?.turnover ?? '0';
      const rake = fin?.totals?.rake ?? fin?.rake ?? '0';
      const rakePct = fin?.totals?.rake_pct ?? fin?.rake_pct ?? null;

      $('#sum-deposited').textContent = fmtInt(dep);
      $('#sum-deposited-sub').textContent = `выводы: ${fmtInt(wdr)}`;

      $('#sum-liabilities').textContent = fmtInt(liab);

      $('#sum-turnover').textContent = `${fmtInt(turnover)} / ${fmtInt(rake)}`;
      $('#sum-turnover-sub').textContent = `${fmtInt(fin?.totals?.games ?? fin?.games ?? 0)} игр • рейк ${rakePct ?? '—'}%`;

      // mini tables
      loadMiniEvents().catch(()=>{});
      loadMiniDuels().catch(()=>{});
    }catch(e){
      console.error(e);
      $('#stat-admin').textContent = 'ERR';
    }
  }

  async function loadFinance(){
    try{
      const fin = await jget('/api/admin/finance');
      const dep = fin?.totals?.deposited ?? fin?.deposited ?? '0';
      const wdr = fin?.totals?.withdrawn ?? fin?.withdrawn ?? '0';
      const liab = fin?.totals?.liabilities ?? fin?.liabilities ?? '0';
      const turnover = fin?.totals?.turnover ?? fin?.turnover ?? '0';
      const rake = fin?.totals?.rake ?? fin?.rake ?? '0';
      const rakePct = fin?.totals?.rake_pct ?? fin?.rake_pct ?? null;

      $('#fin-deposited').textContent = fmtInt(dep);
      $('#fin-deposited-sub').textContent = `withdrawn: ${fmtInt(wdr)}`;
      $('#fin-liabilities').textContent = fmtInt(liab);
      $('#fin-turnover').textContent = fmtInt(turnover);
      $('#fin-turnover-sub').textContent = `rake: ${fmtInt(rake)} (${rakePct ?? '—'}%)`;
    }catch(e){
      alert('finance error: ' + (e?.message || e));
    }
  }

  async function loadUsers(){
    const tbody = $('#tbl-users tbody');
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Загрузка…</td></tr>`;
    try{
      const u = await jget('/api/admin/users?limit=50');
      const items = u.items || u.users || [];
      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="6" class="muted">Пусто</td></tr>`;
        return;
      }
      tbody.innerHTML = items.map(it=>{
        const name = [it.first_name, it.last_name].filter(Boolean).join(' ') || '—';
        const vk = it.vk_id || it.provider_user_id || '—';
        return `<tr>
          <td>${it.id}</td>
          <td>${vk}</td>
          <td>${escapeHtml(name)}</td>
          <td class="right">${fmtInt(it.balance ?? 0)}</td>
          <td>${it.hum_id ?? ''}</td>
          <td class="muted">${(it.created_at||'').toString().slice(0,19).replace('T',' ')}</td>
        </tr>`;
      }).join('');
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Ошибка загрузки</td></tr>`;
    }
  }

  async function loadEvents(){
    const tbody = $('#tbl-events tbody');
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Загрузка…</td></tr>`;
    try{
      const r = await jget('/api/admin/events?limit=100');
      const items = r.items || [];
      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="6" class="muted">Пусто</td></tr>`;
        return;
      }
      tbody.innerHTML = items.map(it=>{
        return `<tr>
          <td class="muted">${(it.created_at||'').toString().slice(0,19).replace('T',' ')}</td>
          <td>${escapeHtml(it.event_type || it.type || '—')}</td>
          <td>${it.user_id ?? ''}</td>
          <td>${it.hum_id ?? ''}</td>
          <td class="right">${fmtInt(it.amount ?? 0)}</td>
          <td class="mono">${escapeHtml(shorten(safeJson(it.payload), 180))}</td>
        </tr>`;
      }).join('');
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Ошибка загрузки</td></tr>`;
    }
  }

  async function loadDuels(){
    const tbody = $('#tbl-duels tbody');
    tbody.innerHTML = `<tr><td colspan="9" class="muted">Загрузка…</td></tr>`;
    try{
      // в бэке пока нет отдельного admin/duels эндпойнта; дергаем напрямую публичный /api/duels/history
      const url = api() + '/api/duels/history?limit=50';
      const r = await fetch(url, { credentials: 'include' });
      const j = await r.json().catch(()=>({ ok:false }));
      const items = j.items || [];
      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="9" class="muted">Пусто</td></tr>`;
        return;
      }
      tbody.innerHTML = items.map(it=>{
        const pot = it.pot ?? it.result?.pot ?? '';
        return `<tr>
          <td>${it.id}</td>
          <td>${escapeHtml(it.mode || '—')}</td>
          <td class="right">${fmtInt(it.stake ?? 0)}</td>
          <td>${escapeHtml(it.status || '—')}</td>
          <td class="right">${fmtInt(it.fee_bps ?? '')}</td>
          <td>${it.creator_user_id ?? ''}</td>
          <td>${it.opponent_user_id ?? ''}</td>
          <td>${it.winner_user_id ?? ''}</td>
          <td class="muted">${(it.finished_at||it.updated_at||'').toString().slice(0,19).replace('T',' ')}</td>
        </tr>`;
      }).join('');
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="9" class="muted">Ошибка загрузки</td></tr>`;
    }
  }

  async function loadMiniEvents(){
    const tbody = $('#mini-events tbody');
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Загрузка…</td></tr>`;
    try{
      const r = await jget('/api/admin/events?limit=10');
      const items = r.items || [];
      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="4" class="muted">Пусто</td></tr>`;
        return;
      }
      tbody.innerHTML = items.map(it=>{
        return `<tr>
          <td class="muted">${(it.created_at||'').toString().slice(11,19)}</td>
          <td>${escapeHtml(it.event_type || it.type || '—')}</td>
          <td>${it.user_id ?? ''}</td>
          <td class="right">${fmtInt(it.amount ?? 0)}</td>
        </tr>`;
      }).join('');
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Ошибка</td></tr>`;
    }
  }

  async function loadMiniDuels(){
    const tbody = $('#mini-duels tbody');
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Загрузка…</td></tr>`;
    try{
      const url = api() + '/api/duels/history?limit=10';
      const r = await fetch(url, { credentials: 'include' });
      const j = await r.json().catch(()=>({ ok:false }));
      const items = j.items || [];
      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="5" class="muted">Пусто</td></tr>`;
        return;
      }
      tbody.innerHTML = items.map(it=>{
        const pot = it.pot ?? it.result?.pot ?? '';
        const time = (it.finished_at||it.updated_at||'').toString().slice(11,19);
        return `<tr>
          <td class="muted">${time}</td>
          <td>${it.id}</td>
          <td>${fmtInt(it.stake ?? 0)}</td>
          <td>${escapeHtml(it.status || '—')}</td>
          <td class="right">${fmtInt(pot)}</td>
        </tr>`;
      }).join('');
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Ошибка</td></tr>`;
    }
  }

  function bindActions(){
    $('#refresh-finance')?.addEventListener('click', loadFinance);
    $('#refresh-users')?.addEventListener('click', loadUsers);
    $('#refresh-events')?.addEventListener('click', loadEvents);
    $('#refresh-duels')?.addEventListener('click', loadDuels);
    $('#refresh-events-mini')?.addEventListener('click', loadMiniEvents);
    $('#refresh-duels-mini')?.addEventListener('click', loadMiniDuels);

    $('#topup-btn')?.addEventListener('click', async ()=>{
      const out = $('#topup-out');
      out.textContent = '...';
      try{
        const id = String($('#topup-user').value||'').trim();
        const amount = Number(String($('#topup-amount').value||'').trim());
        const comment = String($('#topup-comment').value||'').trim();
        if (!id || !Number.isFinite(amount)) throw new Error('bad_params');
        const r = await jpost(`/api/admin/users/${encodeURIComponent(id)}/topup`, { amount, comment });
        out.textContent = JSON.stringify(r, null, 2);
        loadSummary().catch(()=>{});
      }catch(e){
        out.textContent = 'ERROR: ' + (e?.message || e);
      }
    });

    $('#unmerge-btn')?.addEventListener('click', async ()=>{
      const out = $('#unmerge-out');
      out.textContent = '...';
      try{
        const hum_id = Number(String($('#unmerge-hum').value||'').trim());
        const raw = String($('#unmerge-users').value||'').trim();
        const reason = String($('#unmerge-reason').value||'').trim();
        const user_ids = raw.split(',').map(s=>Number(s.trim())).filter(n=>Number.isFinite(n) && n>0);
        if (!Number.isFinite(hum_id) || !user_ids.length) throw new Error('bad_params');
        const r = await jpost(`/api/admin/unmerge`, { hum_id, user_ids, reason });
        out.textContent = JSON.stringify(r, null, 2);
      }catch(e){
        out.textContent = 'ERROR: ' + (e?.message || e);
      }
    });
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  function shorten(s, n){
    const str = String(s ?? '');
    return str.length > n ? (str.slice(0, n-1) + '…') : str;
  }

  function init(){
    bindNav();
    bindTopbar();
    bindActions();

    const v = (location.hash || '#summary').slice(1);
    setView(v);
    // initial load
    loadSummary().catch(()=>{});
  }

  document.addEventListener('DOMContentLoaded', init);
})();
