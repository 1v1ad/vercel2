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
    // bigint-safe integers (часто приходят как текст из Postgres)
    const s = String(x).trim();
    if (/^-?\d+$/.test(s)){
      try{
        const bi = BigInt(s);
        const sign = bi < 0n ? '-' : '';
        const abs = bi < 0n ? -bi : bi;
        const chars = abs.toString().split('');
        let out = '';
        for (let i = 0; i < chars.length; i++){
          const j = chars.length - i;
          out += chars[i];
          if (j > 1 && (j - 1) % 3 === 0) out += ' ';
        }
        return sign + out;
      }catch(_){}
    }
    const n = Number(s);
    if (!Number.isFinite(n)) return s || '—';
    return n.toLocaleString('ru-RU');
  }

  function fmtPct(x){
    if (x === null || x === undefined) return '—';
    const s = String(x).trim();
    return s ? s.replace('.', ',') : '—';
  }

  
function ymdInTz(tz){
  try{
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const get = (t)=> (parts.find(p=>p.type===t)?.value || '');
    const y = get('year');
    const m = get('month');
    const d = get('day');
    if (y && m && d) return `${y}-${m}-${d}`;
  }catch(_){}
  // fallback: local date
  const dt = new Date();
  const pad = (n)=> (n<10?'0'+n:''+n);
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
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


// finance (all-time + today)
const depAll = fin?.totals?.deposited ?? fin?.deposited ?? '0';
const wdrAll = fin?.totals?.withdrawn ?? fin?.withdrawn ?? '0';
const liab = fin?.totals?.liabilities ?? fin?.liabilities ?? '0';

const duAll = fin?.duels || {};
const turnoverAll = duAll.turnover ?? fin?.totals?.turnover ?? fin?.turnover ?? '0';
const rakeAll = duAll.rake ?? fin?.totals?.rake ?? fin?.rake ?? '0';

// today is calculated in the SAME TZ as backend summary
const tzName = sum?.tz || 'Europe/Moscow';
const today = ymdInTz(tzName);

let finToday = null;
try{
  finToday = await jget(`/api/admin/finance?from=${today}&to=${today}`);
}catch(_){
  finToday = null;
}

const depToday = finToday?.totals?.deposited ?? finToday?.deposited ?? '0';
const wdrToday = finToday?.totals?.withdrawn ?? finToday?.withdrawn ?? '0';

const duToday = finToday?.duels || {};
const turnoverToday = duToday.turnover ?? '0';
const rakeToday = duToday.rake ?? '0';

// Summary cards
$('#sum-deposited-all').textContent = fmtInt(depAll);
$('#sum-deposited-today').textContent = fmtInt(depToday);
$('#sum-withdrawn-all').textContent = fmtInt(wdrAll);
$('#sum-withdrawn-today').textContent = fmtInt(wdrToday);

$('#sum-liabilities').textContent = fmtInt(liab);

$('#sum-turnover-all').textContent = fmtInt(turnoverAll);
$('#sum-turnover-today').textContent = fmtInt(turnoverToday);
$('#sum-rake-all').textContent = fmtInt(rakeAll);
$('#sum-rake-today').textContent = fmtInt(rakeToday);

// --- Summary metric cards: show 2 big values in one row (left/right) ---
try{
  // Deposited / Withdrawn
  const depCard = $('#sum-deposited-all')?.closest('.card');
  const depHint = depCard?.querySelector('.card-sub:not(.secondary)');
  if (depHint) depHint.textContent = 'занесено всего / сегодня • выведено всего / сегодня';

  const wAllEl = $('#sum-withdrawn-all');
  const wTodayEl = $('#sum-withdrawn-today');
  const wRow = wAllEl?.closest('.card-sub');
  if (wRow && wAllEl && wTodayEl){
    wRow.classList.remove('muted','tiny');
    wRow.classList.add('metric-inline-right');
    wRow.textContent = '';
    wRow.append(wAllEl, document.createTextNode(' / '), wTodayEl);
  }

  // Turnover / Rake
  const duCard = $('#sum-turnover-all')?.closest('.card');
  const duHint = duCard?.querySelector('.card-sub:not(.secondary)');
  if (duHint) duHint.textContent = 'оборот всего / сегодня • рейк всего / сегодня';

  const rAllEl = $('#sum-rake-all');
  const rTodayEl = $('#sum-rake-today');
  const rRow = rAllEl?.closest('.card-sub');
  if (rRow && rAllEl && rTodayEl){
    rRow.classList.remove('muted','tiny');
    rRow.classList.add('metric-inline-right','num-rake');
    // make the whole right part red (including the slash)
    rAllEl.classList.remove('num-rake');
    rTodayEl.classList.remove('num-rake');
    rRow.textContent = '';
    rRow.append(rAllEl, document.createTextNode(' / '), rTodayEl);
  }
}catch(_){ /* ignore */ }


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
      const du = fin?.duels || {};
      const turnover = du.turnover ?? fin?.totals?.turnover ?? fin?.turnover ?? '0';
      const rake = du.rake ?? fin?.totals?.rake ?? fin?.rake ?? '0';
      const games = du.games ?? 0;
      const rakePct = du.rake_pct ?? null;

      $('#fin-deposited').textContent = fmtInt(dep);
      $('#fin-deposited-sub').textContent = `withdrawn: ${fmtInt(wdr)}`;
      $('#fin-liabilities').textContent = fmtInt(liab);
      $('#fin-turnover').textContent = fmtInt(turnover);
      $('#fin-rake').textContent = fmtInt(rake);
      $('#fin-turnover-sub').textContent = `${fmtInt(games)} игр • рейк ${fmtPct(rakePct)}%`;
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
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Загрузка…</td></tr>`;
    try{
      const r = await jget('/api/admin/events?take=100');
      const items = r.items || r.events || r.rows || [];
      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="7" class="muted">Пусто</td></tr>`;
        return;
      }

      tbody.innerHTML = items.map(it=>{
        const createdFull = (it.created_at||'').toString().slice(0,19).replace('T',' ');
        const ip = it.ip ?? '';
        const uaFull = it.ua ?? '';
        const uaShort = uaFull ? shorten(uaFull, 64) : '';
        const et = (it.event_type || it.type || '—');

        return `<tr>
          <td>${it.id ?? ''}</td>
          <td>${it.hum_id ?? ''}</td>
          <td>${it.user_id ?? ''}</td>
          <td><span class="etype" title="${escapeHtml(et)}">${escapeHtml(et)}</span></td>
          <td><span class="ip" title="${escapeHtml(ip)}">${escapeHtml(ip)}</span></td>
          <td><span class="ua" title="${escapeHtml(uaFull)}">${escapeHtml(uaShort)}</span></td>
          <td class="muted">${escapeHtml(createdFull)}</td>
        </tr>`;
      }).join('');
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Ошибка загрузки</td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Загрузка…</td></tr>`;
    try{
      // backend отдаёт { events: [...] } и использует параметры take/skip
      const r = await jget('/api/admin/events?take=8');
      const items = r.items || r.events || r.rows || [];

      // Чтобы высота карточки была стабильной — всегда рисуем 8 строк (пустые дополняем).
      const norm = (items || []).slice(0, 8);
      while (norm.length < 8) norm.push(null);

      tbody.innerHTML = norm.map(it=>{
        if (!it){
          return `<tr>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
          </tr>`;
        }

        const createdFull = (it.created_at||'').toString().slice(0,19).replace('T',' ');
        const createdMini = createdFull ? createdFull.slice(5,16) : '';
        const ip = it.ip ?? '';
        const uaFull = it.ua ?? '';
        const uaShort = uaFull ? shorten(uaFull, 42) : '';
        const et = (it.event_type || it.type || '—');

        return `<tr>
          <td>${it.id ?? ''}</td>
          <td>${it.hum_id ?? ''}</td>
          <td>${it.user_id ?? ''}</td>
          <td><span class="etype" title="${escapeHtml(et)}">${escapeHtml(shorten(et, 22))}</span></td>
          <td><span class="ip" title="${escapeHtml(ip)}">${escapeHtml(shorten(ip, 18))}</span></td>
          <td><span class="ua" title="${escapeHtml(uaFull)}">${escapeHtml(uaShort)}</span></td>
          <td class="muted" title="${escapeHtml(createdFull)}">${escapeHtml(createdMini)}</td>
        </tr>`;
      }).join('');
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Ошибка</td></tr>`;
    }
  }

