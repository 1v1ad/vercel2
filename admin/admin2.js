// admin/admin2.js
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    function toInt(x, def=0){
    const s = (x === null || x === undefined) ? '' : String(x).trim();
    if (!s) return def;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : def;
  }

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

function ymdShift(ymd, deltaDays){
  try{
    const dt = new Date(String(ymd).slice(0,10) + 'T00:00:00Z');
    if (Number.isFinite(deltaDays)) dt.setUTCDate(dt.getUTCDate() + deltaDays);
    const pad = (n)=> (n<10?'0'+n:''+n);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
  }catch(_){
    return String(ymd || '').slice(0,10);
  }
}

function toBigIntSafe(x){
  try{
    if (typeof x === 'bigint') return x;
    if (x === null || x === undefined) return 0n;
    const s = String(x).replace(/[^0-9\-]/g,'');
    if (!s || s === '-' ) return 0n;
    return BigInt(s);
  }catch(_){
    return 0n;
  }
}

// Apply green/red to an element based on today vs yesterday.
// reverse=true means "lower is better" (e.g. withdrawals)
function applyTrend(el, today, yesterday, opts){
  if (!el) return;
  el.classList.remove('trend-up','trend-down');
  const t = toBigIntSafe(today);
  const y = toBigIntSafe(yesterday);
  const reverse = !!(opts && opts.reverse);
  const strict = !!(opts && opts.strict);
  const up = reverse ? (strict ? (t < y) : (t <= y)) : (strict ? (t > y) : (t >= y));
  el.classList.add(up ? 'trend-up' : 'trend-down');
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

  
  function updateUsersNavSubActive(){
    const isUsers = document.querySelector('.nav-item[data-view="users"]')?.classList.contains('active');
    document.querySelectorAll('.nav-sub-item[data-users-sub]').forEach(a=>{
      const sub = (a.getAttribute('data-users-sub') || '').toString();
      a.classList.toggle('active', !!isUsers && sub === (_usersSub || 'list'));
    });
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
    if (name === 'topup') {
      // lazy-load history (old admin topup.html behavior)
      _topupRawList = null;
        loadTopupHistory(true).catch(()=>{});
    }
    updateUsersNavSubActive();
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
      const yesterday = hum ? (_usersCard.yesterdayCluster ?? 0) : (_usersCard.yesterdayRaw ?? 0);

      // render with colored "today"
      valEl.textContent = '';
      const left = document.createTextNode(`${fmtInt(total)} / `);
      const right = document.createElement('span');
      right.textContent = fmtInt(today);
      applyTrend(right, today, yesterday, { reverse:false, strict:true });
      valEl.append(left, right);

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
    const yesterday = _eventsCard.yesterday ?? 0;

    valEl.textContent = '';
    const left = document.createTextNode(`${fmtInt(total)} / `);
    const right = document.createElement('span');
    right.textContent = fmtInt(today);
    applyTrend(right, today, yesterday, { reverse:false });
    valEl.append(left, right);

    if (subEl) subEl.textContent = 'всего / сегодня';
  }

  // --- Summary: Users mini-sparkline (90 days) ---
  let _usersMiniData = null;
let _usersMiniCtx = null;
let _usersMiniHover = null;
let _usersMiniBound = false;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

// Mini-spark tooltip is rendered in <body> (position:fixed) so it won't be clipped
// by transformed cards / sticky bars.
function ensureSparkTipOnBody(tip){
  try{
    if (!tip) return;
    if (tip.parentElement !== document.body){
      document.body.appendChild(tip);
    }
  }catch(_){ }
}

function placeSparkTip(tip, xClient, yClient){
  if (!tip) return;
  ensureSparkTipOnBody(tip);

  // initial
  tip.style.left = `${xClient}px`;
  tip.style.top  = `${yClient}px`;

  // clamp into viewport (keeps tooltip visible while still being "above" the dot)
  const pad = 8;
  const r = tip.getBoundingClientRect();
  let x = xClient;
  let y = yClient;
  if (r.left < pad) x += (pad - r.left);
  if (r.right > window.innerWidth - pad) x -= (r.right - (window.innerWidth - pad));
  if (r.top < pad) y += (pad - r.top);
  if (r.bottom > window.innerHeight - pad) y -= (r.bottom - (window.innerHeight - pad));

  tip.style.left = `${x}px`;
  tip.style.top  = `${y}px`;
}

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

    const t = ctx.totals[i] || 0;
    const denom = (ctx.maxTotal || 1);
    const yy = ctx.topY0 + (1 - (t / denom)) * ctx.topH;

    // hover markers
    if (_usersMiniHover?.line && _usersMiniHover?.dot && _usersMiniHover?.g){

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

      tip.classList.add('show');
      const xClient = rect.left + (xi / ctx.W) * rect.width;
      const yClient = rect.top  + (yy / ctx.H) * rect.height;
      placeSparkTip(tip, xClient, yClient);
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

      const t = ctx.totals[i] || 0;
      const denom = (ctx.maxTotal || 1);
      const yy = ctx.topY0 + (1 - (t / denom)) * ctx.topH;

      // hover markers
      if (_eventsMiniHover?.line && _eventsMiniHover?.dot && _eventsMiniHover?.g){
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

        tip.classList.add('show');
        const xClient = rect.left + (xi / ctx.W) * rect.width;
        const yClient = rect.top  + (yy / ctx.H) * rect.height;
        placeSparkTip(tip, xClient, yClient);
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


  // --- Summary: Liabilities mini-bars (90 days), НЕ зависит от HUM-склейки ---
  let _liabMiniData = null;
  let _liabMiniCtx = null;
  let _liabMiniHover = null;
  let _liabMiniBound = false;

  function ensureLiabMiniInteraction(svg){
    if (_liabMiniBound) return;
    _liabMiniBound = true;

    const tip = $('#liab-mini-tip');

    const hide = ()=>{
      try{ _liabMiniHover?.g?.setAttribute('opacity','0'); }catch(_){ }
      if (tip) tip.classList.remove('show');
    };

    const showAt = (clientX, clientY)=>{
      const ctx = _liabMiniCtx;
      if (!ctx) return;

      const rect = svg.getBoundingClientRect();
      const px = clientX - rect.left;
      if (!Number.isFinite(px)) return;

      const scaleX = ctx.W / Math.max(1, rect.width);
      const xvb = px * scaleX;

      const i = clamp(Math.round((xvb - ctx.pad) / Math.max(1e-6, ctx.step)), 0, ctx.n - 1);
      const xi = ctx.x(i);

      const v = ctx.values[i] || 0;
      const yy = ctx.y(v);

      // hover markers
      if (_liabMiniHover?.line && _liabMiniHover?.dot && _liabMiniHover?.g){

        _liabMiniHover.line.setAttribute('x1', xi);
        _liabMiniHover.line.setAttribute('x2', xi);
        _liabMiniHover.dot.setAttribute('cx', xi);
        _liabMiniHover.dot.setAttribute('cy', yy);
        _liabMiniHover.g.setAttribute('opacity','1');
      }

      // tooltip
      if (tip){
        const d = ctx.dates[i] || '';
        const vRaw = ctx.raw[i] ?? '0';
        tip.innerHTML =
          `<span class="d">${d}</span>` +
          `<div class="row"><span class="k">на балансах</span><span class="v">${fmtInt(vRaw)}</span></div>`;

        tip.classList.add('show');
        const xClient = rect.left + (xi / ctx.W) * rect.width;
        const yClient = rect.top  + (yy / ctx.H) * rect.height;
        placeSparkTip(tip, xClient, yClient);
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

  function drawLiabMini(){
    const svg = $('#liab-mini-chart');
    if (!svg) return;

    const data = _liabMiniData;
    const dates = data?.dates || data?.labels || [];
    const raw = data?.balances || data?.values || data?.v || [];

    if (!dates.length || !raw.length){
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      try{ _liabMiniHover?.g?.setAttribute('opacity','0'); }catch(_){ }
      $('#liab-mini-tip')?.classList?.remove('show');
      return;
    }

    renderLiabBars(svg, raw, dates);
    ensureLiabMiniInteraction(svg);
  }

  function renderLiabBars(svg, rawValues, dates){
    const NS = 'http://www.w3.org/2000/svg';

    const W = svg.clientWidth  || 176;
    const H = svg.clientHeight || 60;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const pad = 4;
    const n = Math.max(1, rawValues.length);
    const step = (n > 1) ? ((W - 2*pad) / (n - 1)) : 0;
    const x = (i) => pad + i * step;

    const raw = (rawValues || []).slice(0, n);
    const vals = raw.map(v=>{
      const num = Number(v);
      return Number.isFinite(num) ? num : 0;
    });

    const maxV = Math.max(1, ...vals);

    const border = cssVar('--border', '#1f2a37');
    const barColor = cssVar('--accent2', '#3ddc97');

    // baseline
    const base = document.createElementNS(NS,'line');
    base.setAttribute('x1', pad);
    base.setAttribute('x2', W - pad);
    base.setAttribute('y1', String(H - pad));
    base.setAttribute('y2', String(H - pad));
    base.setAttribute('stroke', border);
    base.setAttribute('stroke-width', '1');
    svg.appendChild(base);

    const barW = Math.max(1, Math.min(6, step * 0.65));
    const usableH = Math.max(8, H - pad*2 - 2);

    for (let i=0;i<n;i++){
      const v = vals[i] || 0;
      if (v <= 0) continue;

      const h = (v / maxV) * usableH;
      const y1 = H - pad;
      const y2 = y1 - h;

      const line = document.createElementNS(NS,'line');
      line.setAttribute('x1', x(i));
      line.setAttribute('x2', x(i));
      line.setAttribute('y1', y1);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', barColor);
      line.setAttribute('stroke-width', String(barW));
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
    }

    // hover markers
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
    hoverDot.setAttribute('fill', barColor);
    hoverDot.setAttribute('stroke', '#0b1220');
    hoverDot.setAttribute('stroke-width', '1');
    hoverG.appendChild(hoverDot);

    svg.appendChild(hoverG);

    _liabMiniHover = { g: hoverG, line: hoverLine, dot: hoverDot };

    _liabMiniCtx = {
      dates: (dates || []).slice(0, n),
      raw,
      values: vals,
      maxV,
      W, H,
      pad,
      n,
      step,
      x,
      y: (v)=>{
        const y1 = H - pad;
        const h = (v / maxV) * usableH;
        return y1 - h;
      }
    };
  }

    try {
    window.addEventListener('adminHumToggle', ()=>{ renderUsersCard(); drawUsersMini(); });
  } catch (_) {}

  
  function parseHash(){
    const raw = (location.hash || '#summary').slice(1);
    const parts = raw.split('/').filter(Boolean);
    return { view: (parts[0] || 'summary'), sub: (parts[1] || '') };
  }

  function gotoView(view, sub){
    const h = '#' + view + (sub ? ('/' + sub) : '');
    try{ history.replaceState(null,'', h); }catch(_){ location.hash = h; }

    setView(view);

    // Ленивая загрузка
    if (view === 'summary') return loadSummary();
    if (view === 'finance') return loadFinance();
    if (view === 'events') return loadEvents();
    if (view === 'duels') return loadDuels();

    if (view === 'unmerge'){
      loadUnmergeHistory().catch(()=>{});
      return;
    }


    if (view === 'topup'){
      _topupRawList = null;
      loadTopupHistory(true).catch(()=>{});
      return;
    }

    if (view === 'users'){
      initUsersView();
      initUsersSubtabs();
      if (sub) setUsersSub(sub, { silent:true });
      return loadUsers();
    }
  }
function bindNav(){
    $$('.nav-item').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        const v = a.dataset.view;
        gotoView(v);
      });
    });

    $$('.nav-sub-item').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        const v = a.dataset.view || 'users';
        const sub = a.getAttribute('data-users-sub') || '';
        gotoView(v, sub);
      });
    });
  }

  
  function bindSidebarCollapse(){
    const layout = document.querySelector('.layout');
    const btn = document.getElementById('sidebar-toggle');
    if (!layout || !btn) return;

    const KEY = 'ADMIN_SIDEBAR_COLLAPSED';

    const isMobile = ()=> window.matchMedia && window.matchMedia('(max-width: 900px)').matches;

    function setNavTitles(collapsed){
      try{
        document.querySelectorAll('.nav-item').forEach(a=>{
          const label = a.querySelector('span')?.textContent?.trim() || '';
          if (collapsed && label) a.setAttribute('title', label);
          else a.removeAttribute('title');
        });
      }catch(_){}
    }

    function apply(collapsed){
      // На мобиле не режем сайдбар: там своя логика (off-canvas / скрытие)
      if (isMobile()){
        layout.classList.remove('sidebar-collapsed');
        setNavTitles(false);
        // оставляем текст по умолчанию
        btn.querySelector('.toggle-ico').textContent = '⟨';
        btn.querySelector('.toggle-text').textContent = 'Скрыть меню';
        return;
      }

      layout.classList.toggle('sidebar-collapsed', !!collapsed);
      btn.querySelector('.toggle-ico').textContent = collapsed ? '⟩' : '⟨';
      btn.querySelector('.toggle-text').textContent = collapsed ? 'Показать меню' : 'Скрыть меню';
      setNavTitles(!!collapsed);
    }

    // init from storage
    const saved = (localStorage.getItem(KEY) === '1');
    apply(saved);

    btn.addEventListener('click', ()=>{
      const now = !layout.classList.contains('sidebar-collapsed');
      localStorage.setItem(KEY, now ? '1' : '0');
      apply(now);
    });

    // respond to resize (desktop <-> mobile)
    try{
      const mq = window.matchMedia('(max-width: 900px)');
      mq.addEventListener ? mq.addEventListener('change', ()=>apply(localStorage.getItem(KEY)==='1'))
                          : mq.addListener(()=>apply(localStorage.getItem(KEY)==='1'));
    }catch(_){}
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
          yesterdayRaw: t.users_yesterday_raw ?? 0,
          yesterdayCluster: t.users_yesterday_cluster ?? 0,
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
        yesterday: t.events_yesterday ?? 0,
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
const yesterday = ymdShift(today, -1);

let finToday = null;
try{
  finToday = await jget(`/api/admin/finance?from=${today}&to=${today}`);
}catch(_){
  finToday = null;
}

let finYesterday = null;
try{
  finYesterday = await jget(`/api/admin/finance?from=${yesterday}&to=${yesterday}`);
}catch(_){
  finYesterday = null;
}

const depToday = finToday?.totals?.deposited ?? finToday?.deposited ?? '0';
const wdrToday = finToday?.totals?.withdrawn ?? finToday?.withdrawn ?? '0';

const duToday = finToday?.duels || {};
const turnoverToday = duToday.turnover ?? '0';
const rakeToday = duToday.rake ?? '0';


const depYesterday = finYesterday?.totals?.deposited ?? finYesterday?.deposited ?? '0';
const wdrYesterday = finYesterday?.totals?.withdrawn ?? finYesterday?.withdrawn ?? '0';
const duY = finYesterday?.duels || {};
const turnoverYesterday = duY.turnover ?? '0';
const rakeYesterday = duY.rake ?? '0';

// Summary cards
$('#sum-deposited-all').textContent = fmtInt(depAll);
$('#sum-deposited-today').textContent = fmtInt(depToday);
$('#sum-withdrawn-all').textContent = fmtInt(wdrAll);
$('#sum-withdrawn-today').textContent = fmtInt(wdrToday);

$('#sum-liabilities').textContent = fmtInt(liab);

// liabilities mini (90d) — bars, НЕ зависит от HUM
_liabMiniData = sum.liabilities_90d || sum.liabilities90d || sum.liab_90d || null;
drawLiabMini();

// liabilities mini (90d)
_liabMiniData = sum.liabilities_90d || sum.liabilities90d || sum.liab_90d || null;
drawLiabMini();

$('#sum-turnover-all').textContent = fmtInt(turnoverAll);
$('#sum-turnover-today').textContent = fmtInt(turnoverToday);
$('#sum-rake-all').textContent = fmtInt(rakeAll);
$('#sum-rake-today').textContent = fmtInt(rakeToday);

// trends vs yesterday
applyTrend($('#sum-deposited-today'), depToday, depYesterday, { reverse:false });
applyTrend($('#sum-withdrawn-today'), wdrToday, wdrYesterday, { reverse:true });
applyTrend($('#sum-turnover-today'), turnoverToday, turnoverYesterday, { reverse:false });
// rake: total is normal, today is colored by trend
try{ $('#sum-rake-all')?.classList?.remove('num-rake'); }catch(_){}
try{ $('#sum-rake-today')?.classList?.remove('num-rake'); }catch(_){}
applyTrend($('#sum-rake-today'), rakeToday, rakeYesterday, { reverse:false });

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
    rRow.classList.add('metric-inline-right');
    rAllEl.classList.remove('num-rake');
    rTodayEl.classList.remove('num-rake');
    rRow.textContent = '';
    rRow.append(rAllEl, document.createTextNode(' / '), rTodayEl);
  }
}catch(_){ /* ignore */ }


      // mini tables
      loadMiniEvents().catch(()=>{});
      loadMiniDuels().catch(()=>{});
      loadMiniUsers().catch(()=>{});
      loadMiniTopups().catch(()=>{});
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

  
  // --- Users view (таблица + фильтры + сортировка) ---
  const _usersPage = { sort:'created_at', dir:'desc', debounce:null, inited:false };


