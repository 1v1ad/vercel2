// admin/user-card.js — user card (step 3: overview KPIs + last duels/events)
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);

  const state = {
    userId: null,
    tab: 'overview',
    events: { page: 1, limit: 50, total: 0, items: [], loading: false, filters: { type: '', period: 'all', from: '', to: '', term: '' } },
    duels:  { page: 1, limit: 50, total: 0, items: [], loading: false, error: '', filters: { status: '', stake: '', period: 'all', from: '', to: '', term: '' } },
    finance: { page: 1, limit: 20, total: 0, items: [], loading: false, error: '', kpi: null, filters: { type: '', status: '', period: '30', from: '', to: '' } },
    duel_profit: {
      key: '',
      a: { loading: false, error: '', days: [], totals: { profit: 0, duels: 0 }, title: 'Профит в дуэлях' },
      b: { loading: false, error: '', days: [], totals: { profit: 0, duels: 0 }, title: 'Профит в дуэлях', visible: false },
    },
    accounts: { loading: false, error: '', data: null }
  };

  function api(){
    const raw = (window.API || localStorage.getItem('ADMIN_API') || localStorage.getItem('admin_api') || '').toString().trim();
    return raw ? raw.replace(/\/+$/,'') : location.origin;
  }

  // Prevent silent prefetch (finance tab) from blocking Accounts tab UI fetch.
  let accountsPromise = null;


  // --- Duel profit charts (finance tab) ---
  function profitDom(which){
    return {
      block: document.getElementById(`uc-profit-block-${which}`),
      title: document.getElementById(`uc-profit-title-${which}`),
      svg:   document.getElementById(`uc-profit-chart-${which}`),
      tip:   document.getElementById(`uc-profit-tip-${which}`),
      kpis:  document.getElementById(`uc-profit-kpis-${which}`),
    };
  }

  async function ensureAccountsDataSilent(){
    const userId = state.userId;
    if (!userId) return null;
    if (state.accounts.data) return state.accounts.data;
    if (accountsPromise) return accountsPromise;

    accountsPromise = (async ()=>{
      try{
        const url = api() + `/api/admin/user-card/accounts?user_id=${encodeURIComponent(userId)}`;
        const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
        const j = await r.json().catch(()=>({ ok:false, error:'bad json' }));
        if (!r.ok || !j || !j.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        state.accounts.data = j;
        return j;
      }catch(e){
        state.accounts.error = String(e?.message || e || 'Ошибка');
        return null;
      }finally{
        accountsPromise = null;
      }
    })();

    return accountsPromise;
  }

  function pickDeviceGroupUserIds(acc, userId){
    const groups = Array.isArray(acc?.device_family) ? acc.device_family : [];
    const uid = Number(userId);
    for (const g of groups){
      const ids = (Array.isArray(g.user_ids) ? g.user_ids : []).map(Number).filter(Boolean);
      if (ids.includes(uid) && ids.length > 1) {
        return { user_ids: ids, device_id: g.device_id || '' };
      }
    }
    return null;
  }

  async function loadDuelProfit(key){
    const userId = state.userId;
    if (!userId) return;
    const f = state.finance.filters || {};
    if (key) state.duel_profit.key = key;

    // decide which charts to show
    const acc = await ensureAccountsDataSilent();
    const fam = Array.isArray(acc?.family) ? acc.family : [];
    const hasHumFamily = fam.length > 1;
    const devPick = (!hasHumFamily && acc) ? pickDeviceGroupUserIds(acc, userId) : null;

    const planA = hasHumFamily
      ? { title: 'Общий профит (HUM‑семья)', scope: 'hum', user_ids: null }
      : (devPick
        ? { title: `Профит (user_id #${userId})`, scope: 'user', user_ids: null }
        : { title: 'Профит в дуэлях', scope: 'user', user_ids: null });

    const planB = hasHumFamily
      ? { title: `Профит (user_id #${userId})`, scope: 'user', user_ids: null }
      : (devPick ? { title: `Общий профит по устройству (${shortDevice(devPick.device_id)})`, scope: 'ids', user_ids: devPick.user_ids } : null);

    // show/hide blocks + titles
    const A = profitDom('a');
    const B = profitDom('b');
    if (A?.title) A.title.textContent = planA.title;
    if (A?.block) A.block.classList.remove('uc-hide');

    state.duel_profit.a.title = planA.title;
    state.duel_profit.b.visible = Boolean(planB);

    if (planB){
      if (B?.title) B.title.textContent = planB.title;
      if (B?.block) B.block.classList.remove('uc-hide');
      state.duel_profit.b.title = planB.title;
    } else {
      if (B?.block) B.block.classList.add('uc-hide');
      state.duel_profit.b.loading = false;
      state.duel_profit.b.error = '';
      state.duel_profit.b.days = [];
      state.duel_profit.b.totals = { profit: 0, duels: 0 };
      renderDuelProfitBlock('b');
    }

    // load charts (A always, B conditionally)
    await Promise.all([
      loadDuelProfitOne('a', planA, f),
      planB ? loadDuelProfitOne('b', planB, f) : Promise.resolve(),
    ]);
  }

  async function loadDuelProfitOne(which, plan, f){
    const userId = state.userId;
    if (!userId) return;
    const st = state.duel_profit[which];
    if (!st) return;

    st.loading = true;
    st.error = '';
    renderDuelProfitBlock(which);

    const qs = new URLSearchParams();
    qs.set('user_id', userId);
    if (plan.scope === 'hum') qs.set('scope', 'hum');
    else qs.set('scope', 'user');
    if (Array.isArray(plan.user_ids) && plan.user_ids.length) {
      qs.set('user_ids', plan.user_ids.join(','));
    }
    if (f.from) qs.set('from', f.from);
    if (f.to) qs.set('to', f.to);

    const url = `${api()}/api/admin/user-card/duel-profit?${qs.toString()}`;
    try{
      const r = await fetch(url, { headers: window.adminHeaders ? window.adminHeaders() : headers() });
      const j = await r.json().catch(()=>({ ok:false, error:'bad json' }));
      if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));

      st.loading = false;
      st.days = Array.isArray(j.days) ? j.days : [];
      st.totals = j.totals || { profit: 0, duels: 0 };
      renderDuelProfitBlock(which);
    }catch(err){
      st.loading = false;
      st.error = (err && err.message) ? err.message : String(err || 'error');
      st.days = [];
      st.totals = { profit: 0, duels: 0 };
      renderDuelProfitBlock(which);
    }
  }

  function shortDevice(deviceId){
    const s = String(deviceId || '').trim();
    if (!s) return 'device';
    if (s.length <= 12) return s;
    return s.slice(0, 6) + '…' + s.slice(-4);
  }

  function renderDuelProfit(){
    renderDuelProfitBlock('a');
    renderDuelProfitBlock('b');
  }

  function renderDuelProfitBlock(which){
    const st = state.duel_profit[which];
    const { svg, tip, kpis } = profitDom(which);
    if (!svg || !st) return;

    const wrap = svg.parentElement;
    const clearTip = ()=>{
      if (!tip) return;
      tip.classList.remove('show');
      tip.style.transform = 'translate(-9999px,-9999px)';
      tip.innerHTML = '';
    };

    svg.innerHTML = '';
    svg.onmousemove = null;
    svg.onmouseleave = null;
    clearTip();

    const svgEl = (tag, attrs={})=>{
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      return el;
    };

    const msg = (text)=>{
      const t = svgEl('text', { x: 260, y: 90, 'text-anchor':'middle', class:'uc-profit-axis' });
      t.textContent = text;
      svg.appendChild(t);
    };

    if (st.loading){
      if (kpis) kpis.textContent = 'Загрузка профита…';
      msg('Загрузка…');
      return;
    }
    if (st.error){
      if (kpis) kpis.textContent = 'Ошибка: ' + st.error;
      msg('Ошибка');
      return;
    }

    const rows = Array.isArray(st.days) ? st.days : [];
    if (!rows.length){
      if (kpis) kpis.textContent = 'Нет дуэлей за выбранный период.';
      msg('Нет данных');
      return;
    }

    const days = rows.map(r => String(r.day||''));
    const pDay = rows.map(r => Number(r.profit_day||0));
    const pCum = rows.map(r => Number(r.profit_cum||0));
    const dCount = rows.map(r => Number(r.duels||0));

    const totalProfit = Number(st.totals?.profit ?? (pCum[pCum.length-1]||0));
    const totalDuels = Number(st.totals?.duels ?? dCount.reduce((a,b)=>a+b,0));
    if (kpis) kpis.innerHTML = `Итого: <b>${esc(fmtMoney(totalProfit))}</b> · Дуэлей: <b>${esc(fmtInt(totalDuels))}</b>`;

    const n = pCum.length;
    const W = 520, H = 180;
    const M = { l: 44, r: 10, t: 10, b: 24 };
    const PW = W - M.l - M.r;
    const PH = H - M.t - M.b;

    const minV = Math.min(0, ...pCum);
    const maxV = Math.max(0, ...pCum);
    let span = maxV - minV;
    if (span === 0) span = 1;

    const niceStep = (raw)=>{
      const p = Math.pow(10, Math.floor(Math.log10(raw)));
      const x = raw / p;
      const m = x <= 1 ? 1 : x <= 2 ? 2 : x <= 5 ? 5 : 10;
      return m * p;
    };

    const step = niceStep(span / 4);
    let y0 = Math.floor(minV / step) * step;
    let y1 = Math.ceil(maxV / step) * step;
    if (y0 > 0) y0 = 0;
    if (y1 < 0) y1 = 0;
    if (y0 === y1) { y0 -= step; y1 += step; }

    const y = (v)=> M.t + (y1 - v) / (y1 - y0) * PH;
    const x = (i)=> {
      if (n === 1) return M.l + PW/2;
      return M.l + (i / (n - 1)) * PW;
    };

    // y-grid + axis labels
    for (let vv = y0; vv <= y1 + step/2; vv += step){
      const yy = y(vv);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: yy, y2: yy, class:'uc-profit-grid' }));
      const txt = svgEl('text', { x: 4, y: yy, class:'uc-profit-axis' });
      txt.textContent = nf0.format(Math.trunc(vv));
      svg.appendChild(txt);
    }
    // zero line
    const yZero = y(0);
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: yZero, y2: yZero, class:'uc-profit-zero' }));

    // bars: duels count
    const maxD = Math.max(1, ...dCount);
    const barMaxH = Math.min(38, PH * 0.28);
    const bw = Math.max(0.7, (PW / Math.max(1, n)) * 0.92);
    for (let i=0;i<n;i++){
      const h = (dCount[i] / maxD) * barMaxH;
      const xx = x(i);
      const rect = svgEl('rect', { x: xx - bw/2, y: (M.t + PH) - h, width: bw, height: h, rx: 1.2, class:'uc-profit-bar' });
      svg.appendChild(rect);
    }

    // line: cumulative profit
    const pts = pCum.map((v,i)=>`${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    svg.appendChild(svgEl('polyline', { points: pts, class:'uc-profit-line' }));

    // points for hover target
    for (let i=0;i<n;i++){
      const c = svgEl('circle', { cx: x(i), cy: y(pCum[i]), r: 1.8, class:'uc-profit-point' });
      svg.appendChild(c);
    }

    // x labels (few)
    const labelIdx = (()=>{
      if (n <= 1) return [0];
      if (n <= 6) return [...Array(n).keys()];
      const a = [0, Math.round((n-1)*0.25), Math.round((n-1)*0.5), Math.round((n-1)*0.75), n-1];
      return Array.from(new Set(a)).sort((a,b)=>a-b);
    })();
    for (const i of labelIdx){
      const dd = days[i];
      const lbl = dd ? dd.slice(5) : '';
      const t = svgEl('text', { x: x(i), y: H - 6, 'text-anchor':'middle', class:'uc-profit-axis' });
      t.textContent = lbl;
      svg.appendChild(t);
    }

    const hoverLine = svgEl('line', { x1: -10, x2: -10, y1: M.t, y2: M.t + PH, class:'uc-profit-hoverline' });
    svg.appendChild(hoverLine);

    const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));

    svg.onmousemove = (e)=>{
      const rect = svg.getBoundingClientRect();
      const px = clamp(e.clientX - rect.left, 0, rect.width);
      const t = rect.width ? (px / rect.width) : 0;
      const idx = clamp(Math.round(t * (n - 1)), 0, n - 1);

      const xx = x(idx);
      hoverLine.setAttribute('x1', xx);
      hoverLine.setAttribute('x2', xx);

      if (tip && wrap){
        const day = days[idx];
        const cum = pCum[idx];
        const pd = pDay[idx];
        const dc = dCount[idx];
        const pdSign = pd > 0 ? '+' : '';
        const cumSign = cum > 0 ? '+' : '';
        tip.innerHTML = `
          <div class="mono">${esc(day)}</div>
          <div>Кумулятивно: <b>${esc(cumSign + nf0.format(Math.trunc(cum)))} ₽</b></div>
          <div>За день: ${esc(pdSign + nf0.format(Math.trunc(pd)))} ₽</div>
          <div>Дуэлей: ${esc(fmtInt(dc))}</div>
        `;
        tip.classList.add('show');

        const wr = wrap.getBoundingClientRect();
        const xTip = clamp((e.clientX - wr.left) + 12, 8, wr.width - 220);
        const yTip = clamp((e.clientY - wr.top) - 12, 8, wr.height - 96);
        tip.style.transform = `translate(${xTip}px, ${yTip}px)`;
      }
    };

    svg.onmouseleave = ()=>{
      hoverLine.setAttribute('x1', -10);
      hoverLine.setAttribute('x2', -10);
      clearTip();
    };
  }

  function scope(){
    return (localStorage.getItem('ADMIN_INCLUDE_HUM') === '1') ? 'hum' : 'user';
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  const nf0 = new Intl.NumberFormat('ru-RU');
  function fmtInt(n){
    const v = Number(n);
    return Number.isFinite(v) ? nf0.format(Math.trunc(v)) : '—';
  }

  function toInt(v, def=0){
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
  }

  function fmtMoney(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return nf0.format(Math.trunc(v)) + ' ₽';
  }

  function fmt$(n){
    return fmtMoney(n);
  }


  function prettyTs(v){
    const s = (v ?? '').toString();
    if (!s) return '—';
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
    return m ? `${m[1]} ${m[2]}` : esc(s);
  }

  function fmtTs(v){
    return prettyTs(v);
  }

  function fmtProvider(p){
    const v = (p||'').toString().toLowerCase();
    if (!v) return '—';
    if (v === 'vk') return 'VK';
    if (v === 'tg' || v === 'telegram') return 'TG';
    return v.toUpperCase();
  }

  function deviceFromUA(ua){
    const s = (ua||'').toString();
    if (!s) return { os:'—', client:'—', type:'—' };

    const lower = s.toLowerCase();

    // OS
    let os = '—';
    if (lower.includes('windows')) os = 'Windows';
    else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
    else if (lower.includes('android')) os = 'Android';
    else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) os = 'iOS';
    else if (lower.includes('linux')) os = 'Linux';

    // Client / container
    let client = 'Browser';
    if (lower.includes('telegram')) client = 'Telegram WebView';
    else if (lower.includes('yabrowser')) client = 'Yandex Browser';
    else if (lower.includes('edg/')) client = 'Edge';
    else if (lower.includes('chrome/')) client = 'Chrome';
    else if (lower.includes('safari/') && !lower.includes('chrome/')) client = 'Safari';
    else if (lower.includes('firefox/')) client = 'Firefox';

    // Device type
    let type = 'Desktop';
    if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) type = 'Mobile';
    if (lower.includes('ipad') || lower.includes('tablet')) type = 'Tablet';

    return { os, client, type };
  }

  function badge(label, kind=''){
    return `<span class="uc-badge ${kind}">${esc(label)}</span>`;
  }

  function chip(label, valueHtml){
    return `<div class="uc-chip"><span class="uc-chip-l">${esc(label)}</span><span class="uc-chip-v">${valueHtml ?? '—'}</span></div>`;
  }

  function summarizeEvent(ev){
    if (!ev || !ev.event_type) return '—';
    const t = String(ev.event_type);
    const amt = (ev.amount != null && ev.amount !== '') ? ` · ${fmtMoney(ev.amount)}` : '';
    return esc(t) + amt;
  }

  function tinyName(first, last){
    const fn = (first||'').toString().trim();
    const ln = (last||'').toString().trim();
    const full = [fn, ln].filter(Boolean).join(' ').trim();
    return full || '—';
  }

  async function load(){
    const qs = new URLSearchParams(location.search);
    const userId = (qs.get('user_id') || qs.get('id') || '').toString().trim();
    state.userId = userId || null;

    const topRight = $('#uc-top-right');
    if (topRight) topRight.textContent = userId ? `user_id: ${userId}` : '';

    if (!userId) {
      const links = $('#uc-links');
      if (links) links.textContent = 'Не указан user_id в URL.';
      return;
    }

    const url = api() + `/api/admin/user-card?user_id=${encodeURIComponent(userId)}&scope=${encodeURIComponent(scope())}`;

    let j = null;
    try{
      const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
      j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
    }catch(e){
      const msg = 'Ошибка загрузки карточки: ' + String(e?.message || e);
      const links = $('#uc-links');
      if (links) links.textContent = msg;
      return;
    }

    render(j);

    // if user already switched to a secondary tab — keep it alive after reload
    if (state.tab === 'events') {
      loadEvents(state.events.page || 1);
    }
  }

  function initTabs(){
    const tabs = document.getElementById('uc-tabs');
    if (!tabs) return;
    tabs.addEventListener('click', (e)=>{
      const btn = e.target?.closest?.('.uc-tab');
      if (!btn) return;
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;
      setTab(tab);
    });

    // HUM toggle should refresh current tab (потому что scope меняется)
    window.addEventListener('adminHumToggle', ()=>{
      try { load(); } catch(_){ }
      if (state.tab === 'events') {
        try { loadEvents(1); } catch(_){ }
      } else if (state.tab === 'duels') {
        try { loadDuels(1); } catch(_){ }
      } else if (state.tab === 'finance') {
        try { loadFinance(1); } catch(_){ }
      } else if (state.tab === 'accounts') {
        try { loadAccounts(); } catch(_){ }
      }
    });
  }

  function setTab(tab){
    state.tab = tab;

    // buttons
    const btns = document.querySelectorAll('#uc-tabs .uc-tab');
    btns.forEach(b=>{
      const t = b.getAttribute('data-tab');
      if (!t) return;
      b.classList.toggle('is-active', t === tab);
    });

    // panels
    const panels = [
      { id:'uc-panel-overview', tab:'overview' },
      { id:'uc-panel-accounts', tab:'accounts' },
      { id:'uc-panel-duels', tab:'duels' },
      { id:'uc-panel-events', tab:'events' },
      { id:'uc-panel-finance', tab:'finance' },
    ];
    panels.forEach(p=>{
      const el = document.getElementById(p.id);
      if (!el) return;
      el.classList.toggle('is-active', p.tab === tab);
    });

    if (tab === 'events') {
      loadEvents(1);
    } else if (tab === 'duels') {
      loadDuels(1);
    } else if (tab === 'finance') {
      loadFinance(1);
    } else if (tab === 'accounts') {
      loadAccounts();
    }
  }

  function shortUA(ua){
    const s = (ua||'').toString();
    if (!s) return '—';
    return s.length > 80 ? (s.slice(0, 77) + '…') : s;
  }

  function shortPayload(p){
    if (p == null) return '';
    let s = '';
    try{
      s = (typeof p === 'string') ? p : JSON.stringify(p);
    }catch(_){
      s = String(p);
    }
    s = s.replace(/\s+/g,' ').trim();
    return s.length > 140 ? (s.slice(0, 137) + '…') : s;
  }

  
  async function loadAccounts(){
    const userId = state.userId;
    if (!userId) return;

    const userBox = document.getElementById('uc-accounts-user');
    const authBox = document.getElementById('uc-accounts-auth');
    const famBox  = document.getElementById('uc-accounts-family');
    const devBox  = document.getElementById('uc-accounts-device-family');
    const reloadBtn = document.getElementById('uc-accounts-reload');

    if (reloadBtn && !reloadBtn.__ucWired){
      reloadBtn.__ucWired = true;
      reloadBtn.addEventListener('click', ()=> loadAccounts());
    }

    if (state.accounts.loading) return;
    state.accounts.loading = true;
    state.accounts.error = '';

    if (userBox) userBox.textContent = 'Загрузка…';
    if (authBox) authBox.innerHTML = '';
    if (famBox) famBox.textContent = 'Загрузка…';
    if (devBox) devBox.textContent = 'Загрузка…';

    const url = api() + `/api/admin/user-card/accounts?user_id=${encodeURIComponent(userId)}`;
    let j = null;

    try{
      const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
      j = await r.json();
      if (!r.ok || !j || !j.ok) {
        const msg = (j && (j.error || j.message)) ? String(j.error || j.message) : `HTTP ${r.status}`;
        throw new Error(msg);
      }
    }catch(e){
      state.accounts.loading = false;
      state.accounts.error = String(e?.message || e || 'Ошибка');
      if (userBox) userBox.innerHTML = `<div class="muted">Ошибка загрузки</div><div class="mono">${esc(state.accounts.error)}</div>`;
      if (famBox) famBox.innerHTML = `<div class="muted">—</div>`;
      if (devBox) devBox.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    state.accounts.loading = false;
    state.accounts.data = j;
    renderAccounts(j);
  }

  function renderAccounts(j){
    const userId = state.userId;
    const userBox = document.getElementById('uc-accounts-user');
    const authBox = document.getElementById('uc-accounts-auth');
    const famBox  = document.getElementById('uc-accounts-family');
    const devBox  = document.getElementById('uc-accounts-device-family');
    if (!userBox || !authBox || !famBox || !devBox) return;

    const u = j.user || {};
    const familyAll = Array.isArray(j.family) ? j.family : [];
    const family = familyAll.filter(m => String(m && m.id) !== String((u && u.id)!=null ? u.id : userId));
    const primaryId = (j.primary_user_id != null) ? String(j.primary_user_id) : '';
    const humId = (j.hum_id != null) ? String(j.hum_id) : '';

    const ava = u.avatar_url || u.avatar || u.avatarUrl || '';
    const name = tinyName(u.first_name || u.firstName, u.last_name || u.lastName);
    const idStr = (u.id != null) ? String(u.id) : (userId || '—');

    const isPrimary = primaryId && (String(idStr) === String(primaryId));
    const roleTag = isPrimary ? tag('primary','primary') : tag('alt','alt');
    const proofTag = u.merged_via_proof ? tag('proof','proof') : '';

    userBox.innerHTML = `
      <div class="uc-acc-user">
        ${ava ? `<img class="uc-acc-ava" src="${esc(ava)}" alt="">` : `<div class="uc-acc-ava uc-acc-ava--ph"></div>`}
        <div class="uc-acc-main">
          <div class="uc-acc-name">${esc(name)} <span class="muted">#${esc(idStr)}</span></div>
          <div class="uc-acc-meta mono">
            hum_id: ${esc(humId || '—')} · primary_user_id: ${esc(primaryId || '—')}
          </div>
          <div class="uc-tags">${roleTag}${proofTag}${(String(userId)===String(idStr)) ? tag('current','current') : ''}</div>
        </div>
      </div>

      <div class="uc-kv">
        ${kv('vk_id', u.vk_id)}
        ${kv('first_name', u.first_name)}
        ${kv('last_name', u.last_name)}
        ${kv('balance', (u.balance != null) ? fmtMoney(u.balance) : '—')}
        ${kv('created_at', u.created_at ? fmtTs(u.created_at) : '—')}
        ${kv('updated_at', u.updated_at ? fmtTs(u.updated_at) : '—')}
      </div>
    `;

    // auth accounts pills
    const ua = Array.isArray(u.auth_accounts) ? u.auth_accounts : [];
    authBox.innerHTML = renderAuthPills(ua);

    // family cards (показываем только ДРУГИЕ аккаунты из HUM-семьи — текущий уже слева)
    if (!family.length){
      const total = familyAll.length || 0;
      famBox.innerHTML = `<div class="muted">В HUM-семье нет других аккаунтов (всего: ${total}).</div>`;
    } else {
      famBox.innerHTML = family.map(m=>{
      const mid = (m.id != null) ? String(m.id) : '';
      const mAva = m.avatar_url || m.avatar || '';
      const mName = tinyName(m.first_name, m.last_name);
      const mIsPrimary = primaryId && (String(mid) === String(primaryId));
      const mRole = mIsPrimary ? tag('primary','primary') : tag('alt','alt');
      const mProof = m.merged_via_proof ? tag('proof','proof') : '';
      const mCur = (String(mid) === String(userId)) ? tag('current','current') : '';
      const mHum = (m.hum_id != null) ? String(m.hum_id) : '';
      const metaBits = [];
      metaBits.push(`#${mid}`);
      if (mHum) metaBits.push(`hum:${mHum}`);
      const prov = summarizeProviders(m.auth_accounts);
      if (prov) metaBits.push(prov);
      return `
        <a class="uc-family-card" href="user-card.html?user_id=${encodeURIComponent(mid)}" title="Открыть user_id ${esc(mid)}">
          ${mAva ? `<img class="uc-family-ava" src="${esc(mAva)}" alt="">` : `<div class="uc-family-ava uc-family-ava--ph"></div>`}
          <div class="uc-family-main">
            <div class="uc-family-name">${esc(mName)}</div>
            <div class="uc-family-meta mono">${esc(metaBits.join(' · '))}</div>
          </div>
          <div class="uc-tags uc-tags--right">${mRole}${mProof}${mCur}</div>
        </a>
      `;
      }).join('');
    }

    // device-family (связи по device_id из auth_accounts.meta)
    const groups = Array.isArray(j.device_family) ? j.device_family : (Array.isArray(j.deviceFamily) ? j.deviceFamily : []);
    devBox.innerHTML = renderDeviceFamily(groups, userId);
  }

  function renderDeviceFamily(groups, userId){
    if (!Array.isArray(groups) || groups.length === 0){
      return `<div class="muted">Нет связей по устройству.</div>`;
    }

    const curId = String(userId);

    const wrap = groups.map(g => {
      const deviceId = (g.device_id || g.deviceId || '').toString();
      const short = shortDevice(deviceId);

      // supported formats:
      // 1) g.members: [{id, first_name, last_name, avatar_url, auth_accounts, ...}]
      // 2) g.users: same
      // 3) g.user_ids: [97,1]
      const members = Array.isArray(g.members) ? g.members : (Array.isArray(g.users) ? g.users : []);
      const idsRaw = Array.isArray(g.user_ids) ? g.user_ids.map(String)
        : (Array.isArray(g.userIds) ? g.userIds.map(String) : members.map(m => String(m && m.id)));

      const ids = Array.from(new Set(idsRaw.filter(Boolean)));
      ids.sort((a,b)=>(Number(a)||0)-(Number(b)||0));

      const usersStr = ids.length ? ids.map(id=>`#${id}`).join(', ') : '—';
      const pillText = `device_id: ${short} · users: ${usersStr}`;

      const head = `
        <div class="uc-device-head">
          <div class="uc-pill uc-device-pill mono" title="${esc(deviceId)}">${esc(pillText)}</div>
        </div>
      `;

      let body = '';
      if (members.length){
        const otherMembers = members.filter(m => String(m && m.id) !== curId);
        body = otherMembers.length
          ? `<div class="uc-device-body"><div class="uc-device-members">${otherMembers.map(m => renderDeviceMember(m)).join('')}</div></div>`
          : `<div class="uc-device-body"><div class="muted">В этой группе нет теневых аккаунтов.</div></div>`;
      } else {
        const otherIds = ids.filter(id => id !== curId);
        body = otherIds.length
          ? `<div class="uc-device-body"><div class="uc-device-members">${otherIds.map(id => renderDeviceMember({ id })).join('')}</div></div>`
          : `<div class="uc-device-body"><div class="muted">В этой группе нет теневых аккаунтов.</div></div>`;
      }

      return `<div class="uc-device-group">${head}${body}</div>`;
    }).join('');

    return `<div class="uc-device-list">${wrap}</div>`;
  }

  function renderDeviceMember(m){
    const id = (m && m.id != null) ? String(m.id) : '';
    const ava = (m && (m.avatar_url || m.avatar || m.avatarUrl)) ? String(m.avatar_url || m.avatar || m.avatarUrl) : '';
    const name = tinyName(m && (m.first_name || m.firstName), m && (m.last_name || m.lastName));
    const prov = summarizeProviders(m && m.auth_accounts);
    const meta = [id ? `#${id}` : ''];
    if (prov) meta.push(prov);
    return `
      <a class="uc-family-card" href="user-card.html?user_id=${encodeURIComponent(id)}" title="Открыть user_id ${esc(id)}">
        ${ava ? `<img class="uc-family-ava" src="${esc(ava)}" alt="">` : `<div class="uc-family-ava uc-family-ava--ph"></div>`}
        <div class="uc-family-main">
          <div class="uc-family-name">${esc(name || ('user ' + id))}</div>
          <div class="uc-family-meta mono">${esc(meta.filter(Boolean).join(' · '))}</div>
        </div>
      </a>
    `;
  }

  function shortDevice(id){
    const s = (id || '').toString();
    if (s.length <= 14) return s || '—';
    return `${s.slice(0,8)}…${s.slice(-4)}`;
  }

  function tag(text, cls){
    return `<span class="uc-tag ${esc(cls||'')}">${esc(text)}</span>`;
  }

  function kv(k, v){
    const val = (v == null || v === '') ? '—' : String(v);
    return `<div class="k">${esc(k)}</div><div class="v mono">${esc(val)}</div>`;
  }

  function renderAuthPills(list){
    if (!Array.isArray(list) || list.length === 0){
      return `<div class="muted">—</div>`;
    }
    return list.map(a=>{
      const p = (a.provider || '').toString();
      const pid = (a.provider_user_id || a.providerUserId || '').toString();
      const when = a.created_at ? ` · ${fmtTs(a.created_at)}` : '';
      return `<div class="uc-auth-pill"><span class="uc-auth-prov">${esc(p || '—')}</span><span class="uc-auth-id mono">${esc(pid || '—')}</span><span class="uc-auth-when muted">${esc(when)}</span></div>`;
    }).join('');
  }

  function summarizeProviders(list){
    if (!Array.isArray(list) || list.length === 0) return '';
    // show first 2 providers
    const parts = [];
    for (const a of list){
      const p = (a.provider || '').toString().trim();
      const pid = (a.provider_user_id || '').toString().trim();
      if (!p && !pid) continue;
      parts.push(pid ? `${p}:${pid}` : p);
      if (parts.length >= 2) break;
    }
    return parts.join(', ');
  }
