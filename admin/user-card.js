// admin/user-card.js — user card (step 3: overview KPIs + last duels/events)
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);

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

  document.addEventListener('DOMContentLoaded', load);


// --- Step 4: Activity mini-bars (SVG) ---
function renderActivity(activity){
  const svg = document.getElementById('uc-activity-chart');
  const tip = document.getElementById('uc-activity-tip');
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const days = activity?.days || [];
  const counts = activity?.counts || [];
  if (!days.length){
    if (tip) tip.textContent = 'Нет данных';
    return;
  }
  const W = 300, H = 80;
  const n = Math.min(days.length, counts.length);
  const maxV = Math.max(1, ...counts.slice(0,n));
  const barW = W / n;

  const grid = document.createElementNS('http://www.w3.org/2000/svg','line');
  grid.setAttribute('x1','0'); grid.setAttribute('y1', String(H-0.5));
  grid.setAttribute('x2', String(W)); grid.setAttribute('y2', String(H-0.5));
  grid.setAttribute('class','uc-activity-grid');
  svg.appendChild(grid);

  for (let i=0;i<n;i++){
    const v = counts[i] || 0;
    const h = Math.round((v / maxV) * (H-6));
    const x = i * barW;
    const y = H - h;

    const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
    r.setAttribute('x', String(x+0.6));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(Math.max(1, barW-1.2)));
    r.setAttribute('height', String(h));
    r.setAttribute('rx','1.6');
    r.setAttribute('class','uc-activity-bar');
    r.dataset.day = days[i];
    r.dataset.cnt = String(v);
    svg.appendChild(r);
  }

  svg.onmousemove = (e)=>{
    const t = e.target;
    if (!t || t.tagName !== 'rect') return;
    const day = t.dataset.day || '';
    const cnt = t.dataset.cnt || '0';
    if (tip){
      tip.textContent = `${day}: ${cnt}`;
      tip.classList.add('show');
      const box = svg.getBoundingClientRect();
      tip.style.left = (e.clientX - box.left + 10) + 'px';
      tip.style.top  = (e.clientY - box.top - 10) + 'px';
    }
  };
  svg.onmouseleave = ()=>{
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

  el.onclick = ()=>{
    window.__ucDonutMetric = (metric === 'duels') ? 'turnover' : 'duels';
    renderDonut(stakes);
  };
}

})();
