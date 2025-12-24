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

  // --- Summary: Users card (всего / новые today), reacts to HUM-toggle ---
  let _usersCard = null;

  function renderUsersCard(){
    if (!_usersCard) return;
    const valEl = $('#sum-users');
    const subEl = $('#sum-users-sub');
    if (!valEl || !subEl) return;

    const hum = window.getAdminHumFlag ? !!window.getAdminHumFlag() : true;

    if (_usersCard.mode === 'totals') {
      const total = hum ? _usersCard.totalCluster : _usersCard.totalRaw;
      const today = hum ? _usersCard.todayCluster : _usersCard.todayRaw;
      valEl.textContent = `${fmtInt(total)} / ${fmtInt(today)}`;
      subEl.textContent = 'всего / новые today';
      return;
    }

    // legacy (уникальные по auth за диапазон)
    const picked = hum ? _usersCard.totalCluster : _usersCard.totalRaw;
    valEl.textContent = fmtInt(picked);
    subEl.textContent = `raw: ${fmtInt(_usersCard.totalRaw)} / hum: ${fmtInt(_usersCard.totalCluster)}`;
  }



  // --- Summary: Events card (всего / сегодня), НЕ зависит от HUM-склейки ---
  let _eventsCard = null;

  function renderEventsCard(){
    if (!_eventsCard) return;
    const valEl = $('#sum-events');
    const subEl = $('#sum-events-sub');
    if (!valEl) return;
    const total = _eventsCard.total ?? 0;
    const today = _eventsCard.today ?? 0;
    valEl.textContent = `${fmtInt(total)} / ${fmtInt(today)}`;
    if (subEl) subEl.textContent = 'всего / сегодня';
  }

  // --- Summary: Users mini-sparkline (90 days) ---
  let _usersMiniData = null;
