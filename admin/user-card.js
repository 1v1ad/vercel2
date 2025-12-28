// admin/user-card.js — user card (step 3: overview KPIs + last duels/events)
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);

  const state = {
    userId: null,
    tab: 'overview',
    events: { page: 1, limit: 50, total: 0, items: [], loading: false },
    duels:  { page: 1, limit: 50, total: 0, items: [], loading: false, error: '', filters: { status: '', stake: '', period: 'all', from: '', to: '', term: '' } }
  };

  function api(){
    const raw = (window.API || localStorage.getItem('ADMIN_API') || localStorage.getItem('admin_api') || '').toString().trim();
    return raw ? raw.replace(/\/+$/,'') : location.origin;
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
      try { load(); } catch(_){}
      if (state.tab === 'events') {
        try { loadEvents(1); } catch(_){}
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
      { id:'uc-panel-duels', tab:'duels' },
      { id:'uc-panel-events', tab:'events' },
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

  async function loadEvents(page){
    const userId = state.userId;
    if (!userId) return;

    const prevBtn = document.getElementById('uc-events-prev');
    const nextBtn = document.getElementById('uc-events-next');
    const reloadBtn = document.getElementById('uc-events-reload');

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

    state.events.loading = true;
    state.events.page = page;
    renderEvents();

    const url = api() + `/api/admin/user-card/events?user_id=${encodeURIComponent(userId)}`
      + `&scope=${encodeURIComponent(scope())}`
      + `&page=${encodeURIComponent(page)}`
      + `&limit=${encodeURIComponent(state.events.limit)}`;

    try{
      const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      state.events.items = Array.isArray(j.items) ? j.items : [];
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

    // avatar
    const hdr = $('#uc-header');
    const avaBox = hdr?.querySelector('.uc-avatar');
    if (avaBox){
      const src = p.avatar || p.avatar_url || '';
      avaBox.innerHTML = src
        ? `<img class="uc-avatar-img" src="${esc(src)}" alt="avatar" referrerpolicy="no-referrer" />`
        : `<div class="uc-avatar-empty">—</div>`;
    }

    // name
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
    const nameEl = hdr?.querySelector('.uc-name');
    if (nameEl) nameEl.innerHTML = esc(name);

    // ids
    const idsEl = hdr?.querySelector('.uc-ids');
    if (idsEl) idsEl.innerHTML = `user_id: <b>${esc(p.user_id ?? '—')}</b> · HUM: <b>${esc(p.hum_id ?? '—')}</b>`;

    // badges
    const badgesEl = hdr?.querySelector('.uc-badges');
    if (badgesEl){
      const b = [];
      if (prov.vk) b.push(badge('VK', 'vk'));
      if (prov.tg) b.push(badge('TG', 'tg'));
      if (!prov.vk && !prov.tg && p.provider) b.push(badge(fmtProvider(p.provider)));
      if (p.merged_via_proof) b.push(badge('manual/proof link', 'proof'));
      badgesEl.innerHTML = b.join(' ') || '—';
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
