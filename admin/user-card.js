// admin/user-card.js — user card (step 3: overview KPIs + last duels/events)
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);

  let stakeMode = (localStorage.getItem('UC_STAKES_MODE') || 'count').toString();
  if (stakeMode !== 'turnover' && stakeMode !== 'count') stakeMode = 'count';
  let toggleBound = false;

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
  function fmtMoney(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return nf0.format(Math.trunc(v)) + ' ₽';
  }

  // BigInt helpers (for turnover donuts)
  function toBigIntSafe(x){
    try{
      if (typeof x === 'bigint') return x;
      if (x === null || x === undefined) return 0n;
      const s = String(x).trim();
      if (!s) return 0n;
      if (/^-?\d+$/.test(s)) return BigInt(s);
      const t = s.replace(/[^\d\-]/g,'');
      if (!t || t === '-') return 0n;
      return BigInt(t);
    }catch(_){ return 0n; }
  }

  function fmtRubBig(x){
    const bi = toBigIntSafe(x);
    const sign = bi < 0n ? '-' : '';
    const abs = bi < 0n ? -bi : bi;
    const s = abs.toString();
    let out='';
    for (let i=0;i<s.length;i++){
      const j = s.length - i;
      out += s[i];
      if (j>1 && (j-1)%3===0) out += ' ';
    }
    return sign + out + ' ₽';
  }

  function pickScaleDiv(bigints){
    let max = 0n;
    (bigints||[]).forEach(b=>{
      const a = b < 0n ? -b : b;
      if (a > max) max = a;
    });
    const digits = max.toString().length;
    const drop = Math.max(0, digits - 15);
    const div = 10n ** BigInt(drop);
    return { drop, div };
  }

  function prettyTs(v){
    const s = (v ?? '').toString();
    if (!s) return '—';
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
    return m ? `${m[1]} ${m[2]}` : esc(s);
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

  const NS = 'http://www.w3.org/2000/svg';

  function svgElt(tag, attrs){
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function clearSvg(svg){
    while (svg && svg.firstChild) svg.removeChild(svg.firstChild);
  }
  function pickColors(n){
    const vars = ['--seg1','--seg2','--seg3','--seg4','--seg5','--seg6','--seg7','--seg8'];
    const root = getComputedStyle(document.documentElement);
    const arr = [];
    for (let i=0;i<n;i++){
      const v = vars[i % vars.length];
      const c = root.getPropertyValue(v).trim() || '#4dabf7';
      arr.push(c);
    }
    return arr;
  }

  function drawDonut(svg, centerEl, legendEl, items, totalNum, totalRaw, valueFormatter, subLabel){
    if (!svg || !centerEl || !legendEl) return;
    clearSvg(svg);
    legendEl.innerHTML = '';

    const R = 40;
    const C = 2 * Math.PI * R;

    // track
    svg.appendChild(svgElt('circle', { cx:50, cy:50, r:R, fill:'none', stroke:'rgba(255,255,255,0.08)', 'stroke-width':18 }));

    const nonZero = (items||[]).filter(x => (x.valueNum > 0));
    if (!nonZero.length || !totalNum){
      centerEl.innerHTML = `—<span class="sub">${esc(subLabel||'')}</span>`;
      return;
    }

    const colors = pickColors(nonZero.length);
    let offset = 0;

    nonZero.forEach((it, idx)=>{
      const frac = it.valueNum / totalNum;
      const seg = Math.max(0, C * frac);
      const c = svgElt('circle', {
        cx:50, cy:50, r:R, fill:'none',
        stroke: colors[idx],
        'stroke-width':18,
        'stroke-dasharray': `${seg} ${C}`,
        'stroke-dashoffset': String(-offset),
        transform: 'rotate(-90 50 50)',
      });
      const t = svgElt('title');
      t.textContent = `${it.label}: ${valueFormatter(it.valueRaw)} (${Math.round(frac*100)}%)`;
      c.appendChild(t);
      svg.appendChild(c);
      offset += seg;

      const row = document.createElement('div');
      row.className = 'donut-leg-row';

      const dot = document.createElement('span');
      dot.className = 'donut-dot';
      dot.style.background = colors[idx];

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = it.label;

      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = `${valueFormatter(it.valueRaw)} • ${Math.round(frac*100)}%`;

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(val);
      legendEl.appendChild(row);
    });

    centerEl.innerHTML = `${valueFormatter(totalRaw)}<span class="sub">${esc(subLabel||'')}</span>`;
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
    window.__uc_last = data;
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

    // Mini activity + stakes donut
    renderMiniActivity(data);
    setupStakesToggle();
    renderMiniStakes(data);

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



  function setupStakesToggle(){
    if (toggleBound) return;
    const box = $('#uc-stakes-toggle');
    if (!box) return;
    toggleBound = true;

    const setActive = () => {
      box.querySelectorAll('button').forEach(b=>{
        const m = b.getAttribute('data-mode');
        if (m === stakeMode) b.classList.add('is-active');
        else b.classList.remove('is-active');
      });
    };
    setActive();

    box.addEventListener('click', (e)=>{
      const btn = e.target?.closest?.('button[data-mode]');
      if (!btn) return;
      const m = (btn.getAttribute('data-mode') || '').toString();
      if (m !== 'count' && m !== 'turnover') return;
      stakeMode = m;
      localStorage.setItem('UC_STAKES_MODE', stakeMode);
      setActive();
      if (window.__uc_last) renderMiniStakes(window.__uc_last);
    });
  }

  function normalizeStakes(items){
    const pref = [100,250,500,1000,2500];
    const map = new Map();
    (items||[]).forEach(r=>{
      const s = Number(r.stake||0) || 0;
      const key = String(s||0);
      if (!map.has(key)) map.set(key, { stake:s, duels_count:0, turnover:0n });
      const cur = map.get(key);
      cur.duels_count += Number(r.duels_count || 0);
      cur.turnover += toBigIntSafe(r.turnover);
    });

    const out=[];
    for (const s of pref){
      const k = String(s);
      if (map.has(k)) {
        const v = map.get(k);
        out.push({ label: `${s} ₽`, stake:s, duels_count:v.duels_count, turnover:v.turnover });
        map.delete(k);
      }
    }
    const rest=[];
    let vip=null;
    for (const [k,v] of map.entries()){
      if (k === '0') { vip=v; continue; }
      rest.push({ label: `${v.stake} ₽`, stake:v.stake, duels_count:v.duels_count, turnover:v.turnover });
    }
    rest.sort((a,b)=>(a.stake||0)-(b.stake||0));
    out.push(...rest);
    if (vip) out.push({ label:'VIP', stake:0, duels_count:vip.duels_count, turnover:vip.turnover });
    return out;
  }

  function renderMiniStakes(data){
    const svg = $('#uc-stakes-donut');
    const center = $('#uc-stakes-center');
    const legend = $('#uc-stakes-legend');
    if (!svg || !center || !legend) return;

    const raw = data?.stakes?.items || [];
    const itemsN = normalizeStakes(raw);

    if (stakeMode === 'turnover'){
      const vals = itemsN.map(x=>x.turnover);
      const totalBig = vals.reduce((a,b)=>a+b, 0n);
      const { div } = pickScaleDiv([totalBig, ...vals]);
      const totalNum = Number(totalBig / div);
      const drawItems = itemsN.map(x=>({
        label: x.label,
        valueRaw: x.turnover,
        valueNum: Number(x.turnover / div),
      }));
      drawDonut(svg, center, legend, drawItems, totalNum, totalBig, (v)=>fmtRubBig(v), 'Оборот');
    } else {
      const total = itemsN.reduce((a,x)=>a + (Number(x.duels_count||0)), 0);
      const drawItems = itemsN.map(x=>({
        label: x.label,
        valueRaw: Number(x.duels_count||0),
        valueNum: Number(x.duels_count||0),
      }));
      drawDonut(svg, center, legend, drawItems, total, total, (v)=>fmtInt(v), 'Дуэлей');
    }
  }

  function dateOnly(v){
    const s = (v??'').toString();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : s;
  }

  function renderMiniActivity(data){
    const box = $('#uc-activity');
    const note = $('#uc-activity-note');
    if (!box) return;

    const series = (data && data.activity_90 && Array.isArray(data.activity_90.points))
      ? data.activity_90
      : (data?.activity_series || {});

    const bucket = series.bucket || null;
    const pts = Array.isArray(series.points) ? series.points : [];

    if (note){
      if (bucket === 'day') note.textContent = '(по дням)';
      else if (bucket === 'week') note.textContent = '(по неделям)';
      else if (bucket === 'month') note.textContent = '(по месяцам)';
      else note.textContent = '';
    }

    if (!pts.length){
      box.innerHTML = '<div class="muted">Нет данных</div>';
      return;
    }

    const max = Math.max(1, ...pts.map(p=>Number(p.c||0)));
    box.innerHTML = pts.map(p=>{
      const c = Number(p.c||0);
      const h = Math.max(3, Math.round((c/max)*100));
      const cls = c ? 'uc-bar' : 'uc-bar zero';
      const t = dateOnly(p.t) + ': ' + c;
      return `<div class="${cls}" style="height:${h}%" title="${esc(t)}"></div>`;
    }).join('');
  }


  document.addEventListener('DOMContentLoaded', load);
})();