async function loadMiniDuels(){
    const tbody = $('#mini-duels tbody');
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Загрузка…</td></tr>`;

    const playerHtml = (id, avatar, firstName, lastName)=>{
      const uidNum = Number(id||0) || 0;
      const uid = uidNum ? String(uidNum) : '—';
      const fn = (firstName||'').toString().trim();
      const ln = (lastName||'').toString().trim();
      const name = [fn, ln].filter(Boolean).join(' ').trim();
      const title = name ? `${name} (id ${uid})` : (uid !== '—' ? `id ${uid}` : '—');
      const ava = (avatar||'').toString().trim();
      const avaTag = ava
        ? `<img class="mini-ava" src="${escapeHtml(ava)}" alt="" referrerpolicy="no-referrer" />`
        : `<span class="mini-ava" aria-hidden="true"></span>`;
      return `<span class="mini-user" title="${escapeHtml(title)}">${avaTag}<span class="mini-id">${escapeHtml(uid)}</span></span>`;
    };

    try{
      // Важно: /api/duels/history требует user-cookie, а админка живёт на admin-auth заголовках.
      // Поэтому для Summary берём “общую” ленту finished-дуэлей.
      const r = await jget(`/api/duels?status=finished&limit=30&order=newest`);
      let items = (r.items || []).filter(Boolean);

      // Надёжная сортировка по времени завершения (на случай если бэкенд отдаёт по created_at)
      items.sort((a,b)=>{
        const ta = new Date(a.finished_at || a.updated_at || a.created_at || 0).getTime() || 0;
        const tb = new Date(b.finished_at || b.updated_at || b.created_at || 0).getTime() || 0;
        return tb - ta;
      });

      items = items.slice(0, 8);
      const norm = items.slice(0,8);
      while (norm.length < 8) norm.push(null);

      tbody.innerHTML = norm.map(it=>{
        if (!it){
          return `<tr>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="right muted">—</td>
            <td class="muted">—</td>
            <td class="right muted">—</td>
            <td class="right muted">—</td>
          </tr>`;
        }

        const time = (it.finished_at||it.updated_at||it.created_at||'').toString().slice(11,19) || '—';

        const stake = Number(it.stake || 0) || 0;
        const pot = Number(it.pot ?? it.result?.pot ?? (stake*2)) || 0;
        const feeBps = Number(it.fee_bps ?? 0) || 0;
        const rake = Number(it.rake ?? it.result?.rake ?? Math.round(pot * feeBps / 10000)) || 0;

        const left = playerHtml(it.creator_user_id, it.creator_avatar, it.creator_first_name, it.creator_last_name);
        const right = playerHtml(it.opponent_user_id, it.opponent_avatar, it.opponent_first_name, it.opponent_last_name);

        return `<tr>
          <td class="muted">${escapeHtml(time)}</td>
          <td>${left}</td>
          <td class="mini-vs">VS</td>
          <td>${right}</td>
          <td class="right">${fmtInt(stake)}</td>
          <td>${escapeHtml(it.status || '—')}</td>
          <td class="right">${fmtInt(pot)}</td>
          <td class="right num-rake">${fmtInt(rake)}</td>
        </tr>`;
      }).join('');
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="8" class="muted">Ошибка</td></tr>`;
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