// Users sub-tabs inside "Пользователи"
let _usersSub = 'list';

function setUsersSub(name, opts){
  const v = (String(name || '').toLowerCase() === 'analytics') ? 'analytics' : 'list';
  _usersSub = v;
  try{ localStorage.setItem('ADMIN_USERS_SUB', v); }catch(_){}
  const list = $('#users-sub-list');
  const an = $('#users-sub-analytics');
  if (list) list.classList.toggle('active', v === 'list');
  if (an) an.classList.toggle('active', v === 'analytics');
  $$('#users-subtabs [data-users-sub]').forEach(btn=>{
    btn.classList.toggle('active', (btn.getAttribute('data-users-sub')||'') === v);
  });
  if (!opts?.silent && v === 'analytics'){
    loadUsersAnalyticsDuels().catch(()=>{});
  }
  updateUsersNavSubActive();
}

function initUsersSubtabs(){
  const tabs = $('#users-subtabs');
  if (!tabs || tabs.dataset.inited === '1') return;
  tabs.dataset.inited = '1';

  tabs.querySelectorAll('[data-users-sub]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      // ВАЖНО: синхронизируем сабтабы со строкой адреса (hash) и лоадерами.
      // Иначе после F5 на /#users/analytics переход кнопкой "Список" мог
      // просто переключить UI, но не вызвать загрузку списка (вечная "Загрузка...").
      const sub = (btn.getAttribute('data-users-sub') || '').toString();
      try{
        // используем общий роутер как у сайдбара
        gotoView('users', sub);
      }catch(_){
        // fallback: без hash
        setUsersSub(sub);
        if (sub === 'analytics') loadUsersAnalyticsDuels().catch(()=>{});
        else loadUsers().catch(()=>{});
      }
    });
  });

  let saved = 'list';
  try{ saved = (localStorage.getItem('ADMIN_USERS_SUB') || 'list').toString(); }catch(_){}
  setUsersSub(saved, { silent:true });
}