async function loadEvents(page){
    const userId = state.userId;
    if (!userId) return;

    const prevBtn = document.getElementById('uc-events-prev');
    const nextBtn = document.getElementById('uc-events-next');
    const reloadBtn = document.getElementById('uc-events-reload');

    const typeSel  = document.getElementById('uc-events-filter-type');
        const periodSel= document.getElementById('uc-events-filter-period');
        const fromInp  = document.getElementById('uc-events-filter-from');
        const toInp    = document.getElementById('uc-events-filter-to');
        const termInp  = document.getElementById('uc-events-filter-term');
        const applyBtn = document.getElementById('uc-events-filter-apply');
        const resetBtn = document.getElementById('uc-events-filter-reset');
    
        const pad2 = (n) => String(n).padStart(2,'0');
        const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

        function show(el, on){
          if (!el) return;
          el.classList.toggle('uc-hide', !on);
        }
    
        function setPeriodQuick(days){
          const f = state.events.filters;
          if (!days){
            f.from = '';
            f.to = '';
            if (fromInp) fromInp.value = '';
            if (toInp) toInp.value = '';
            return;
          }
          const dTo = new Date();
          const dFrom = new Date();
          dFrom.setDate(dFrom.getDate() - Number(days));
          const from = ymdLocal(dFrom);
          const to = ymdLocal(dTo);
          f.from = from;
          f.to = to;
          if (fromInp) fromInp.value = from;
          if (toInp) toInp.value = to;
        }
    
        function ensureTypeOptions(items){
          if (!typeSel) return;
          const existing = new Set(Array.from(typeSel.options).map(o=>o.value));
          const types = Array.from(new Set((items||[]).map(x=>String(x.event_type||x.type||'').trim()).filter(Boolean))).slice(0,50);
          for (const t of types){
            if (existing.has(t)) continue;
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            typeSel.appendChild(opt);
            existing.add(t);
          }
        }
    

    // wire buttons once
    if (prevBtn && !prevBtn.__ucWired){
      prevBtn.__ucWired = true;
      prevBtn.addEventListener('click', ()=> loadEvents(Math.max(1, (state.events.page||1) - 1)));
    }
    if (nextBtn && !nextBtn.__ucWired){
      nextBtn.__ucWired = true;
      nextBtn.addEventListener('click', ()=> loadEvents((state.events.page||1) + 1));
    }
    if (reloadBtn && !reloadBtn.__ucWired){
      reloadBtn.__ucWired = true;
      reloadBtn.addEventListener('click', ()=> loadEvents(state.events.page||1));
    }


        // wire filters once
        const f = state.events.filters || (state.events.filters = { type:'', period:'all', from:'', to:'', term:'' });
    
        if (typeSel && !typeSel.__ucWired){
          typeSel.__ucWired = true;
          typeSel.addEventListener('change', ()=>{ f.type = (typeSel.value||'').trim(); });
        }
    
        if (periodSel && !periodSel.__ucWired){
          periodSel.__ucWired = true;
          periodSel.addEventListener('change', ()=>{
            const v = (periodSel.value||'all').toString();
            f.period = v;
            if (v === 'custom'){
              show(fromInp, true);
              show(toInp, true);
              return;
            }
            show(fromInp, false);
            show(toInp, false);
            if (v === 'all'){
              setPeriodQuick(null);
            } else {
              setPeriodQuick(v);
            }
          });
        }
    
        if (fromInp && !fromInp.__ucWired){
          fromInp.__ucWired = true;
          fromInp.addEventListener('change', ()=>{ f.from = (fromInp.value||'').trim(); });
        }
        if (toInp && !toInp.__ucWired){
          toInp.__ucWired = true;
          toInp.addEventListener('change', ()=>{ f.to = (toInp.value||'').trim(); });
        }
    
        if (applyBtn && !applyBtn.__ucWired){
          applyBtn.__ucWired = true;
          applyBtn.addEventListener('click', ()=>{
            f.type = (typeSel?.value||'').trim();
            f.period = (periodSel?.value||'all').toString();
            f.from = (fromInp?.value||'').trim();
            f.to = (toInp?.value||'').trim();
            f.term = (termInp?.value||'').trim();
            loadEvents(1);
          });
        }
    
        if (resetBtn && !resetBtn.__ucWired){
          resetBtn.__ucWired = true;
          resetBtn.addEventListener('click', ()=>{
            f.type = '';
            f.period = 'all';
            f.from = '';
            f.to = '';
            f.term = '';
            if (typeSel) typeSel.value = '';
            if (periodSel) periodSel.value = 'all';
            if (termInp) termInp.value = '';
            if (fromInp) fromInp.value = '';
            if (toInp) toInp.value = '';
            show(fromInp, false);
            show(toInp, false);
            loadEvents(1);
          });
        }
    
        if (termInp && !termInp.__ucWired){
          termInp.__ucWired = true;
          termInp.addEventListener('keydown', (e)=>{
            if (e.key === 'Enter'){
              e.preventDefault();
              applyBtn?.click();
            }
          });
        }
    
        // sync UI from state on each open
        if (typeSel) typeSel.value = f.type || '';
        if (periodSel) periodSel.value = f.period || 'all';
        if (termInp && termInp.value !== (f.term||'')) termInp.value = f.term||'';
        if (fromInp) fromInp.value = f.from || '';
        if (toInp) toInp.value = f.to || '';
        if ((f.period||'all') === 'custom'){
          show(fromInp, true); show(toInp, true);
        } else {
          show(fromInp, false); show(toInp, false);
        }
    

    state.events.loading = true;
    state.events.page = page;
    renderEvents();

    let url = api() + `/api/admin/user-card/events?user_id=${encodeURIComponent(userId)}`
      + `&scope=${encodeURIComponent(scope())}`
      + `&page=${encodeURIComponent(page)}`
      + `&limit=${encodeURIComponent(state.events.limit)}`;

    if (f.type) url += `&type=${encodeURIComponent(f.type)}`;
    if (f.term) url += `&term=${encodeURIComponent(f.term)}`;
    if (f.from) url += `&from=${encodeURIComponent(f.from)}`;
    if (f.to)   url += `&to=${encodeURIComponent(f.to)}`;

    try{
      const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      state.events.items = Array.isArray(j.items) ? j.items : [];
      ensureTypeOptions(state.events.items);

      state.events.total = Number(j.total || 0);
      state.events.limit = Number(j.limit || state.events.limit);
      state.events.page  = Number(j.page || page);
    }catch(e){
      state.events.items = [];
      state.events.total = 0;
      state.events.error = String(e?.message || e);
    }finally{
      state.events.loading = false;
      renderEvents();
    }
  }

  function renderEvents(){
    const statusEl = document.getElementById('uc-events-status');
    const pageEl   = document.getElementById('uc-events-page');
    const prevBtn  = document.getElementById('uc-events-prev');
    const nextBtn  = document.getElementById('uc-events-next');

    const tbl = document.getElementById('uc-events-table');
    const tbody = tbl?.querySelector('tbody');

    const { page, limit, total, items, loading } = state.events;

    const start = total ? ((page - 1) * limit + 1) : 0;
    const end   = Math.min(page * limit, total || 0);

    if (statusEl){
      if (loading) statusEl.textContent = 'Загрузка…';
      else if (state.events.error) statusEl.textContent = `Ошибка: ${state.events.error}`;
      else statusEl.textContent = total ? `Показано ${start}–${end} из ${total}` : 'Нет данных';
    }

    if (pageEl){
      const pages = total ? Math.max(1, Math.ceil(total / limit)) : 1;
      pageEl.textContent = `${page} / ${pages}`;
    }
    if (prevBtn) prevBtn.disabled = loading || page <= 1;
    if (nextBtn) nextBtn.disabled = loading || (total ? (page * limit >= total) : true);

    if (!tbody) return;
    if (loading){
      tbody.innerHTML = `<tr><td class="muted" colspan="6">Загрузка…</td></tr>`;
      return;
    }
    if (!items?.length){
      tbody.innerHTML = `<tr><td class="muted" colspan="6">Нет данных</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(ev=>{
      const at = prettyTs(ev.created_at || ev.at || ev.createdAt || '');
      const type = esc(ev.event_type || ev.type || '—');
      const amt = (ev.amount != null && ev.amount !== '') ? fmtMoney(ev.amount) : '—';
      const ip = esc(ev.ip || '—');
      const ua = esc(shortUA(ev.ua || ''));
      const payload = esc(shortPayload(ev.payload));
      return `
        <tr>
          <td class="muted">${esc(at)}</td>
          <td class="mono">${type}</td>
          <td class="mono">${esc(amt)}</td>
          <td class="mono">${ip}</td>
          <td class="mono uc-ua" title="${ua}">${ua}</td>
          <td class="mono uc-payload" title="${payload}">${payload}</td>
        </tr>
      `;
    }).join('');
  }


    

  function renderFinance(){
    const statusEl = document.getElementById('uc-finance-status');
    const pageEl   = document.getElementById('uc-finance-page');
    const prevBtn  = document.getElementById('uc-finance-prev');
    const nextBtn  = document.getElementById('uc-finance-next');

    const kpisEl = document.getElementById('uc-finance-kpis');
    const noteEl = document.getElementById('uc-finance-note');

    const tbl = document.getElementById('uc-finance-table');
    const tbody = tbl?.querySelector('tbody');

    const { page, limit, total, items, loading, kpi } = state.finance;

    const start = total ? ((page - 1) * limit + 1) : 0;
    const end   = Math.min(page * limit, total || 0);

    if (statusEl){
      if (loading) statusEl.textContent = 'Загрузка…';
      else if (state.finance.error) statusEl.textContent = `Ошибка: ${state.finance.error}`;
      else statusEl.textContent = total ? `Показано ${start}–${end} из ${total}` : 'Нет данных';
    }

    if (pageEl){
      const pages = total ? Math.max(1, Math.ceil(total / limit)) : 1;
      pageEl.textContent = `${page} / ${pages}`;
    }
    if (prevBtn) prevBtn.disabled = loading || page <= 1;
    if (nextBtn) nextBtn.disabled = loading || (total ? (page * limit >= total) : true);

    // KPIs
    if (kpisEl){
      const k = kpi || {};
      const itemsK = [
        { l:'Пополнено', v: fmtMoney(k.deposited || 0) },
        { l:'Выведено',  v: fmtMoney(k.withdrawn || 0) },
        { l:'Оборот',    v: fmtMoney(k.turnover || 0) },
        { l:'Рейк',      v: fmtMoney(k.rake || 0) },
      ];
      kpisEl.innerHTML = itemsK.map(it => `
        <div class="uc-kpi">
          <div class="uc-kpi-v">${esc(it.v)}</div>
          <div class="uc-kpi-l">${esc(it.l)}</div>
        </div>
      `).join('');
    }
    if (noteEl){
      const pct = (state.finance.kpi && state.finance.kpi.rake_pct != null) ? String(state.finance.kpi.rake_pct) : '';
      noteEl.textContent = pct ? `Рейк: ${pct}% от оборота` : '';
    }

    if (!tbody) return;
    if (loading){
      tbody.innerHTML = `<tr><td class="muted" colspan="6">Загрузка…</td></tr>`;
      return;
    }
    if (!items?.length){
      tbody.innerHTML = `<tr><td class="muted" colspan="6">Нет данных</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(tx=>{
      const at = prettyTs(tx.created_at || tx.at || tx.createdAt || tx.ts || '');
      const type = esc((tx.type || tx.tx_type || tx.kind || '—'));
      const status = esc((tx.status || 'ok'));
      const amt = (tx.amount != null && tx.amount !== '') ? fmtMoney(tx.amount) : '—';
      const commentRaw = (tx.comment ?? (tx.meta && (tx.meta.comment ?? tx.meta.note ?? tx.meta.desc)) ?? '');
      const comment = esc(commentRaw || '');
      const meta = esc(shortPayload(tx.meta || tx.payload || tx.data || tx.meta_json));
      return `
        <tr>
          <td class="muted">${esc(at)}</td>
          <td class="mono">${type}</td>
          <td class="mono muted">${status}</td>
          <td class="mono">${esc(amt)}</td>
          <td class="mono uc-payload" title="${comment}">${comment || '—'}</td>
          <td class="mono uc-payload" title="${meta}">${meta}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadFinance(page){
    const userId = state.userId;
    if (!userId) return;

    const prevBtn   = document.getElementById('uc-finance-prev');
    const nextBtn   = document.getElementById('uc-finance-next');
    const reloadBtn = document.getElementById('uc-finance-reload');

    const typeSel   = document.getElementById('uc-finance-filter-type');
    const statusSel = document.getElementById('uc-finance-filter-status');
    const periodSel = document.getElementById('uc-finance-filter-period');
    const fromInp   = document.getElementById('uc-finance-filter-from');
    const toInp     = document.getElementById('uc-finance-filter-to');
    const applyBtn  = document.getElementById('uc-finance-filter-apply');
    const resetBtn  = document.getElementById('uc-finance-filter-reset');

    const f = state.finance.filters;

    const pad2 = (n) => String(n).padStart(2,'0');
    const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

    function show(el, on){
      if (!el) return;
      el.classList.toggle('uc-hide', !on);
    }

    function setPeriodQuick(days){
      if (!days){
        f.from = '';
        f.to = '';
        if (fromInp) fromInp.value = '';
        if (toInp) toInp.value = '';
        return;
      }
      const dTo = new Date();
      const dFrom = new Date();
      dFrom.setDate(dFrom.getDate() - Number(days));
      const from = ymdLocal(dFrom);
      const to = ymdLocal(dTo);
      f.from = from;
      f.to = to;
      if (fromInp) fromInp.value = from;
      if (toInp) toInp.value = to;
    }

    function ensureTypeOptions(items){
      if (!typeSel) return;
      const existing = new Set(Array.from(typeSel.options).map(o=>o.value));
      const types = Array.from(new Set((items||[]).map(x=>String(x.type||x.tx_type||x.kind||'').trim()).filter(Boolean))).slice(0,80);
      for (const t of types){
        if (existing.has(t)) continue;
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSel.appendChild(opt);
        existing.add(t);
      }
    }

    // wire controls once
    if (prevBtn && !prevBtn.__ucWired){
      prevBtn.__ucWired = true;
      prevBtn.addEventListener('click', ()=> loadFinance(Math.max(1, (state.finance.page||1) - 1)));
    }
    if (nextBtn && !nextBtn.__ucWired){
      nextBtn.__ucWired = true;
      nextBtn.addEventListener('click', ()=> loadFinance((state.finance.page||1) + 1));
    }
    if (reloadBtn && !reloadBtn.__ucWired){
      reloadBtn.__ucWired = true;
      reloadBtn.addEventListener('click', ()=> loadFinance(state.finance.page||1));
    }

    if (applyBtn && !applyBtn.__ucWired){
      applyBtn.__ucWired = true;
      applyBtn.addEventListener('click', ()=>{
        f.type = (typeSel?.value||'').trim();
        f.status = (statusSel?.value||'').trim();
        f.period = (periodSel?.value||'30').trim();

        if (f.period === 'custom'){
          f.from = (fromInp?.value||'').trim();
          f.to   = (toInp?.value||'').trim();
          show(fromInp, true);
          show(toInp, true);
        } else if (f.period === 'all'){
          show(fromInp, false);
          show(toInp, false);
          setPeriodQuick(null);
        } else {
          show(fromInp, false);
          show(toInp, false);
          setPeriodQuick(Number(f.period));
        }
        loadFinance(1);
      });
    }

    if (resetBtn && !resetBtn.__ucWired){
      resetBtn.__ucWired = true;
      resetBtn.addEventListener('click', ()=>{
        f.type = '';
        f.status = '';
        f.period = '30';
        f.from = '';
        f.to = '';
        if (typeSel) typeSel.value = '';
        if (statusSel) statusSel.value = '';
        if (periodSel) periodSel.value = '30';
        show(fromInp, false);
        show(toInp, false);
        setPeriodQuick(30);
        loadFinance(1);
      });
    }

    if (periodSel && !periodSel.__ucWired){
      periodSel.__ucWired = true;
      periodSel.addEventListener('change', ()=>{
        const v = (periodSel.value||'30').trim();
        if (v === 'custom'){
          show(fromInp, true);
          show(toInp, true);
          if (!fromInp?.value && f.from) fromInp.value = f.from;
          if (!toInp?.value && f.to) toInp.value = f.to;
        } else {
          show(fromInp, false);
          show(toInp, false);
        }
      });
    }

    // default period if empty
    if (!f.period) f.period = '30';
    if ((f.period === '30' || f.period === '7' || f.period === '90' || f.period === '365') && (!f.from || !f.to)){
      setPeriodQuick(Number(f.period));
    }
    if (periodSel && !periodSel.value) periodSel.value = f.period;
    if (typeSel && typeSel.value !== f.type) typeSel.value = f.type || '';
    if (statusSel && statusSel.value !== f.status) statusSel.value = f.status || '';

    state.finance.loading = true;
    state.finance.error = '';
    state.finance.page = Math.max(1, toInt(page, 1));
    renderFinance();

    // Duel profit chart depends only on scope + date range (not on pagination)
    const dpKey = `${userId}|${scope()}|${f.from || ''}|${f.to || ''}`;
    if (state.duel_profit.key !== dpKey) {
      loadDuelProfit(dpKey);
    } else {
      renderDuelProfit();
    }

    const qs = new URLSearchParams();
    qs.set('user_id', userId);
    qs.set('scope', scope());
    qs.set('page', String(state.finance.page));
    qs.set('limit', String(state.finance.limit || 20));

    if (f.from) qs.set('from', f.from);
    if (f.to) qs.set('to', f.to);
    if (f.type) qs.set('type', f.type);
    if (f.status) qs.set('status', f.status);

    const url = `${api()}/api/admin/user-card/finance?${qs.toString()}`;
    try{
      const r = await fetch(url, { headers: window.adminHeaders ? window.adminHeaders() : headers() });
      const j = await r.json().catch(()=>({ ok:false, error:'bad json' }));
      if (!r.ok || j.ok === false){
        throw new Error(j.error || ('HTTP ' + r.status));
      }
      state.finance.loading = false;
      state.finance.total = toInt(j.total, 0);
      state.finance.items = Array.isArray(j.items) ? j.items : [];
      state.finance.kpi = j.kpi || null;
      ensureTypeOptions(state.finance.items);
      renderFinance();
    }catch(err){
      state.finance.loading = false;
      state.finance.error = (err && err.message) ? err.message : String(err || 'error');
      state.finance.total = 0;
      state.finance.items = [];
      state.finance.kpi = null;
      renderFinance();
    }
  }


async function loadDuels(page){
    const userId = state.userId;
    if (!userId) return;

    const prevBtn   = document.getElementById('uc-duels-prev');
    const nextBtn   = document.getElementById('uc-duels-next');
    const reloadBtn = document.getElementById('uc-duels-reload');

    const statusSel = document.getElementById('uc-duels-filter-status');
    const stakeSel  = document.getElementById('uc-duels-filter-stake');
    const periodSel = document.getElementById('uc-duels-filter-period');
    const fromInp   = document.getElementById('uc-duels-filter-from');
    const toInp     = document.getElementById('uc-duels-filter-to');
    const termInp   = document.getElementById('uc-duels-filter-term');
    const applyBtn  = document.getElementById('uc-duels-filter-apply');
    const resetBtn  = document.getElementById('uc-duels-filter-reset');

    const pad2 = (n) => String(n).padStart(2,'0');
    const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

    function show(el, on){
      if (!el) return;
      el.classList.toggle('uc-hide', !on);
    }

    function setPeriodQuick(days){
      const f = state.duels.filters;
      if (!days){
        f.from = '';
        f.to = '';
        if (fromInp) fromInp.value = '';
        if (toInp) toInp.value = '';
        return;
      }
      const dTo = new Date();
      const dFrom = new Date();
      dFrom.setDate(dFrom.getDate() - Number(days));
      const from = ymdLocal(dFrom);
      const to = ymdLocal(dTo);
      f.from = from;
      f.to = to;
      if (fromInp) fromInp.value = from;
      if (toInp) toInp.value = to;
    }

    // wire buttons/filters once
    if (prevBtn && !prevBtn.__ucWired){
      prevBtn.__ucWired = true;
      prevBtn.addEventListener('click', ()=> loadDuels(Math.max(1, (state.duels.page||1) - 1)));
    }
    if (nextBtn && !nextBtn.__ucWired){
      nextBtn.__ucWired = true;
      nextBtn.addEventListener('click', ()=> loadDuels((state.duels.page||1) + 1));
    }
    if (reloadBtn && !reloadBtn.__ucWired){
      reloadBtn.__ucWired = true;
      reloadBtn.addEventListener('click', ()=> loadDuels(state.duels.page||1));
    }

    if (statusSel && !statusSel.__ucWired){
      statusSel.__ucWired = true;
      statusSel.value = state.duels.filters?.status || '';
      statusSel.addEventListener('change', ()=>{
        state.duels.filters.status = statusSel.value || '';
        loadDuels(1);
      });
    }

    if (stakeSel && !stakeSel.__ucWired){
      stakeSel.__ucWired = true;
      stakeSel.value = state.duels.filters?.stake || '';
      stakeSel.addEventListener('change', ()=>{
        state.duels.filters.stake = stakeSel.value || '';
        loadDuels(1);
      });
    }

    if (periodSel && !periodSel.__ucWired){
      periodSel.__ucWired = true;
      periodSel.value = state.duels.filters?.period || 'all';

      // sync visibility
      show(fromInp, periodSel.value === 'custom');
      show(toInp, periodSel.value === 'custom');

      // if quick period already chosen in state — reflect it
      if (periodSel.value === '7' || periodSel.value === '30' || periodSel.value === '90'){
        setPeriodQuick(periodSel.value);
      } else if (periodSel.value === 'all'){
        setPeriodQuick(null);
      }

      periodSel.addEventListener('change', ()=>{
        const v = periodSel.value || 'all';
        state.duels.filters.period = v;

        const isCustom = (v === 'custom');
        show(fromInp, isCustom);
        show(toInp, isCustom);

        if (v === 'all'){
          setPeriodQuick(null);
          loadDuels(1);
        } else if (v === '7' || v === '30' || v === '90'){
          setPeriodQuick(v);
          loadDuels(1);
        } else {
          // custom: waiting for Apply
        }
      });
    }

    if (applyBtn && !applyBtn.__ucWired){
      applyBtn.__ucWired = true;
      applyBtn.addEventListener('click', ()=>{
        if (fromInp) state.duels.filters.from = fromInp.value || '';
        if (toInp) state.duels.filters.to = toInp.value || '';
        if (termInp) state.duels.filters.term = (termInp.value || '').trim();
        loadDuels(1);
      });
    }

    if (resetBtn && !resetBtn.__ucWired){
      resetBtn.__ucWired = true;
      resetBtn.addEventListener('click', ()=>{
        state.duels.filters = { status:'', stake:'', period:'all', from:'', to:'', term:'' };
        if (statusSel) statusSel.value = '';
        if (stakeSel) stakeSel.value = '';
        if (periodSel) periodSel.value = 'all';
        if (fromInp) fromInp.value = '';
        if (toInp) toInp.value = '';
        if (termInp) termInp.value = '';
        show(fromInp, false);
        show(toInp, false);
        loadDuels(1);
      });
    }

    if (termInp && !termInp.__ucWired){
      termInp.__ucWired = true;
      termInp.value = state.duels.filters?.term || '';
      termInp.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter'){
          state.duels.filters.term = (termInp.value || '').trim();
          loadDuels(1);
        }
      });
      termInp.addEventListener('blur', ()=>{
        state.duels.filters.term = (termInp.value || '').trim();
      });
    }

    const p = Math.max(1, toInt(page || state.duels.page || 1, 1) || 1);
    state.duels.page = p;

    state.duels.loading = true;
    state.duels.error = null;
    renderDuels();

    try{
      const limit = state.duels.limit || 50;

      const qs = new URLSearchParams({
        user_id: String(userId),
        scope: String(scope()),
        page: String(p),
        limit: String(limit),
      });

      const f = state.duels.filters || {};
      if (f.status) qs.set('status', String(f.status));
      if (f.stake)  qs.set('stake',  String(f.stake));
      if (f.from)   qs.set('from',   String(f.from));
      if (f.to)     qs.set('to',     String(f.to));
      if (f.term)   qs.set('term',   String(f.term));

      const url = api() + `/api/admin/user-card/duels?${qs.toString()}`;

      const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP '+r.status));

      state.duels.page  = j.page || p;
      state.duels.limit = j.limit || limit;
      state.duels.total = Number(j.total || 0);
      state.duels.items = Array.isArray(j.items) ? j.items : [];
    }catch(e){
      console.error('user-card duels load error', e);
      state.duels.error = String(e?.message || e);
    }finally{
      state.duels.loading = false;
      renderDuels();
    }
  }


  function renderDuels(){
    const statusEl = document.getElementById('uc-duels-status');
    const pageEl   = document.getElementById('uc-duels-page');
    const prevBtn  = document.getElementById('uc-duels-prev');
    const nextBtn  = document.getElementById('uc-duels-next');

    const tbl = document.getElementById('uc-duels-table');
    const tbody = tbl?.querySelector('tbody');

    const page  = Number(state.duels.page || 1);
    const limit = Number(state.duels.limit || 50);
    const total = Number(state.duels.total || 0);
    const items = Array.isArray(state.duels.items) ? state.duels.items : [];

    const fromN = total ? ((page - 1) * limit + 1) : 0;
    const toN   = Math.min(total, (page - 1) * limit + items.length);

    if (statusEl){
      if (state.duels.loading) statusEl.textContent = 'Загрузка…';
      else if (state.duels.error) statusEl.textContent = 'Ошибка: ' + state.duels.error;
      else statusEl.textContent = total ? `Показано ${fromN}–${toN} из ${total}` : 'Нет данных';
    }

    if (pageEl) pageEl.textContent = `${page}/${Math.max(1, Math.ceil((total||1)/limit))}`;
    if (prevBtn) prevBtn.disabled = (page <= 1) || state.duels.loading;
    if (nextBtn) nextBtn.disabled = (toN >= total) || state.duels.loading;

    if (!tbody) return;

    if (state.duels.loading){
      tbody.innerHTML = `<tr><td class="muted" colspan="9">Загрузка…</td></tr>`;
      return;
    }
    if (state.duels.error){
      tbody.innerHTML = `<tr><td class="muted" colspan="9">Ошибка: ${esc(state.duels.error)}</td></tr>`;
      return;
    }
    if (!items.length){
      tbody.innerHTML = `<tr><td class="muted" colspan="9">Нет данных</td></tr>`;
      return;
    }

    const statusMap = {
      open: 'Открыта',
      finished: 'Завершена',
      cancelled: 'Отмена'
    };

    tbody.innerHTML = items.map(d=>{
      const ts = (d.status === 'finished' || d.status === 'cancelled')
        ? (d.finished_at || d.created_at)
        : (d.created_at || d.finished_at);

      const at = fmtTs(ts);

      const roleRaw = (d.role || '').toString();
      const roleLabel = roleRaw === 'joined' ? 'Вошёл' : (roleRaw === 'created' ? 'Создал' : '—');
      const role = `<span class="uc-role">${esc(roleLabel)}</span>`;

      const stake = (d.mode === 'vip')
        ? `<span class="mono">VIP</span>${(d.stake != null ? ` · <span class="mono">${fmtMoney(d.stake)}</span>` : '')}`
        : `<span class="mono">${(d.stake == null ? '—' : fmtMoney(d.stake))}</span>`;

      const st = (d.status || '—').toString().toLowerCase();
      const stLabel = statusMap[st] || st;
      const stClass = (st === 'open' || st === 'finished' || st === 'cancelled') ? st : 'other';
      const status = `<span class="uc-status ${stClass}">${esc(stLabel)}</span>`;

      const pot = (d.pot == null) ? '—' : fmtMoney(d.pot);
      const rake = (d.rake == null) ? '—' : fmtMoney(d.rake);

      let res = '—';
      const r = (d.result || '').toString();
      if (r === 'win') res = '<span class="uc-win">WIN</span>';
      else if (r === 'lose') res = '<span class="uc-lose">LOSE</span>';
      else if (r === 'cancelled') res = '<span class="muted">CANCELLED</span>';

      // opponent relative to matched_user_id
      const matched = Number(d.matched_user_id || state.userId || 0) || 0;
      const isCreator = matched && Number(d.creator_user_id) === matched;

      const oppId = isCreator ? d.opponent_user_id : d.creator_user_id;
      const oppName = isCreator
        ? [d.opponent_first_name, d.opponent_last_name].filter(Boolean).join(' ').trim()
        : [d.creator_first_name, d.creator_last_name].filter(Boolean).join(' ').trim();
      const oppAva = isCreator ? d.opponent_avatar : d.creator_avatar;

      const oppTitle = oppId ? (oppName || `user_id: ${oppId}`) : '—';
      const oppHref = oppId ? `user-card.html?user_id=${encodeURIComponent(oppId)}` : '';
      const oppAvaHtml = oppAva ? `<img class="uc-opp-ava" src="${esc(oppAva)}" alt="">` : `<span class="uc-opp-ava"></span>`;
      const oppHtml = oppId
        ? `<div class="uc-opp">${oppAvaHtml}<a class="uc-opp-name" href="${oppHref}">${esc(oppTitle)}</a> <span class="muted mono">#${esc(oppId)}</span></div>`
        : `<div class="uc-opp"><span class="uc-opp-ava"></span><span class="muted">—</span></div>`;

      return `
        <tr>
          <td class="mono">${at}</td>
          <td class="mono">${esc(d.id)}</td>
          <td>${role}</td>
          <td>${oppHtml}</td>
          <td>${stake}</td>
          <td>${status}</td>
          <td class="mono">${pot}</td>
          <td class="mono">${rake}</td>
          <td>${res}</td>
        </tr>
      `;
    }).join('');
  }


function render(data){
    const p = data.profile || {};
    const prov = data.providers || {};
    const la = data.last_auth || null;
    const le = data.last_event || null;

    // avatar (frame + provider badge overlay)
    const hdr = $('#uc-header');
    const avaBox = hdr?.querySelector('.uc-avatar');
    if (avaBox){
      const src = p.avatar || p.avatar_url || '';
      const imgHtml = src
        ? `<img class="uc-avatar-img" src="${esc(src)}" alt="avatar" referrerpolicy="no-referrer" />`
        : `<div class="uc-avatar-empty">—</div>`;
      // Keep avatar itself clipped, but allow badge to slightly hang outside.
      avaBox.innerHTML = `
        <div class="uc-avatar-frame">${imgHtml}</div>
        <div class="uc-avatar-badges" aria-label="providers"></div>
      `;
    }

    // name
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
    const nameEl = hdr?.querySelector('.uc-name');
    if (nameEl) nameEl.innerHTML = esc(name);

    // ids
    const idsEl = hdr?.querySelector('.uc-ids');
    if (idsEl) idsEl.innerHTML = `user_id: <b>${esc(p.user_id ?? '—')}</b> · HUM: <b>${esc(p.hum_id ?? '—')}</b>`;

    // Provider badges on avatar
    const avaBadgesEl = hdr?.querySelector('.uc-avatar-badges');
    if (avaBadgesEl){
      const b = [];
      if (prov.vk) b.push(`<span class="uc-avatar-badge vk">VK</span>`);
      if (prov.tg) b.push(`<span class="uc-avatar-badge tg">TG</span>`);
      if (!prov.vk && !prov.tg && p.provider) b.push(`<span class="uc-avatar-badge other">${esc(fmtProvider(p.provider))}</span>`);
      avaBadgesEl.innerHTML = b.join('');
      avaBadgesEl.style.display = b.length ? '' : 'none';
    }

    // Line badges (leave only non-provider info here)
    const badgesEl = hdr?.querySelector('.uc-badges');
    if (badgesEl){
      const b = [];
      if (p.merged_via_proof) b.push(badge('склейка через proof', 'proof'));
      badgesEl.innerHTML = b.join(' ');
      badgesEl.style.display = b.length ? '' : 'none';
    }

    // meta chips
    const metaEl = hdr?.querySelector('.uc-meta');
    if (metaEl){
      const chips = [];

      // last auth
      const authAt = la?.at ? prettyTs(la.at) : '—';
      const cc = (la?.country_code || p.country_code || '').toString().trim();
      const flag = cc ? `<span class="uc-flag" data-cc="${esc(cc)}"></span>` : '';
      const ip = la?.ip ? esc(la.ip) : '—';
      chips.push(chip('Последний вход', `${authAt} · ${flag} ${ip}`));

      // device
      const d = deviceFromUA(la?.ua || le?.ua || '');
      chips.push(chip('Устройство', `${esc(d.os)} · ${esc(d.client)} · ${esc(d.type)}`));

      // last activity
      chips.push(chip('Последняя активность', le?.at ? `${prettyTs(le.at)} · ${summarizeEvent(le)}` : '—'));

      // registration
      const regVia = data.registered_via ? fmtProvider(data.registered_via) : (p.provider ? fmtProvider(p.provider) : '—');
      chips.push(chip('Регистрация', `${p.created_at ? prettyTs(p.created_at) : '—'} · ${esc(regVia)}`));

      metaEl.innerHTML = chips.join('');
    }

    // decorate flags
    try{ if (window.decorateFlags) window.decorateFlags(document); }catch(_){}

    renderOverview(data);
  }

  function renderOverview(data){
    const p = data.profile || {};
    const k = data.kpis || {};
    const isHum = (scope() === 'hum');

    // links / connections + HUM family
    const links = $('#uc-links');
    if (links){
      const parts = [];
      parts.push(`VK linked: <b>${data.is_vk_linked ? 'да' : 'нет'}</b>`);
      parts.push(`TG linked: <b>${data.is_tg_linked ? 'да' : 'нет'}</b>`);

      const fam = Array.isArray(data.hum_family) ? data.hum_family : [];
      if (fam.length > 1){
        parts.push(`HUM аккаунтов: <b>${fam.length}</b>${isHum ? ' (режим HUM)' : ''}`);
      } else {
        parts.push(`HUM аккаунтов: <b>${fam.length || 1}</b>${isHum ? ' (режим HUM)' : ''}`);
      }

      // mini avatars
      let famHtml = '';
      if (fam.length){
        famHtml = `<div class="uc-family">` + fam.map(u=>{
          const id = u.id;
          const img = (u.avatar_url || u.avatar || '').toString();
          const title = `${tinyName(u.first_name, u.last_name)} · user_id: ${id}`;
          const pic = img
            ? `<img src="${esc(img)}" alt="u" referrerpolicy="no-referrer" />`
            : `<span class="uc-family-empty">#${esc(id)}</span>`;
          return `<a class="uc-family-item" href="/admin/user-card.html?user_id=${encodeURIComponent(id)}" title="${esc(title)}">${pic}</a>`;
        }).join('') + `</div>`;
      }

      links.innerHTML = parts.join(' · ') + famHtml;
    }

    // KPIs
    const kpisEl = $('#uc-kpis');
    if (kpisEl){
      const duels = Number(k.duels || 0);
      const items = [
        { l:'Дуэлей', v: fmtInt(duels) },
        { l:'Оборот', v: fmtMoney(k.turnover || 0) },
        { l:'Рейк', v: fmtMoney(k.rake || 0) },
        { l:'Победы', v: fmtInt(k.wins || 0) },
        { l:'Поражения', v: fmtInt(k.losses || 0) },
        { l:'Винрейт', v: duels ? (String(k.winrate ?? 0) + '%') : '—' },
      ];
      kpisEl.innerHTML = items.map(it => `
        <div class="uc-kpi">
          <div class="uc-kpi-v">${esc(it.v)}</div>
          <div class="uc-kpi-l">${esc(it.l)}</div>
        </div>
      `).join('');
    }

    // Step 4 charts
    try{ renderActivity(data.activity); }catch(_){ }
    try{ renderDonut(data.stakes); }catch(_){ }


    // Last duels table
    const tbl = $('#uc-last-duels');
    const tbody = tbl?.querySelector('tbody');
    if (tbody){
      const rows = Array.isArray(data.last_duels) ? data.last_duels : [];
      if (!rows.length){
        tbody.innerHTML = `<tr><td class="muted" colspan="7">Нет данных</td></tr>`;
      } else {
        const myUserId = Number(p.user_id || 0);
        const myHumId = Number(p.hum_id || 0);
        const isHumMode = (scope() === 'hum');

        tbody.innerHTML = rows.map(d=>{
          const at = prettyTs(d.finished_at || d.created_at || '');
          const stake = fmtMoney(d.stake || 0);
          const status = esc(d.status || '—');

          const pot = (d.pot == null) ? '—' : fmtMoney(d.pot);
          const rake = (d.rake == null) ? '—' : fmtMoney(d.rake);

          let winTxt = '—';
          if ((d.status||'') === 'finished'){
            const win = isHumMode
              ? (Number(d.winner_hum_id || 0) === myHumId)
              : (Number(d.winner_user_id || 0) === myUserId);
            const lose = (d.winner_user_id != null) && !win;
            winTxt = win ? '<span class="uc-win">WIN</span>' : (lose ? '<span class="uc-lose">LOSE</span>' : '—');
          }

          return `
            <tr>
              <td class="muted">${esc(at)}</td>
              <td class="mono">${esc(d.id ?? '—')}</td>
              <td class="mono">${esc(stake)}</td>
              <td>${status}</td>
              <td class="mono">${esc(pot)}</td>
              <td class="mono">${esc(rake)}</td>
              <td>${winTxt}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Last events list
    const evBox = $('#uc-last-events');
    if (evBox){
      const rows = Array.isArray(data.last_events) ? data.last_events : [];
      if (!rows.length){
        evBox.innerHTML = `<div class="muted">Нет данных</div>`;
      } else {
        evBox.innerHTML = rows.map(ev=>{
          const at = prettyTs(ev.at || '');
          const type = esc(ev.event_type || '—');
          const amt = (ev.amount != null && ev.amount !== '') ? fmtMoney(ev.amount) : '';
          return `
            <div class="uc-ev">
              <div class="uc-ev-left">
                <div class="uc-ev-type">${type}</div>
                <div class="uc-ev-time muted">${esc(at)}</div>
              </div>
              <div class="uc-ev-right mono">${esc(amt)}</div>
            </div>
          `;
        }).join('');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    initTabs();
    load();
  });


// --- Step 4: Activity mini-bars (SVG) ---
function renderActivity(activity){
  const svg = document.getElementById('uc-activity-chart');
  const tip = document.getElementById('uc-activity-tip');
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const days = activity?.days || [];
  const duelsArr = activity?.duels || [];
  const turnoverArr = activity?.turnover || activity?.counts || [];
  const rakeArr = activity?.rake || [];

  const n = Math.min(
    days.length || 0,
    turnoverArr.length || 0,
    (duelsArr.length || (days.length || 0)),
  );

  if (!n){
    if (tip) tip.textContent = 'Нет данных';
    return;
  }

  const W = 300, H = 80;
  const M = { top: 6, right: 44, bottom: 14, left: 18 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const vals = turnoverArr.slice(0,n).map(x=>Number(x||0));
  const maxV = Math.max(1, ...vals);

  // nice ticks for Y axis
  function niceStep(x){
    if (!isFinite(x) || x <= 0) return 1;
    const exp = Math.floor(Math.log10(x));
    const f = x / Math.pow(10, exp);
    let nf = 1;
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 5) nf = 5;
    else nf = 10;
    return nf * Math.pow(10, exp);
  }
  let step = niceStep(maxV / 4);
  let top = step * 4;
  if (top < maxV){
    step = niceStep(maxV / 3);
    top = step * 4;
  }
  if (top < maxV) top = maxV;

  const ticks = [0, step, step*2, step*3, top];

  // horizontal grid + labels
  for (let i=0;i<ticks.length;i++){
    const v = ticks[i];
    const y = M.top + plotH - (v / top) * plotH;

    const ln = document.createElementNS('http://www.w3.org/2000/svg','line');
    ln.setAttribute('x1', String(M.left));
    ln.setAttribute('x2', String(M.left + plotW));
    ln.setAttribute('y1', String(y));
    ln.setAttribute('y2', String(y));
    ln.setAttribute('class', 'uc-activity-grid');
    svg.appendChild(ln);

    const tx = document.createElementNS('http://www.w3.org/2000/svg','text');
    tx.setAttribute('x', String(M.left + plotW + 4));
    tx.setAttribute('y', String(y + 3));
    tx.setAttribute('class', 'uc-activity-axis');
    tx.textContent = String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    svg.appendChild(tx);
  }

  // x-axis date ticks: start + month starts + end (max 6)
  const xTickIdx = new Set([0, n-1]);
  for (let i=0;i<n;i++){
    const d = String(days[i]||'');
    if (d.endsWith('-01')) xTickIdx.add(i);
  }
  let xTicks = Array.from(xTickIdx).sort((a,b)=>a-b);
  // if start tick is too close to first month tick, drop it (prevents overlapping labels)
  if (xTicks.length>=2 && xTicks[0]===0 && xTicks[1] <= 3) xTicks = xTicks.slice(1);
  if (xTicks.length > 6){
    // downsample to 6
    const keep = [0, n-1];
    const stepI = Math.floor((n-1)/4) || 1;
    for (let k=1;k<=3;k++) keep.push(k*stepI);
    xTicks = Array.from(new Set(keep)).sort((a,b)=>a-b).slice(0,6);
  }

  const firstTick = xTicks[0];
  const lastTick = xTicks[xTicks.length-1];

  for (const i of xTicks){
    const x = M.left + (i + 0.5) * (plotW / n);
    const tick = document.createElementNS('http://www.w3.org/2000/svg','line');
    tick.setAttribute('x1', String(x));
    tick.setAttribute('x2', String(x));
    tick.setAttribute('y1', String(M.top + plotH));
    tick.setAttribute('y2', String(M.top + plotH + 3));
    tick.setAttribute('class','uc-activity-grid');
    svg.appendChild(tick);

    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x', String(x));
    t.setAttribute('y', String(H - 6));
    t.setAttribute('text-anchor', (i===firstTick ? 'start' : (i===lastTick ? 'end' : 'middle')));
    t.setAttribute('class', 'uc-activity-axis');
    const label = String(days[i]||'').slice(5); // MM-DD
    t.textContent = label;
    svg.appendChild(t);
  }

  // bars
  const barW = plotW / n;
  for (let i=0;i<n;i++){
    const v = vals[i] || 0;
    const h = (v / top) * plotH;
    const x = M.left + i * barW;
    const y = M.top + plotH - h;

    const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
    r.setAttribute('x', String(x + 0.6));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(Math.max(1, barW - 1.2)));
    r.setAttribute('height', String(Math.max(0, h)));
    r.setAttribute('rx','1.6');
    r.setAttribute('class','uc-activity-bar');

    r.dataset.day = String(days[i] || '');
    r.dataset.duels = String(duelsArr[i] ?? 0);
    r.dataset.turnover = String(turnoverArr[i] ?? 0);
    r.dataset.rake = String(rakeArr[i] ?? 0);
    svg.appendChild(r);
  }

  // вертикальная "черта-курсор" как на больших графиках
  const hoverLine = document.createElementNS('http://www.w3.org/2000/svg','line');
  hoverLine.setAttribute('y1', String(M.top));
  hoverLine.setAttribute('y2', String(M.top + plotH));
  hoverLine.setAttribute('class','uc-activity-hoverline');
  hoverLine.style.opacity = '0';
  hoverLine.setAttribute('pointer-events','none');
  svg.appendChild(hoverLine);

  svg.onmousemove = (e)=>{
    const box = svg.getBoundingClientRect();
    const xSvg = (e.clientX - box.left) * (W / box.width);
    const ySvg = (e.clientY - box.top) * (H / box.height);

    // активируем подсказку по X-координате (как на больших графиках), а не только по попаданию в rect
    if (xSvg < M.left || xSvg > (M.left + plotW) || ySvg < M.top || ySvg > (M.top + plotH)){
      if (hoverLine) hoverLine.style.opacity = '0';
      if (tip) tip.classList.remove('show');
      return;
    }

    const idx = Math.max(0, Math.min(n - 1, Math.floor((xSvg - M.left) / barW)));
    const cx = M.left + idx * barW + (barW / 2);

    if (hoverLine){
      hoverLine.setAttribute('x1', String(cx));
      hoverLine.setAttribute('x2', String(cx));
      hoverLine.style.opacity = '1';
    }

    const day = String(days[idx] || '');
    const duels = Number(duelsArr[idx] ?? 0);
    const turnover = Number(turnoverArr[idx] ?? 0);
    const rake = Number(rakeArr[idx] ?? 0);

    if (tip){
      tip.innerHTML = `
        <div class="uc-tip-date">${esc(day)}</div>
        <div>Дуэлей: <b>${esc(String(duels))}</b></div>
        <div>Оборот: <b>${esc(fmtMoney(turnover))}</b></div>
        <div>Рейк: <b>${esc(fmtMoney(rake))}</b></div>
      `;
      tip.classList.add('show');

      // позиционируем около курсора, но держим внутри блока
      const tw = tip.offsetWidth || 0;
      const th = tip.offsetHeight || 0;
      let left = (e.clientX - box.left + 12);
      let topPx  = (e.clientY - box.top - 12);

      if (left + tw > box.width - 6) left = box.width - tw - 6;
      if (left < 6) left = 6;
      if (topPx + th > box.height - 6) topPx = box.height - th - 6;
      if (topPx < 6) topPx = 6;

      tip.style.left = left + 'px';
      tip.style.top  = topPx + 'px';
    }
  };
  svg.onmouseleave = ()=>{
    if (hoverLine) hoverLine.style.opacity = '0';
    if (tip) tip.classList.remove('show');
  };
}


// --- Step 4: Donut (SVG) ---
function renderDonut(stakes){
  const el = document.getElementById('uc-stakes-donut');
  const leg = document.getElementById('uc-stakes-legend');
  if (!el || !leg) return;
  el.innerHTML = '';
  leg.innerHTML = '';

  const rows = (stakes?.by_stake || []).filter(r => (r.duels||0) > 0 || (r.turnover||0) > 0);
  if (!rows.length){
    el.innerHTML = '<div class="uc-muted">Нет дуэлей</div>';
    return;
  }

  const totals = stakes?.totals || {};
  const totalDuels = Number(totals.duels || rows.reduce((a,r)=>a+Number(r.duels||0),0));
  const totalTurn  = Number(totals.turnover || rows.reduce((a,r)=>a+Number(r.turnover||0),0));

  const metric = (window.__ucDonutMetric || 'duels');
  const total = metric === 'turnover' ? Math.max(1,totalTurn) : Math.max(1,totalDuels);

  const size = 168;
  const rOuter = 74;
  const rInner = 54;
  const cx = size/2, cy = size/2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class','uc-donut-svg');

  const bg = document.createElementNS('http://www.w3.org/2000/svg','circle');
  bg.setAttribute('cx',cx); bg.setAttribute('cy',cy); bg.setAttribute('r', (rOuter+rInner)/2);
  bg.setAttribute('class','uc-donut-bg');
  bg.setAttribute('stroke-width', String(rOuter-rInner));
  svg.appendChild(bg);

  const colors = ['uc-dc-1','uc-dc-2','uc-dc-3','uc-dc-4','uc-dc-5','uc-dc-6','uc-dc-7'];
  let a0 = -Math.PI/2;

  function arcPath(aStart, aEnd){
    const r = (rOuter+rInner)/2;
    const x1 = cx + r*Math.cos(aStart), y1 = cy + r*Math.sin(aStart);
    const x2 = cx + r*Math.cos(aEnd),   y2 = cy + r*Math.sin(aEnd);
    const large = (aEnd-aStart) > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
  }

  rows.forEach((row, i)=>{
    const val = metric === 'turnover' ? Number(row.turnover||0) : Number(row.duels||0);
    const frac = val / total;
    const a1 = a0 + frac * Math.PI*2;

    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d', arcPath(a0,a1));
    p.setAttribute('class', 'uc-donut-seg ' + colors[i % colors.length]);
    p.setAttribute('stroke-width', String(rOuter-rInner));
    svg.appendChild(p);

    a0 = a1;
  });

  const center = document.createElement('div');
  center.className = 'uc-donut-center';
  const centerValue = metric === 'turnover'
    ? fmtMoney(totalTurn) + ' ₽'
    : fmtInt(totalDuels) + ' шт';
  center.innerHTML = `<div class="uc-donut-center-val">${esc(centerValue)}</div>
                      <div class="uc-donut-center-sub">${metric === 'turnover' ? 'оборот' : 'дуэли'}</div>`;

  el.appendChild(svg);
  el.appendChild(center);

  rows.forEach((row,i)=>{
    const stake = Number(row.stake||0);
    const label = stake ? `${stake} ₽` : 'VIP';
    const duels = Number(row.duels||0);
    const turn  = Number(row.turnover||0);
    const val = metric === 'turnover' ? turn : duels;
    const pct = Math.round((val / total)*1000)/10;
    const it = document.createElement('div');
    it.className = 'uc-leg-item';
    it.innerHTML = `
      <span class="uc-leg-dot ${colors[i%colors.length]}"></span>
      <span class="uc-leg-name">${esc(label)}</span>
      <span class="uc-leg-val">${metric === 'turnover' ? (fmtMoney(turn)+' ₽') : (fmtInt(duels)+' • '+pct+'%')}</span>
    `;
    leg.appendChild(it);
  });
  const toggle = ()=>{
    window.__ucDonutMetric = (metric === 'duels') ? 'turnover' : 'duels';
    renderDonut(stakes);
  };
  // click anywhere on donut (Edge can be picky about bubbling from SVG)
  el.addEventListener('click', toggle);
  svg.addEventListener('click', (e)=>{ e.stopPropagation(); toggle(); });

}

})();