let _usersMiniCtx = null;
let _usersMiniHover = null;
let _usersMiniBound = false;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function ensureUsersMiniInteraction(svg){
  if (_usersMiniBound) return;
  _usersMiniBound = true;

  const tip = $('#users-mini-tip');

  const hide = ()=>{
    try{ _usersMiniHover?.g?.setAttribute('opacity','0'); }catch(_){}
    if (tip) tip.classList.remove('show');
  };

  const showAt = (clientX, clientY)=>{
    const ctx = _usersMiniCtx;
    if (!ctx) return;

    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left;
    if (!Number.isFinite(px)) return;

    const scaleX = ctx.W / Math.max(1, rect.width);
    const xvb = px * scaleX;

    const i = clamp(Math.round((xvb - ctx.pad) / Math.max(1e-6, ctx.step)), 0, ctx.n - 1);
    const xi = ctx.x(i);

    // hover markers
    if (_usersMiniHover?.line && _usersMiniHover?.dot && _usersMiniHover?.g){
      const t = ctx.totals[i] || 0;
      const yy = ctx.topY0 + (1 - (t / ctx.maxTotal)) * ctx.topH;

      _usersMiniHover.line.setAttribute('x1', xi);
      _usersMiniHover.line.setAttribute('x2', xi);
      _usersMiniHover.dot.setAttribute('cx', xi);
      _usersMiniHover.dot.setAttribute('cy', yy);

      _usersMiniHover.g.setAttribute('opacity', '1');
    }

    // tooltip
    if (tip){
      const d = ctx.dates[i] || '';
      const total = ctx.totals[i] || 0;
      const neu = ctx.news[i] || 0;

      tip.innerHTML =
        `<span class="d">${d}</span>` +
        `<div class="row"><span class="k">всего</span><span class="v">${fmtInt(total)}</span></div>` +
        `<div class="row"><span class="k">новые</span><span class="v">${fmtInt(neu)}</span></div>`;

      tip.style.left = (xi / ctx.W * 100) + '%';
      tip.classList.add('show');
    }
  };

  svg.addEventListener('mousemove', (e)=>showAt(e.clientX, e.clientY));
  svg.addEventListener('mouseleave', hide);

  svg.addEventListener('touchstart', (e)=>{
    const t = e.touches && e.touches[0];
    if (t) showAt(t.clientX, t.clientY);
  }, {passive:true});
  svg.addEventListener('touchmove', (e)=>{
    const t = e.touches && e.touches[0];
    if (t) showAt(t.clientX, t.clientY);
  }, {passive:true});
  svg.addEventListener('touchend', hide);
}


  function cssVar(name, fallback){
    try{
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    }catch(_){
      return fallback;
    }
  }

  function drawUsersMini(){
    const svg = $('#users-mini-chart');
    if (!svg) return;

    const data = _usersMiniData;
    const dates = data?.dates || data?.labels || [];
    if (!dates.length){
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      try{ _usersMiniHover?.g?.setAttribute('opacity','0'); }catch(_){ }
      $('#users-mini-tip')?.classList?.remove('show');
      return;
    }

    const hum = window.getAdminHumFlag ? !!window.getAdminHumFlag() : true;

    const totals = hum ? (data.total_cluster || data.totalCluster || []) : (data.total_raw || data.totalRaw || []);
    const news   = hum ? (data.new_cluster   || data.newCluster   || []) : (data.new_raw   || data.newRaw   || []);

    renderUsersSpark(svg, totals, news, dates);

    ensureUsersMiniInteraction(svg);
  }

  function renderUsersSpark(svg, totals, news, dates){
    const NS = 'http://www.w3.org/2000/svg';

    const W = svg.clientWidth  || 176;
    const H = svg.clientHeight || 60;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const pad = 4;
    const split = Math.round(H * 0.62); // верхняя зона: "всего", нижняя: "новые"
    const gap = 6;

    const topY0 = pad;
    const topY1 = Math.max(topY0 + 10, split - gap);
    const botY0 = Math.min(H - pad - 10, split + 2);
    const botY1 = H - pad;

    const topH = Math.max(10, topY1 - topY0);
    const botH = Math.max(8,  botY1 - botY0);

    const n = Math.max(1, totals.length, news.length);
    const step = (n > 1) ? ((W - 2*pad) / (n - 1)) : 0;
    const x = (i) => pad + i * step;

    const safeNums = (arr) => (arr || []).map(v=>Number(v)).map(v=>Number.isFinite(v)?v:0);
    const T = safeNums(totals);
    const N = safeNums(news);

    const maxTotal = Math.max(1, ...T);
    const maxNew   = Math.max(1, ...N);

    const border = cssVar('--border', '#1f2a37');
    const totalColor = cssVar('--accent', '#4dabf7');
    const newColor   = cssVar('--accent2', '#3ddc97');

    // разделитель зон
    const sep = document.createElementNS(NS,'line');
    sep.setAttribute('x1', pad);
    sep.setAttribute('x2', W - pad);
    sep.setAttribute('y1', split);
    sep.setAttribute('y2', split);
    sep.setAttribute('stroke', border);
    sep.setAttribute('stroke-width', '1');
    svg.appendChild(sep);

    // нижние "новые" — тонкие столбики/штрихи
    const barW = Math.max(1, Math.min(4, step * 0.65));
    for (let i=0;i<n;i++){
      const v = N[i] || 0;
      if (v <= 0) continue;

      const h = (v / maxNew) * botH;
      const yTop = botY1 - h;

      const line = document.createElementNS(NS,'line');
      line.setAttribute('x1', x(i));
      line.setAttribute('x2', x(i));
      line.setAttribute('y1', botY1);
      line.setAttribute('y2', yTop);
      line.setAttribute('stroke', newColor);
      line.setAttribute('stroke-width', String(barW));
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
    }

    // верхняя "всего" — линия
    let pts = '';
    for (let i=0;i<n;i++){
      const v = T[i] || 0;
      const yy = topY0 + (1 - (v / maxTotal)) * topH;
      pts += `${x(i).toFixed(2)},${yy.toFixed(2)} `;
    }

    const pl = document.createElementNS(NS,'polyline');
    pl.setAttribute('points', pts.trim());
    pl.setAttribute('fill', 'none');
    pl.setAttribute('stroke', totalColor);
    pl.setAttribute('stroke-width', '2');
    pl.setAttribute('stroke-linejoin', 'round');
    pl.setAttribute('stroke-linecap', 'round');
    svg.appendChild(pl);

// hover markers (tooltip)
const hoverG = document.createElementNS(NS,'g');
hoverG.setAttribute('opacity','0');

const hoverLine = document.createElementNS(NS,'line');
hoverLine.setAttribute('y1', '0');
hoverLine.setAttribute('y2', String(H));
hoverLine.setAttribute('stroke', border);
hoverLine.setAttribute('stroke-width', '1');
hoverLine.setAttribute('stroke-dasharray', '2 3');
hoverG.appendChild(hoverLine);

const hoverDot = document.createElementNS(NS,'circle');
hoverDot.setAttribute('r', '3.2');
hoverDot.setAttribute('fill', totalColor);
hoverDot.setAttribute('stroke', '#0b1220');
hoverDot.setAttribute('stroke-width', '1');
hoverG.appendChild(hoverDot);

svg.appendChild(hoverG);

_usersMiniHover = { g: hoverG, line: hoverLine, dot: hoverDot };

_usersMiniCtx = {
  dates: (dates || []).slice(0, n),
  totals: T,
  news: N,
  maxTotal,
  maxNew,
  W, H,
  pad,
  n,
  step,
  split,
  topY0,
  topH,
  x,
};

  }




  // --- Summary: Events mini-sparkline (90 days), НЕ зависит от HUM-склейки ---
  let _eventsMiniData = null;
  let _eventsMiniCtx = null;
  let _eventsMiniHover = null;
  let _eventsMiniBound = false;

  function ensureEventsMiniInteraction(svg){
    if (_eventsMiniBound) return;
    _eventsMiniBound = true;

    const tip = $('#events-mini-tip');

    const hide = ()=>{
      try{ _eventsMiniHover?.g?.setAttribute('opacity','0'); }catch(_){}
      if (tip) tip.classList.remove('show');
    };

    const showAt = (clientX, clientY)=>{
      const ctx = _eventsMiniCtx;
      if (!ctx) return;

      const rect = svg.getBoundingClientRect();
      const px = clientX - rect.left;
      if (!Number.isFinite(px)) return;

      const scaleX = ctx.W / Math.max(1, rect.width);
      const xvb = px * scaleX;

      const i = clamp(Math.round((xvb - ctx.pad) / Math.max(1e-6, ctx.step)), 0, ctx.n - 1);
      const xi = ctx.x(i);

      // hover markers
      if (_eventsMiniHover?.line && _eventsMiniHover?.dot && _eventsMiniHover?.g){
        const t = ctx.totals[i] || 0;
        const yy = ctx.topY0 + (1 - (t / ctx.maxTotal)) * ctx.topH;

        _eventsMiniHover.line.setAttribute('x1', xi);
        _eventsMiniHover.line.setAttribute('x2', xi);
        _eventsMiniHover.dot.setAttribute('cx', xi);
        _eventsMiniHover.dot.setAttribute('cy', yy);

        _eventsMiniHover.g.setAttribute('opacity', '1');
      }

      // tooltip
      if (tip){
        const d = ctx.dates[i] || '';
        const total = ctx.totals[i] || 0;
        const neu = ctx.news[i] || 0;

        tip.innerHTML =
          `<span class="d">${d}</span>` +
          `<div class="row"><span class="k">всего</span><span class="v">${fmtInt(total)}</span></div>` +
          `<div class="row"><span class="k">за день</span><span class="v">${fmtInt(neu)}</span></div>`;

        tip.style.left = (xi / ctx.W * 100) + '%';
        tip.classList.add('show');
      }
    };

    svg.addEventListener('mousemove', (e)=>showAt(e.clientX, e.clientY));
    svg.addEventListener('mouseleave', hide);

    svg.addEventListener('touchstart', (e)=>{
      const t = e.touches && e.touches[0];
      if (t) showAt(t.clientX, t.clientY);
    }, {passive:true});
    svg.addEventListener('touchmove', (e)=>{
      const t = e.touches && e.touches[0];
      if (t) showAt(t.clientX, t.clientY);
    }, {passive:true});
    svg.addEventListener('touchend', hide);
  }

  function drawEventsMini(){
    const svg = $('#events-mini-chart');
    if (!svg) return;

    const data = _eventsMiniData;
    const dates = data?.dates || data?.labels || [];
    if (!dates.length){
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      try{ _eventsMiniHover?.g?.setAttribute('opacity','0'); }catch(_){ }
      $('#events-mini-tip')?.classList?.remove('show');
      return;
    }

    const totals = (data.total || data.totals || data.total_all || []);
    const news   = (data.new   || data.news   || data.daily     || []);

    renderEventsSpark(svg, totals, news, dates);
    ensureEventsMiniInteraction(svg);
  }

  function renderEventsSpark(svg, totals, news, dates){
    const NS = 'http://www.w3.org/2000/svg';

    const W = svg.clientWidth  || 176;
    const H = svg.clientHeight || 60;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const pad = 4;
    const split = Math.round(H * 0.62); // верхняя зона: "всего", нижняя: "за день"
    const gap = 6;

    const topY0 = pad;
    const topY1 = Math.max(topY0 + 10, split - gap);
    const botY0 = Math.min(H - pad - 10, split + 2);
    const botY1 = H - pad;

    const topH = Math.max(10, topY1 - topY0);
    const botH = Math.max(8,  botY1 - botY0);

    const n = Math.max(1, totals.length, news.length);
    const step = (n > 1) ? ((W - 2*pad) / (n - 1)) : 0;
    const x = (i) => pad + i * step;

    const safeNums = (arr) => (arr || []).map(v=>Number(v)).map(v=>Number.isFinite(v)?v:0);
    const T = safeNums(totals);
    const N = safeNums(news);

    const maxTotal = Math.max(1, ...T);
    const maxNew   = Math.max(1, ...N);

    const border = cssVar('--border', '#1f2a37');
    const totalColor = cssVar('--accent', '#4dabf7');
    const newColor   = cssVar('--accent2', '#3ddc97');

    // разделитель зон
    const sep = document.createElementNS(NS,'line');
    sep.setAttribute('x1', pad);
    sep.setAttribute('x2', W - pad);
    sep.setAttribute('y1', split);
    sep.setAttribute('y2', split);
    sep.setAttribute('stroke', border);
    sep.setAttribute('stroke-width', '1');
    svg.appendChild(sep);

    // нижние "за день" — тонкие столбики/штрихи
    const barW = Math.max(1, Math.min(4, step * 0.65));
    for (let i=0;i<n;i++){
      const v = N[i] || 0;
      if (v <= 0) continue;

      const h = (v / maxNew) * botH;
      const yTop = botY1 - h;

      const line = document.createElementNS(NS,'line');
      line.setAttribute('x1', x(i));
      line.setAttribute('x2', x(i));
      line.setAttribute('y1', botY1);
      line.setAttribute('y2', yTop);
      line.setAttribute('stroke', newColor);
      line.setAttribute('stroke-width', String(barW));
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
    }

    // верхняя "всего" — линия
    let pts = '';
    for (let i=0;i<n;i++){
      const v = T[i] || 0;
      const yy = topY0 + (1 - (v / maxTotal)) * topH;
      pts += `${x(i).toFixed(2)},${yy.toFixed(2)} `;
    }

    const pl = document.createElementNS(NS,'polyline');
    pl.setAttribute('points', pts.trim());
    pl.setAttribute('fill', 'none');
    pl.setAttribute('stroke', totalColor);
    pl.setAttribute('stroke-width', '2');
    pl.setAttribute('stroke-linejoin', 'round');
    pl.setAttribute('stroke-linecap', 'round');
    svg.appendChild(pl);

    // hover markers (tooltip)
    const hoverG = document.createElementNS(NS,'g');
    hoverG.setAttribute('opacity','0');

    const hoverLine = document.createElementNS(NS,'line');
    hoverLine.setAttribute('y1', '0');
    hoverLine.setAttribute('y2', String(H));
    hoverLine.setAttribute('stroke', border);
    hoverLine.setAttribute('stroke-width', '1');
    hoverLine.setAttribute('stroke-dasharray', '2 3');
    hoverG.appendChild(hoverLine);

    const hoverDot = document.createElementNS(NS,'circle');
    hoverDot.setAttribute('r', '3.2');
    hoverDot.setAttribute('fill', totalColor);
    hoverDot.setAttribute('stroke', '#0b1220');
    hoverDot.setAttribute('stroke-width', '1');
    hoverG.appendChild(hoverDot);

    svg.appendChild(hoverG);

    _eventsMiniHover = { g: hoverG, line: hoverLine, dot: hoverDot };

    _eventsMiniCtx = {
      dates: (dates || []).slice(0, n),
      totals: T,
      news: N,
      maxTotal,
      maxNew,
      W, H,
      pad,
      n,
      step,
      split,
      topY0,
      topH,
      x,
    };
  }

    try {
    window.addEventListener('adminHumToggle', ()=>{ renderUsersCard(); drawUsersMini(); });
  } catch (_) {}

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
      // users: всего зарегистрировано / новые сегодня (реагирует на HUM-переключатель)
      const haveTotals = (t.users_total_raw != null) || (t.users_today_raw != null);

      if (haveTotals) {
        _usersCard = {
          mode: 'totals',
          totalRaw: t.users_total_raw ?? 0,
          totalCluster: t.users_total_cluster ?? 0,
          todayRaw: t.users_today_raw ?? 0,
          todayCluster: t.users_today_cluster ?? 0,
        };
        renderUsersCard();
      } else {
        // fallback: старое поведение (уникальные по auth за диапазон)
        const usersRaw = t.users_raw ?? 0;
        const usersCluster = t.users_cluster ?? t.users_hum ?? usersRaw;
        _usersCard = { mode: 'legacy', totalRaw: usersRaw, totalCluster: usersCluster, todayRaw: 0, todayCluster: 0 };
        renderUsersCard();
      }

      // users sparkline 90d (total + new)
      _usersMiniData = sum.users_90d || sum.users90d || sum.users90 || null;
      drawUsersMini();

      // events: всего / сегодня (НЕ зависит от HUM)
      _eventsCard = {
        total: t.events_all ?? sum.events ?? 0,
        today: t.events_today ?? sum.events_today ?? 0,
      };
      renderEventsCard();

      // events sparkline 90d
      _eventsMiniData = sum.events_90d || sum.events90d || sum.events90 || null;
      drawEventsMini();


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