async function loadUsersAnalyticsDuels(){
  initUsersSubtabs();
  setUsersSub('analytics', { silent:true });

  const tbodyActive = $('#tbl-users-analytics-duels tbody');
  const tbodyWins   = $('#tbl-users-analytics-duels-wins tbody');
  const tbodyMoney  = $('#tbl-users-analytics-duels-money tbody');
  const tbodyProfit = $('#tbl-users-analytics-duels-profit tbody');
  const tbodyRake   = $('#tbl-users-analytics-duels-rake tbody');

  if (tbodyActive) tbodyActive.innerHTML = `<tr><td colspan="5" class="muted">Загрузка…</td></tr>`;
  if (tbodyWins)   tbodyWins.innerHTML   = `<tr><td colspan="5" class="muted">Загрузка…</td></tr>`;
  if (tbodyMoney)  tbodyMoney.innerHTML  = `<tr><td colspan="5" class="muted">Загрузка…</td></tr>`;
  if (tbodyProfit) tbodyProfit.innerHTML = `<tr><td colspan="5" class="muted">Загрузка…</td></tr>`;
  if (tbodyRake)   tbodyRake.innerHTML   = `<tr><td colspan="5" class="muted">Загрузка…</td></tr>`;

  const renderRows = (items, valueKey) => (items || []).slice(0,10).map((it, idx)=>{
    const user_id = it.user_id ?? it.id ?? '';
    const hum_id = it.hum_id ?? '';
    const name = [it.first_name, it.last_name].filter(Boolean).join(' ').trim();
    const avatar = it.avatar || it.avatar_url || '';
    const u = { id: user_id, hum_id, name, avatar };

    const val = it[valueKey] ?? it.count ?? 0;

    return `<tr>
      <td class="right muted">${idx + 1}</td>
      <td>${duelUserHtml(u)}</td>
      <td class="right"><span class="mono">${escapeHtml(fmtInt(val))}</span></td>
      <td class="right">${escapeHtml(String(user_id || '—'))}</td>
      <td class="right">${escapeHtml(String(hum_id || '—'))}</td>
    </tr>`;
  }).join('');

  try{
    // Важно: тут 4 промиса. Если распаковать только в 3 переменные —
    // получим ReferenceError и «упадут» все таблицы.
    const [ra, rw, rm, rp, rr] = await Promise.allSettled([
      jget('/api/admin/analytics/duels/most-active?limit=10'),
      jget('/api/admin/analytics/duels/most-successful?limit=10'),
      jget('/api/admin/analytics/duels/most-money?limit=10'),
      jget('/api/admin/analytics/duels/most-profit?limit=10'),
      jget('/api/admin/analytics/duels/most-rake?limit=10'),
    ]);

    if (tbodyActive){
      if (ra.status === 'fulfilled'){
        const j = ra.value || {};
        const items = j.items || j.rows || [];
        tbodyActive.innerHTML = renderRows(items, 'duels_count') || `<tr><td colspan="5" class="muted">Нет данных</td></tr>`;
      } else {
        console.error(ra.reason);
        tbodyActive.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
      }
    }

    if (tbodyWins){
      if (rw.status === 'fulfilled'){
        const j = rw.value || {};
        const items = j.items || j.rows || [];
        tbodyWins.innerHTML = renderRows(items, 'wins_count') || `<tr><td colspan="5" class="muted">Нет данных</td></tr>`;
      } else {
        console.error(rw.reason);
        tbodyWins.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
      }
    }
    if (tbodyMoney){
      if (rm.status === 'fulfilled'){
        const j = rm.value || {};
        const items = j.items || j.rows || [];
        tbodyMoney.innerHTML = renderRows(items, 'won_amount') || `<tr><td colspan="5" class="muted">Нет данных</td></tr>`;
      } else {
        console.error(rm.reason);
        tbodyMoney.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
      }
    }
    if (tbodyProfit){
      if (rp.status === 'fulfilled'){
        const j = rp.value || {};
        const items = j.items || j.rows || [];
        tbodyProfit.innerHTML = renderRows(items, 'profit') || `<tr><td colspan="5" class="muted">Нет данных</td></tr>`;
      } else {
        console.error(rp.reason);
        tbodyProfit.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
      }
    }

    if (tbodyRake){
      if (rr.status === 'fulfilled'){
        const j = rr.value || {};
        const items = j.items || j.rows || [];
        tbodyRake.innerHTML = renderRows(items, 'rake') || `<tr><td colspan="5" class="muted">Нет данных</td></tr>`;
      } else {
        console.error(rr.reason);
        tbodyRake.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
      }
    }

  }catch(e){
    console.error(e);
    if (tbodyActive) tbodyActive.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
    if (tbodyWins)   tbodyWins.innerHTML   = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
    if (tbodyMoney)  tbodyMoney.innerHTML  = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
    if (tbodyProfit) tbodyProfit.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
    if (tbodyRake)   tbodyRake.innerHTML   = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
  }
}



  function usersFilters(){
    const vkRaw = ($('#users-f-vkid')?.value || '').trim();
    const first = ($('#users-f-first')?.value || '').trim();
    const last  = ($('#users-f-last')?.value  || '').trim();
    const hum   = ($('#users-f-hum')?.value   || '').trim();
    const uid   = ($('#users-f-uid')?.value   || '').trim();

    // нормализуем vk/tg id: разрешаем "tg:123" / "vk:123" / "123"
    let vk_tg = vkRaw;
    if (vk_tg && (vk_tg.startsWith('tg ') || vk_tg.startsWith('vk '))){
      vk_tg = vk_tg.replace(/\s+/, ':');
    }
    return { vk_tg, first, last, hum, uid };
  }

  function usersBuildUrl(){
    const f = usersFilters();
    const p = new URLSearchParams();
    p.set('take','25');
    p.set('sort', _usersPage.sort);
    p.set('dir', _usersPage.dir);

    if (f.vk_tg) p.set('vk_tg', f.vk_tg);
    if (f.first) p.set('first_name', f.first);
    if (f.last)  p.set('last_name', f.last);
    if (f.hum)   p.set('hum_id', f.hum);
    if (f.uid)   p.set('user_id', f.uid);

    return '/api/admin/users?' + p.toString();
  }

  function usersSetSortUI(){
    const ths = document.querySelectorAll('#tbl-users thead th.sortable');
    ths.forEach(th=>{
      th.classList.remove('sorted-asc','sorted-desc');
      if ((th.dataset.sort||'') === _usersPage.sort){
        th.classList.add(_usersPage.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function initUsersView(){
    if (_usersPage.inited) return;
    _usersPage.inited = true;

    initUsersSubtabs();

    // сортировка по клику на заголовок
    document.querySelectorAll('#tbl-users thead th.sortable').forEach(th=>{
      th.addEventListener('click', ()=>{
        const key = th.dataset.sort || 'id';
        if (_usersPage.sort === key){
          _usersPage.dir = (_usersPage.dir === 'asc') ? 'desc' : 'asc';
        } else {
          _usersPage.sort = key;
          _usersPage.dir = 'asc';
        }
        usersSetSortUI();
        loadUsers();
      });
    });

    const debouncedReload = ()=>{
      clearTimeout(_usersPage.debounce);
      _usersPage.debounce = setTimeout(()=>loadUsers(), 220);
    };

    // фильтры: ввод + Enter
    ['users-f-vkid','users-f-first','users-f-last','users-f-hum','users-f-uid'].forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', debouncedReload);
      el.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter') loadUsers();
      });
    });

    $('#users-clear')?.addEventListener('click', ()=>{
      setUsersSub('list', { silent:true });
      ['users-f-vkid','users-f-first','users-f-last','users-f-hum','users-f-uid'].forEach(id=>{
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      loadUsers();
    });
  }

  async function loadUsers(){
    initUsersView();
    initUsersSubtabs();

    // если открыт сабтаб "Аналитика" — грузим его, а не список
    if (_usersSub === 'analytics') return loadUsersAnalyticsDuels();

    setUsersSub('list', { silent:true });
    usersSetSortUI();

    const tbody = $('#tbl-users tbody');
    tbody.innerHTML = `<tr><td colspan="10" class="muted">Загрузка…</td></tr>`;
    try{
      const u = await jget(usersBuildUrl());
      const items = u.users || u.items || u.rows || [];
      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="10" class="muted">Пусто</td></tr>`;
        return;
      }

      const fmtDT = (s)=> (s||'').toString().slice(0,19).replace('T',' ');
      const ccCell = (cc)=>{
        const s = (cc||'').toString().toUpperCase();
        return `<td data-cc="${escapeHtml(s)}"></td>`;
      };

      tbody.innerHTML = items.map(it=>{
        const humId = it.hum_id ?? it.id ?? '';
        const userId = it.id ?? '';
        const fullName = [it.first_name, it.last_name].filter(Boolean).join(' ').trim();

        const pid = it.provider_ids || {};
        let vktg = '—';
        if (pid.tg) vktg = `tg:${pid.tg}`;
        else if (it.vk_id) vktg = `${it.vk_id}`;
        else if (pid.vk) vktg = `${pid.vk}`;

        const providers = Array.isArray(it.providers) ? it.providers.join(',') : (it.providers || '');
        const avatarUrl = it.avatar || it.avatar_url || '';
        const created = fmtDT(it.created_at);

        const ava = avatarUrl
          ? `<img class="ava big" src="${escapeHtml(avatarUrl)}" alt="" title="${escapeHtml(fullName || ('user '+userId))}">`
          : `<span class="ava big" title="${escapeHtml(fullName || ('user '+userId))}"></span>`;

        return `<tr>
          <td title="HUMid">${escapeHtml(String(humId))}</td>
          <td title="${escapeHtml(fullName || ('user '+userId))}">${escapeHtml(String(userId))}</td>
          <td>${escapeHtml(String(vktg))}</td>
          <td>${escapeHtml(it.first_name || '—')}</td>
          <td>${escapeHtml(it.last_name || '—')}</td>
          <td class="right">${fmtInt(it.balance ?? 0)}</td>
          ${ccCell(it.country_code)}
          <td class="muted">${escapeHtml(created)}</td>
          <td class="tight">${escapeHtml(providers)}</td>
          <td class="tight right">${ava}</td>
        </tr>`;
      }).join('');
      if (window.decorateFlags) window.decorateFlags(tbody);
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="10" class="muted">Ошибка загрузки</td></tr>`;
    }
  }


  // --- Duels table (admin) ---
  let _duelsSortKey = 'created_at';
  let _duelsSortDir = -1; // desc
  let _duelsRaw = null;
  let _duelsFilter = '';
  let _duelsTake = 100;
  let _duelsSkip = 0;
  let _duelsHasNext = false;

  function normDuelRows(list){
    if (!Array.isArray(list)) return [];
    const userFrom = (it, pref)=>{
      const id = it[`${pref}_user_id`];
      const hum_id = it[`${pref}_hum_id`];
      const first = it[`${pref}_first_name`];
      const last = it[`${pref}_last_name`];
      const avatar = it[`${pref}_avatar`];
      const name = [first, last].filter(Boolean).join(' ').trim();
      return { id: id ?? '', hum_id: hum_id ?? '', first:first||'', last:last||'', avatar: avatar||'', name };
    };

    return list.map(it=>{
      const creator = userFrom(it, 'creator');
      const opponent = userFrom(it, 'opponent');
      const winner = userFrom(it, 'winner');
      return {
        id: it.id ?? '',
        mode: it.mode || '',
        created_at: it.created_at || it.createdAt || '',
        stake: Number(it.stake ?? 0) || 0,
        status: it.status || '',
        fee_bps: Number(it.fee_bps ?? it.feeBps ?? 0) || 0,
        creator, opponent, winner,
        finished_at: it.finished_at || it.updated_at || it.finishedAt || '',
      };
    });
  }

  function duelUserHtml(u, cls){
    const uid = (u && u.id !== undefined && u.id !== null && u.id !== '') ? String(u.id) : '—';
    const name = (u && u.name) ? String(u.name) : '';
    const hum = (u && u.hum_id !== undefined && u.hum_id !== null && u.hum_id !== '') ? String(u.hum_id) : '';
    const title = name
      ? `${name} (id ${uid}${hum ? ', HUM ' + hum : ''})`
      : (uid !== '—' ? `id ${uid}${hum ? ', HUM ' + hum : ''}` : '—');

    const ava = (u && u.avatar) ? String(u.avatar) : '';
    const avaTag = ava
      ? `<img class="mini-ava" src="${escapeHtml(ava)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : `<span class="mini-ava" aria-hidden="true"></span>`;

    const label = name ? name : '—';

    return `<span class="duel-user" title="${escapeHtml(title)}">${avaTag}<span class="duel-user-txt"><span class="duel-user-id${cls ? " " + cls : ""}">#${escapeHtml(uid)}</span><span class="duel-user-name${cls ? " " + cls : ""}">${escapeHtml(label)}</span></span></span>`;
  }

  function duelStatusHtml(s){
    const st = String(s || '—').toLowerCase().trim() || '—';
    const cls =
      st === 'finished' ? 'status-tag status-finished' :
      st === 'cancelled' ? 'status-tag status-cancelled' :
      st === 'open' ? 'status-tag status-open' :
      st === 'active' ? 'status-tag status-active' :
      'status-tag';
    return `<span class="${cls}">${escapeHtml(st)}</span>`;
  }

  function matchDuelRow(row, q){
    const query = String(q || '').trim().toLowerCase();
    if (!query) return true;

    const uStr = (u)=> `${u?.id||''} ${u?.hum_id||''} ${u?.name||''}`.toLowerCase();
    const hayAll = `${row.id} ${row.mode} ${row.created_at} ${row.stake} ${row.status} ${row.fee_bps} ${row.finished_at} ${uStr(row.creator)} ${uStr(row.opponent)} ${uStr(row.winner)}`.toLowerCase();

    const tokens = query.split(/\s+/).filter(Boolean);
    return tokens.every(tok=>{
      const t = tok.trim();
      const idx = t.indexOf(':');
      if (idx > 0){
        const k = t.slice(0, idx);
        const v = t.slice(idx+1);
        if (!v) return true;
        const vv = v.toLowerCase();

        if (k === 'id') return String(row.id ?? '').toLowerCase().includes(vv);
        if (k === 'mode') return String(row.mode ?? '').toLowerCase().includes(vv);
        if (k === 'status') return String(row.status ?? '').toLowerCase().includes(vv);
        if (k === 'stake' || k === 'sum') return String(row.stake ?? '').toLowerCase().includes(vv);
        if (k === 'fee' || k === 'fee_bps') return String(row.fee_bps ?? '').toLowerCase().includes(vv);
        if (k === 'created') return String(row.created_at ?? '').toLowerCase().includes(vv);
        if (k === 'finished') return String(row.finished_at ?? '').toLowerCase().includes(vv);

        if (k === 'creator') return uStr(row.creator).includes(vv);
        if (k === 'opponent') return uStr(row.opponent).includes(vv);
        if (k === 'winner') return uStr(row.winner).includes(vv);
        if (k === 'user') return (`${uStr(row.creator)} ${uStr(row.opponent)} ${uStr(row.winner)}`).includes(vv);
        if (k === 'hum' || k === 'hum_id' || k === 'humid'){
          const hh = `${row.creator?.hum_id||''} ${row.opponent?.hum_id||''} ${row.winner?.hum_id||''}`.toLowerCase();
          return hh.includes(vv);
        }

        return hayAll.includes(vv);
      }
      return hayAll.includes(t);
    });
  }

  function renderDuelsTable(list){
    const tbody = $('#tbl-duels tbody');
    if (!tbody) return;

    let rows = normDuelRows(list || []);

    if (_duelsFilter){
      rows = rows.filter(r=>matchDuelRow(r, _duelsFilter));
    }

    rows.sort((a,b)=>{
      const dir = _duelsSortDir || -1;
      const key = _duelsSortKey || 'created_at';

      if (key === 'id') return (Number(a.id||0) - Number(b.id||0)) * dir;
      if (key === 'stake') return (Number(a.stake||0) - Number(b.stake||0)) * dir;
      if (key === 'fee_bps') return (Number(a.fee_bps||0) - Number(b.fee_bps||0)) * dir;
      if (key === 'created_at') return (tsVal(a.created_at) - tsVal(b.created_at)) * dir;
      if (key === 'finished_at') return (tsVal(a.finished_at) - tsVal(b.finished_at)) * dir;
      if (key === 'creator') return (Number(a.creator?.id||0) - Number(b.creator?.id||0)) * dir;
      if (key === 'opponent') return (Number(a.opponent?.id||0) - Number(b.opponent?.id||0)) * dir;
      if (key === 'winner') return (Number(a.winner?.id||0) - Number(b.winner?.id||0)) * dir;

      const ak = String(a[key] ?? '');
      const bk = String(b[key] ?? '');
      return ak.localeCompare(bk) * dir;
    });

    if (!rows.length){
      tbody.innerHTML = `<tr><td colspan="10" class="muted">Пусто</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r=>{
      return `<tr>
        <td>${escapeHtml(String(r.id ?? ''))}</td>
        <td>${escapeHtml(r.mode || '—')}</td>
        <td class="muted">${escapeHtml(fmtDTMsk(r.created_at))}</td>
        <td class="right">${fmtInt(r.stake || 0)}</td>
        <td>${duelStatusHtml(r.status)}</td>
        <td class="right">${escapeHtml(String(r.fee_bps ?? ''))}</td>
        <td>${duelUserHtml(r.creator, (r.winner?.id && r.creator?.id && String(r.winner.id) === String(r.creator.id)) ? 'trend-up' : (r.winner?.id ? 'trend-down' : ''))}</td>
        <td>${duelUserHtml(r.opponent, (r.winner?.id && r.opponent?.id && String(r.winner.id) === String(r.opponent.id)) ? 'trend-up' : (r.winner?.id ? 'trend-down' : ''))}</td>
        <td>${duelUserHtml(r.winner)}</td>
        <td class="muted">${escapeHtml(fmtDTMsk(r.finished_at))}</td>
      </tr>`;
    }).join('');
  }
  async function loadDuels(reset){
    if (reset) _duelsSkip = 0;

    const tbody = $('#tbl-duels tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="muted">Загрузка…</td></tr>`;

    const q = String($('#duels-filter')?.value || '').trim();
    const day = String($('#duels-day')?.value || '').trim(); // YYYY-MM-DD (если пусто — не фильтруем)

    try{
      const params = new URLSearchParams();
      params.set('take', String(_duelsTake || 100));
      params.set('skip', String(_duelsSkip || 0));
      if (q) params.set('q', q);
      if (day) params.set('day', day);

      const r = await jget('/api/admin/duels?' + params.toString());
      const items = r.items || r.rows || r.duels || [];
      _duelsRaw = items;
      _duelsHasNext = Array.isArray(items) && items.length >= (_duelsTake || 100);

      // ВАЖНО: не меняем текущую клиентскую фильтрацию/сортировку — она остаётся
      renderDuelsTable(_duelsRaw);

      // pager
      const elPage = $('#duels-page');
      if (elPage){
        const page = Math.floor((_duelsSkip||0)/(_duelsTake||100)) + 1;
        elPage.textContent = `стр. ${page}`;
      }
      const btnPrev = $('#duels-prev');
      const btnNext = $('#duels-next');
      if (btnPrev) btnPrev.disabled = (_duelsSkip||0) <= 0;
      if (btnNext) btnNext.disabled = !_duelsHasNext;
    }catch(e){
      console.error(e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="muted">Ошибка загрузки</td></tr>`;
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
      if (window.decorateFlags) window.decorateFlags(tbody);
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Ошибка</td></tr>`;
    }
  }


  async function loadMiniUsers(){
    const tbody = $('#mini-users tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10" class="muted">Загрузка…</td></tr>`;
    try{
      const r = await jget('/api/admin/users?take=6');
      const items = r.items || r.users || r.rows || [];
      const norm = (items || []).slice(0, 6);
      while (norm.length < 6) norm.push(null);

      const fmtDT = (s)=> (s||'').toString().slice(0,19).replace('T',' ');
      const fmtMini = (s)=> (s||'').toString().slice(5,16).replace('T',' ');

      tbody.innerHTML = norm.map(u=>{
        if (!u){
          return `<tr>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted right">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
          </tr>`;
        }

        const humId = u.hum_id ?? u.id ?? '';
        const userId = u.id ?? '';
        const pid = u.provider_ids || {};
        let vktg = '—';
        if (pid.tg) vktg = `tg:${pid.tg}`;
        else if (pid.vk) vktg = String(pid.vk);

        const providers = (u.providers || []).join(',');
        const createdFull = fmtDT(u.created_at);
        const createdMini = fmtMini(u.created_at);
        const cc = (u.country_code || '').toString().toUpperCase();

        const avatar = u.avatar_url || u.avatar || '';
        const title = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || `user ${userId}`;

        return `<tr>
          <td title="HUMid">${escapeHtml(String(humId))}</td>
          <td title="${escapeHtml(title)}">${escapeHtml(String(userId))}</td>
          <td>${escapeHtml(String(vktg))}</td>
          <td>${escapeHtml(u.first_name || '—')}</td>
          <td>${escapeHtml(u.last_name || '—')}</td>
          <td class="right">${fmtInt(u.balance ?? 0)}</td>
          <td data-cc="${escapeHtml(cc)}"></td>
          <td class="muted" title="${escapeHtml(createdFull)}">${escapeHtml(createdMini)}</td>
          <td class="tight"><span class="providers" title="${escapeHtml(providers)}">${escapeHtml(providers)}</span></td>
          <td class="tight right avatar-cell">${avatar ? `<img class="mini-ava-lg" src="${escapeHtml(avatar)}" alt="" loading="lazy" title="${escapeHtml(title)}">` : ''}</td>
        </tr>`;
      }).join('');
      if (window.decorateFlags) window.decorateFlags(tbody);

      if (window.decorateFlags) window.decorateFlags(tbody);
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="10" class="muted">Ошибка загрузки</td></tr>`;
    }
  }

async function loadMiniDuels(){
    const tbody = $('#mini-duels tbody');
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Загрузка…</td></tr>`;

    const playerHtml = (id, avatar, firstName, lastName, cls)=>{
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
      return `<span class="mini-user" title="${escapeHtml(title)}">${avaTag}<span class="mini-id${cls ? " " + cls : ""}">${escapeHtml(uid)}</span></span>`;
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

        const time = fmtTimeMsk(it.finished_at||it.updated_at||it.created_at||'');

        const stake = Number(it.stake || 0) || 0;
        const pot = Number(it.pot ?? it.result?.pot ?? (stake*2)) || 0;
        const feeBps = Number(it.fee_bps ?? 0) || 0;
        const rake = Number(it.rake ?? it.result?.rake ?? Math.round(pot * feeBps / 10000)) || 0;

        const win = (it.winner_user_id ?? it.winnerUserId ?? '') !== null ? String(it.winner_user_id ?? it.winnerUserId ?? '') : '';
        const cid = (it.creator_user_id ?? it.creatorUserId ?? '') !== null ? String(it.creator_user_id ?? it.creatorUserId ?? '') : '';
        const oid = (it.opponent_user_id ?? it.opponentUserId ?? '') !== null ? String(it.opponent_user_id ?? it.opponentUserId ?? '') : '';
        const leftCls  = (win && cid && win === cid) ? 'trend-up' : (win && cid ? 'trend-down' : '');
        const rightCls = (win && oid && win === oid) ? 'trend-up' : (win && oid ? 'trend-down' : '');
        const left = playerHtml(it.creator_user_id, it.creator_avatar, it.creator_first_name, it.creator_last_name, leftCls);
        const right = playerHtml(it.opponent_user_id, it.opponent_avatar, it.opponent_first_name, it.opponent_last_name, rightCls);

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
      if (window.decorateFlags) window.decorateFlags(tbody);
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="8" class="muted">Ошибка</td></tr>`;
    }
  }

    // --- Events (search + paging) ---
  let _eventsSkip = 0;
  const _eventsTake = 100;
  let _eventsFilters = null;

  function _readEventsFilters(){
    const f = {};
    const user = ($('#events-user')?.value || '').toString().trim();
    const type = ($('#events-type')?.value || '').toString().trim();
    const term = ($('#events-term')?.value || '').toString().trim();
    const day  = ($('#events-day')?.value || '').toString().trim();

    const uid = toInt(user, 0);
    if (uid) f.user_id = uid;
    if (type) f.type = type;
    if (term) f.term = term;
    if (day)  f.day  = day.slice(0,10);

    return f;
  }

  function _eventsUrl(skip){
    const f = _eventsFilters || _readEventsFilters();
    const qs = new URLSearchParams();
    qs.set('take', String(_eventsTake));
    qs.set('skip', String(Math.max(0, toInt(skip, 0))));
    if (f.user_id) qs.set('user_id', String(f.user_id));
    if (f.type)    qs.set('type', f.type);
    if (f.term)    qs.set('term', f.term);
    if (f.day)     qs.set('day', f.day);
    return '/api/admin/events?' + qs.toString();
  }

  function _setEventsInfo(text){
    const el = $('#events-info');
    if (el) el.textContent = text;
  }

  function _filtersHint(){
    const f = _eventsFilters || _readEventsFilters();
    const parts = [];
    if (f.user_id) parts.push(`user:${f.user_id}`);
    if (f.type)    parts.push(`type:${f.type}`);
    if (f.term)    parts.push(`term:${f.term}`);
    if (f.day)     parts.push(`day:${f.day}`);
    return parts.length ? (' • ' + parts.join(' ')) : '';
  }

  async function loadEvents(opts){
    const tbody = $('#tbl-events tbody');
    if (!tbody) return;

    const nextSkip = (opts && typeof opts.skip === 'number') ? opts.skip : _eventsSkip;
    if (opts && opts.filters) _eventsFilters = opts.filters;

    tbody.innerHTML = `<tr><td colspan="7" class="muted">Загрузка…</td></tr>`;
    try{
      const r = await jget(_eventsUrl(nextSkip));
      const items = r.items || r.events || r.rows || [];

      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="7" class="muted">Пусто</td></tr>`;
        _eventsSkip = Math.max(0, nextSkip);
        _setEventsInfo(`Пусто • skip=${_eventsSkip}${_filtersHint()}`);
      } else {
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

        _eventsSkip = Math.max(0, nextSkip);
        _setEventsInfo(`Показаны ${items.length} • skip=${_eventsSkip}${_filtersHint()}`);
      }

      const prevBtn = $('#events-prev');
      const nextBtn = $('#events-next');
      if (prevBtn) prevBtn.disabled = (_eventsSkip <= 0);
      if (nextBtn) nextBtn.disabled = (items.length < _eventsTake);
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Ошибка загрузки</td></tr>`;
      _setEventsInfo(`Ошибка • skip=${Math.max(0,nextSkip)}${_filtersHint()}`);
    }
  }

// --- Topup history (ported from classic /admin/topup.html) ---
  let _topupSortKey = 'created_at';
  let _topupSortDir = -1; // desc

  let _topupRawList = null;
  let _topupFilter = '';

  function toBigIntSafe(x){
    if (x === null || x === undefined) return 0n;
    if (typeof x === 'bigint') return x;
    const s = String(x).trim();
    if (!s) return 0n;
    if (/^-?\d+$/.test(s)){
      try{ return BigInt(s); }catch(_){ return 0n; }
    }
    const n = Number(s);
    return Number.isFinite(n) ? BigInt(Math.trunc(n)) : 0n;
  }

  function fmtDateTimeMskFromDate(d){
    try{
      const parts = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).formatToParts(d);
      const get = (t)=> (parts.find(p=>p.type===t)?.value || '');
      return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
    }catch(_){
      // Fallback: ISO (UTC) — лучше чем падение
      return d.toISOString().slice(0, 19).replace('T', ' ');
    }
  }

  function fmtTimeMskFromDate(d){
    try{
      const parts = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).formatToParts(d);
      const get = (t)=> (parts.find(p=>p.type===t)?.value || '');
      return `${get('hour')}:${get('minute')}:${get('second')}`;
    }catch(_){
      return d.toISOString().slice(11, 19);
    }
  }

  function fmtDT(s){
    const str = (s || '').toString().trim();
    if (!str) return '—';
    // Базовый формат: выводим как есть (без сдвига таймзоны)
    return str.slice(0, 19).replace('T', ' ');
  }

  // Для дуэлей время иногда приходит как UTC/без TZ.
  // Нам нужно показать «+3 к МСК» (т.е. привести к Europe/Moscow).
  // Эти функции используются ТОЛЬКО в таблице "Дуэли" и мини-таблице "Последние дуэли".
  function parseDuelDateForMsk(input){
    const s0 = (input || '').toString().trim();
    if (!s0) return null;

    // Нормализуем в ISO-подобный вид
    let s = s0;
    // date time separator
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T');
    // +HHMM => +HH:MM
    s = s.replace(/([+-]\d{2})(\d{2})$/,'$1:$2');
    // +HH => +HH:00
    s = s.replace(/([+-]\d{2})$/,'$1:00');

    const hasTZ = /Z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s);
    // Если TZ нет — считаем, что это UTC (и тогда МСК = UTC+3)
    if (!hasTZ && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) s = s + 'Z';

    let d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;

    // Фоллбек: попробуем как есть
    d = new Date(s0);
    if (!Number.isNaN(d.getTime())) return d;
    return null;
  }

  function fmtDTMsk(s){
    const str = (s || '').toString().trim();
    if (!str) return '—';

    const d = parseDuelDateForMsk(str);
    if (d) return fmtDateTimeMskFromDate(d);
    return fmtDT(str);
  }

  function fmtTimeMsk(s){
    const str = (s || '').toString().trim();
    if (!str) return '—';

    const d = parseDuelDateForMsk(str);
    if (d) return fmtTimeMskFromDate(d);

    if (str.length >= 19) return str.slice(11, 19);
    if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str;
    return str;
  }

  function pick(obj, keys, d){
    for (const k of keys){
      if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return d;
  }

  function tsVal(x){
    const s = String(x || '').trim();
    if (!s) return 0;
    let t = new Date(s).getTime();
    if (Number.isFinite(t)) return t;
    t = new Date(s.replace(' ', 'T')).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  
  async function ensureTopupEvents(force=false){
    if (!force && Array.isArray(_topupRawList) && _topupRawList.length) return _topupRawList;
    const r = await jget('/api/admin/events?type=admin_topup&take=200&skip=0');
    _topupRawList = r.items || r.events || r.rows || [];
    return _topupRawList;
  }

  function normTopupRows(list){
    if (!Array.isArray(list)) return [];
    return list.map(ev=>{
      const p = ev.payload || {};
      const created_at = pick(ev, ['created_at','ts','time'], pick(p, ['created_at','ts','time'], ''));
      const admin      = pick(ev, ['admin','admin_id','actor'], pick(p, ['admin','admin_id','actor'], '—'));
      const user_id    = pick(ev, ['user_id'], pick(p, ['user_id'], '—'));
      const hum_id     = pick(ev, ['hum_id','HUMid'], pick(p, ['hum_id','HUMid'], '—'));
      const amountBI   = toBigIntSafe(pick(ev, ['amount'], pick(p, ['amount','value','sum','delta'], 0)));
      const comment    = String(pick(ev, ['comment'], pick(p, ['comment','note','reason','description'], '')) || '');
      const amountText = (amountBI > 0n ? '+' : '') + fmtInt(amountBI.toString());
      const amountSigned = (amountBI > 0n ? '+' : '') + amountBI.toString();
      return { created_at, admin: String(admin ?? ''), user_id, hum_id, amountBI, amountText, amountSigned, comment };
    });
  }

  function matchTopupRow(row, q){
    const query = String(q || '').trim().toLowerCase();
    if (!query) return true;

    const hayAll = `${row.admin} ${row.user_id} ${row.hum_id} ${row.amountSigned} ${row.amountText} ${row.comment}`.toLowerCase();

    const tokens = query.split(/\s+/).filter(Boolean);
    return tokens.every(tok=>{
      const t = tok.trim();
      const idx = t.indexOf(':');
      if (idx > 0){
        const k = t.slice(0, idx);
        const v = t.slice(idx+1);
        if (!v) return true;
        if (k === 'hum' || k === 'hum_id' || k === 'humid') return String(row.hum_id ?? '').toLowerCase().includes(v);
        if (k === 'user' || k === 'user_id' || k === 'uid') return String(row.user_id ?? '').toLowerCase().includes(v);
        if (k === 'admin') return String(row.admin ?? '').toLowerCase().includes(v);
        if (k === 'sum' || k === 'amount') return (`${row.amountSigned} ${row.amountText}`).toLowerCase().includes(v);
        if (k === 'comment' || k === 'c') return String(row.comment ?? '').toLowerCase().includes(v);
        return hayAll.includes(v);
      }
      return hayAll.includes(t);
    });
  }

  function renderMiniTopupsFromList(list){
    const tbody = $('#mini-topups tbody');
    if (!tbody) return;
    const rows = normTopupRows(list)
      .sort((a,b)=> tsVal(b.created_at) - tsVal(a.created_at))
      .slice(0, 6);

    if (!rows.length){
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Нет событий…</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r=>{
      const cls = r.amountBI > 0n ? 'pill pos' : (r.amountBI < 0n ? 'pill neg' : 'pill zero');
      const c = r.comment ? escapeHtml(r.comment) : '—';
      return `<tr>
        <td class="muted">${escapeHtml(fmtDT(r.created_at))}</td>
        <td>${escapeHtml(r.admin || '—')}</td>
        <td>${escapeHtml(String(r.user_id ?? '—'))} / ${escapeHtml(String(r.hum_id ?? '—'))}</td>
        <td class="right"><span class="${cls}">${escapeHtml(r.amountText)}</span></td>
        <td class="truncate" title="${escapeHtml(r.comment || '')}">${c}</td>
      </tr>`;
    }).join('');
  }

  async function loadMiniTopups(force=false){
    try{
      const list = await ensureTopupEvents(force);
      renderMiniTopupsFromList(list);
    }catch(e){
      console.error(e);
      const tbody = $('#mini-topups tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
    }
  }

  function renderTopupHistory(list){
    const tbody = $('#tbl-topup tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(list) || !list.length){
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Нет событий…</td></tr>`;
      return;
    }

    let rows = normTopupRows(list);

    // filter
    if (_topupFilter){
      rows = rows.filter(r=>matchTopupRow(r, _topupFilter));
    }


    rows.sort((a,b)=>{
      if (_topupSortKey === 'created_at') return (tsVal(a.created_at) - tsVal(b.created_at)) * _topupSortDir;
      if (_topupSortKey === 'amount') return (a.amountBI === b.amountBI ? 0 : (a.amountBI > b.amountBI ? 1 : -1)) * _topupSortDir;
      if (_topupSortKey === 'user'){
        const au = Number(a.user_id || 0) || 0;
        const bu = Number(b.user_id || 0) || 0;
        return (au - bu) * _topupSortDir;
      }
      const ak = String(a[_topupSortKey] ?? '');
      const bk = String(b[_topupSortKey] ?? '');
      return ak.localeCompare(bk) * _topupSortDir;
    });

    tbody.innerHTML = rows.map(r=>{
      const cls = r.amountBI > 0n ? 'pill pos' : (r.amountBI < 0n ? 'pill neg' : 'pill zero');
      const amountText = r.amountText;
      const c = r.comment ? escapeHtml(r.comment) : '—';
      return `<tr>
        <td class="muted">${escapeHtml(fmtDT(r.created_at))}</td>
        <td>${escapeHtml(r.admin || '—')}</td>
        <td>${escapeHtml(String(r.user_id ?? '—'))} / ${escapeHtml(String(r.hum_id ?? '—'))}</td>
        <td class="right"><span class="${cls}">${escapeHtml(amountText)}</span></td>
        <td class="truncate" title="${escapeHtml(r.comment || '')}">${c}</td>
      </tr>`;
    }).join('');
  }

  async function loadTopupHistory(force=false){
    const tbody = $('#tbl-topup tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="muted">Загрузка…</td></tr>`;
    try{
      const list = await ensureTopupEvents(!!force);
      if (tbody) renderTopupHistory(list);
      renderMiniTopupsFromList(list);
    }catch(e){
      console.error(e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
      const mini = $('#mini-topups tbody');
      if (mini) mini.innerHTML = `<tr><td colspan="5" class="muted">Ошибка загрузки</td></tr>`;
    }
  }



// --- Расклейка (ручная): портировано из /admin/split ---
function renderUnmergeCluster(data){
  const box = $('#unmerge-cluster');
  if (box) box.style.display = '';

  const tbody = $('#unmerge-users-body');
  if (!tbody) return;

  const users = (data && (data.users || data.cluster || data.list)) || [];
  if (!Array.isArray(users) || users.length === 0){
    tbody.innerHTML = '<tr><td class="muted" colspan="6">Пусто…</td></tr>';
    return;
  }

  const rows = users.map(u=>{
    const acc = (u.accounts||[]).map(a=>{
      const prov = escapeHtml(a.provider ?? '');
      const pid  = escapeHtml(a.provider_user_id ?? '');
      return prov && pid ? (prov + ':' + pid) : (prov || pid);
    }).filter(Boolean).join(', ');

    const name = (`${escapeHtml(u.first_name||'')} ${escapeHtml(u.last_name||'')}`).trim() || '—';
    const cc = escapeHtml(u.country_code||'') || '—';
    const bal = fmtInt(u.balance);

    return `
      <tr>
        <td><input type="checkbox" class="unmerge-chk" value="${escapeHtml(u.id)}"></td>
        <td class="mono">${escapeHtml(u.id)}</td>
        <td>${name}</td>
        <td class="mono">${acc || '—'}</td>
        <td>${cc}</td>
        <td class="right mono">${bal}</td>
      </tr>`;
  }).join('');

  tbody.innerHTML = rows;

  const all = $('#unmerge-all');
  if (all) all.checked = false;
}

async function loadUnmergeCluster(opts){
  const out = $('#unmerge-out');
  const silent = !!(opts && opts.silent);
  if (out && !silent) out.textContent = '...';

  const hum_id = Number(String($('#unmerge-hum')?.value || '').trim());
  if (!Number.isFinite(hum_id) || hum_id <= 0) throw new Error('bad_hum_id');

  const r = await jget(`/api/admin/cluster?hum_id=${encodeURIComponent(String(hum_id))}`);
  renderUnmergeCluster(r);

  if (out && !silent) out.textContent = '';
  return r;
}

function fmtMsk(dt){
  try{
    const d = (dt instanceof Date) ? dt : new Date(dt || 0);
    return d.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  }catch(_){
    return String(dt || '');
  }
}

async function loadUnmergeHistory(){
  const tbody = $('#unmerge-hist-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td class="muted" colspan="4">Загрузка…</td></tr>';

  try{
    const r = await jget('/api/admin/events?type=admin_unmerge_manual&take=100&skip=0');
    const list = (r && (r.events || r.rows || r.list)) || [];
    const arr = Array.isArray(list) ? list : [];

    if (!arr.length){
      tbody.innerHTML = '<tr><td class="muted" colspan="4">Нет расклеек…</td></tr>';
      return;
    }

    const rows = arr.slice().sort((a,b)=>{
      const ta = new Date(a.created_at || a.ts || a.createdAt || 0).getTime();
      const tb = new Date(b.created_at || b.ts || b.createdAt || 0).getTime();
      return tb - ta;
    });

    tbody.innerHTML = '';
    for (const ev of rows){
      const p = ev.payload || {};
      const hum = escapeHtml(ev.hum_id ?? p.hum_id ?? '');
      const ids = p.user_ids || p.requested_ids || p.userIds || [];
      const reason = escapeHtml(p.reason || p.note || '');
      const t = fmtMsk(ev.created_at || ev.ts || ev.createdAt || Date.now());

      const idsTxt = (Array.isArray(ids) && ids.length) ? escapeHtml(ids.join(', ')) : '—';
      const humTxt = hum || '—';
      const reasonTxt = reason || '—';

      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="muted">${escapeHtml(t)}</td>
          <td>${humTxt}</td>
          <td class="mono">${idsTxt}</td>
          <td>${reasonTxt}</td>
        </tr>`);
    }

  }catch(e){
    tbody.innerHTML = `<tr><td class="muted" colspan="4">Ошибка: ${escapeHtml(e?.message || e)}</td></tr>`;
  }
}

async function applyUnmergeSelected(){
  const out = $('#unmerge-out');
  if (out) out.textContent = '...';

  const hum_id = Number(String($('#unmerge-hum')?.value || '').trim());
  const reason = String($('#unmerge-reason')?.value || '').trim();
  const ids = Array.from(document.querySelectorAll('.unmerge-chk:checked'))
    .map(x => Number(String(x.value || '').trim()))
    .filter(n => Number.isFinite(n) && n > 0);

  if (!Number.isFinite(hum_id) || hum_id <= 0) throw new Error('bad_hum_id');
  if (!ids.length) throw new Error('select_users');

  const r = await jpost('/api/admin/unmerge', { hum_id, user_ids: ids, reason });
  if (out) out.textContent = JSON.stringify(r, null, 2);

  // освежаем кластер и историю
  loadUnmergeCluster({ silent:true }).catch(()=>{});
  loadUnmergeHistory().catch(()=>{});
}

  function bindActions(){
    $('#refresh-finance')?.addEventListener('click', loadFinance);
    $('#refresh-users')?.addEventListener('click', loadUsers);
    $('#refresh-users-analytics')?.addEventListener('click', loadUsersAnalyticsDuels);
    $('#refresh-events')?.addEventListener('click', loadEvents);
    // Events search/paging
    $('#events-find')?.addEventListener('click', ()=>{
      _eventsSkip = 0;
      _eventsFilters = _readEventsFilters();
      loadEvents({ skip: 0, filters: _eventsFilters });
    });
    $('#events-clear')?.addEventListener('click', ()=>{
      const u = $('#events-user'); if (u) u.value = '';
      const t = $('#events-type'); if (t) t.value = '';
      const s = $('#events-term'); if (s) s.value = '';
      const d = $('#events-day');  if (d) d.value = '';
      _eventsSkip = 0;
      _eventsFilters = null;
      loadEvents({ skip: 0 });
    });
    $('#events-prev')?.addEventListener('click', ()=>{
      const next = Math.max(0, _eventsSkip - _eventsTake);
      loadEvents({ skip: next });
    });
    $('#events-next')?.addEventListener('click', ()=>{
      const next = _eventsSkip + _eventsTake;
      loadEvents({ skip: next });
    });
    ['#events-user','#events-type','#events-term','#events-day'].forEach(sel=>{
      $(sel)?.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter'){
          e.preventDefault();
          _eventsSkip = 0;
          _eventsFilters = _readEventsFilters();
          loadEvents({ skip: 0, filters: _eventsFilters });
        }
      });
    });

    $('#refresh-duels')?.addEventListener('click', ()=>loadDuels(true));
    // duels paging (server-side) + date filter
    $('#duels-prev')?.addEventListener('click', ()=>{
      _duelsSkip = Math.max(0, (_duelsSkip||0) - (_duelsTake||100));
      loadDuels(false);
    });
    $('#duels-next')?.addEventListener('click', ()=>{
      _duelsSkip = (_duelsSkip||0) + (_duelsTake||100);
      loadDuels(false);
    });
    $('#duels-day')?.addEventListener('change', ()=>loadDuels(true));
    $('#duels-filter')?.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter'){ e.preventDefault(); loadDuels(true); }
    });
    $('#duels-day')?.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter'){ e.preventDefault(); loadDuels(true); }
    });

    $('#refresh-events-mini')?.addEventListener('click', loadMiniEvents);
    $('#refresh-duels-mini')?.addEventListener('click', loadMiniDuels);
    $('#refresh-users-mini')?.addEventListener('click', loadMiniUsers);
    $('#refresh-topups-mini')?.addEventListener('click', ()=>loadMiniTopups(true).catch(()=>{}));

    $('#topup-reload')?.addEventListener('click', ()=>loadTopupHistory(true).catch(()=>{}));

    // duels filter/sort (client-side)
    $('#duels-filter')?.addEventListener('input', (e)=>{
      _duelsFilter = String(e?.target?.value || '');
      renderDuelsTable(_duelsRaw || []);
      loadDuels(true).catch(()=>{});
    });
    $('#duels-filter-clear')?.addEventListener('click', ()=>{
      _duelsFilter = '';
      try{ $('#duels-filter').value = ''; }catch(_){}
      renderDuelsTable(_duelsRaw || []);
    });
    document.querySelectorAll('#tbl-duels th[data-k]').forEach(th=>{
      th.addEventListener('click', ()=>{
        const k = th.getAttribute('data-k');
        if (!k) return;
        _duelsSortDir = (_duelsSortKey === k) ? -_duelsSortDir : -1;
        _duelsSortKey = k;
        renderDuelsTable(_duelsRaw || []);
      });
    });

    // filter (client-side)
    $('#topup-filter')?.addEventListener('input', (e)=>{
      _topupFilter = String(e?.target?.value || '');
      renderTopupHistory(_topupRawList || []);
    });
    $('#topup-filter-clear')?.addEventListener('click', ()=>{
      _topupFilter = '';
      try{ $('#topup-filter').value = ''; }catch(_){}
      renderTopupHistory(_topupRawList || []);
    });
    document.querySelectorAll('#tbl-topup th[data-k]').forEach(th=>{
      th.addEventListener('click', ()=>{
        const k = th.getAttribute('data-k');
        if (!k) return;
        const key =
          (k === 'user') ? 'user' :
          (k === 'amount') ? 'amount' :
          (k === 'comment') ? 'comment' :
          (k === 'admin') ? 'admin' :
          'created_at';
        _topupSortDir = (_topupSortKey === key) ? -_topupSortDir : -1;
        _topupSortKey = key;
        renderTopupHistory(_topupRawList || []);
      });
    });

    $('#topup-btn')?.addEventListener('click', async ()=>{
      const out = $('#topup-out');
      out.textContent = '...';
      try{
        const id = String($('#topup-user').value||'').trim();
        const amount = Number(String($('#topup-amount').value||'').trim());
        const comment = String($('#topup-comment').value||'').trim();
        if (!id || !Number.isFinite(amount) || !comment) throw new Error('bad_params');
        const r = await jpost(`/api/admin/users/${encodeURIComponent(id)}/topup`, { amount, comment });
        out.textContent = JSON.stringify(r, null, 2);
        loadSummary().catch(()=>{});
        loadTopupHistory().catch(()=>{});
        try{ $('#topup-amount').value = ''; $('#topup-comment').value = ''; }catch(_){ }
      }catch(e){
        out.textContent = 'ERROR: ' + (e?.message || e);
      }
    });

// Расклейка (порт из /admin/split)
$('#unmerge-load')?.addEventListener('click', async ()=>{
  const out = $('#unmerge-out');
  if (out) out.textContent = '...';
  try{
    await loadUnmergeCluster();
    // после загрузки покажем историю (на всякий)
    loadUnmergeHistory().catch(()=>{});
  }catch(e){
    if (out) out.textContent = 'ERROR: ' + (e?.message || e);
  }
});

$('#unmerge-btn')?.addEventListener('click', async ()=>{
  const out = $('#unmerge-out');
  try{
    await applyUnmergeSelected();
  }catch(e){
    if (out) out.textContent = 'ERROR: ' + (e?.message || e);
  }
});

$('#unmerge-history-refresh')?.addEventListener('click', ()=>{ loadUnmergeHistory(); });

$('#unmerge-all')?.addEventListener('change', (e)=>{
  const on = !!e?.target?.checked;
  document.querySelectorAll('.unmerge-chk').forEach(ch=>{ ch.checked = on; });
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
    bindSidebarCollapse();
    bindTopbar();
    bindActions();

    const { view, sub } = parseHash();
    gotoView(view, sub);

    // initial load for summary is handled in gotoView()
  }

  document.addEventListener('DOMContentLoaded', init);
})();