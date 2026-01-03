// admin/duel-card.js

(function(){
  const $ = (s, root=document)=> root.querySelector(s);

  function getApi(){
    const raw = (window.API || localStorage.getItem('ADMIN_API') || '').toString().trim();
    return (raw ? raw : location.origin).replace(/\/+$/, '');
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function fmtInt(n){
    const x = Number(n||0);
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('ru-RU');
  }

  function fmtMoney(n){
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('ru-RU') + ' ₽';
  }

  function fmtDT(v){
    if (!v) return '—';
    const s = String(v);
    // pg timestamp обычно "YYYY-MM-DD HH:MM:SS" или ISO
    if (s.includes('T')) return s.replace('T',' ').replace('Z','').slice(0,19);
    return s.slice(0,19);
  }

  function fmtDur(sec){
    const s = Number(sec);
    if (!Number.isFinite(s) || s < 0) return '—';
    if (s === 0) return '0с';
    let left = Math.round(s);
    const d = Math.floor(left / 86400); left -= d*86400;
    const h = Math.floor(left / 3600);  left -= h*3600;
    const m = Math.floor(left / 60);    left -= m*60;
    const parts = [];
    if (d) parts.push(d + 'д');
    if (h) parts.push(h + 'ч');
    if (m) parts.push(m + 'м');
    if (left) parts.push(left + 'с');
    return parts.join(' ');
  }

  async function jget(path){
    const url = getApi() + path;
    const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.ok){
      const msg = (j && (j.error || j.message)) ? (j.error || j.message) : ('HTTP ' + r.status);
      throw new Error(msg);
    }
    return j;
  }

  function setTopbar(duelId){
    const el = $('#dc-top-right');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
        <span class="muted tiny">id:</span>
        <span style="font-variant-numeric:tabular-nums">#${escapeHtml(duelId)}</span>
        <span class="muted tiny">·</span>
        <input class="input sm" id="dc-jump" placeholder="duel_id" style="width:110px" />
        <button class="btn sm" id="dc-go" type="button">Открыть</button>
      </div>
    `;

    const inp = $('#dc-jump');
    const btn = $('#dc-go');
    const go = ()=>{
      const v = Number(String(inp?.value||'').trim());
      if (Number.isFinite(v) && v>0) location.href = `/admin/duel-card.html?duel_id=${v}`;
    };
    btn?.addEventListener('click', go);
    inp?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); go(); } });
  }

  function statusHtml(s){
    const st = String(s || '—').toLowerCase().trim() || '—';
    const cls =
      st === 'finished' ? 'status-tag status-finished' :
      st === 'cancelled' ? 'status-tag status-cancelled' :
      st === 'open' ? 'status-tag status-open' :
      st === 'active' ? 'status-tag status-active' :
      'status-tag';
    return `<span class="${cls}">${escapeHtml(st)}</span>`;
  }

  function personCard(role, userId, u, isWinner){
    const id = userId ? Number(userId) : null;
    const name = (u && (u.first_name || u.last_name)) ? `${u.first_name||''} ${u.last_name||''}`.trim() : '';
    const hum = (u && u.hum_id != null) ? String(u.hum_id) : '';
    const avatar = (u && u.avatar) ? String(u.avatar) : '';

    const cls = isWinner ? 'dc-person win' : 'dc-person';
    const ava = avatar
      ? `<img src="${escapeHtml(avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : '';

    const title = `${role}${id ? ' · user_id #' + id : ''}${hum ? ' · HUM ' + hum : ''}${name ? ' · ' + name : ''}`;

    const links = id
      ? `
        <div class="dc-person-links">
          <a href="/admin/user-card.html?user_id=${id}" target="_blank" rel="noopener">Карточка пользователя</a>
          <a href="/admin/index2.html#duels" target="_blank" rel="noopener">Таблица дуэлей</a>
        </div>
      `
      : '';

    return `
      <div class="${cls}" title="${escapeHtml(title)}">
        <div class="dc-ava">${ava}</div>
        <div class="dc-person-meta">
          <div class="dc-person-name">${escapeHtml(name || (id ? `user_id #${id}` : '—'))}</div>
          <div class="dc-person-ids">
            <span class="muted tiny">${escapeHtml(role)} · </span>
            <span style="font-variant-numeric:tabular-nums">${id ? '#' + escapeHtml(id) : '—'}${hum ? ' · HUM ' + escapeHtml(hum) : ''}</span>
            ${isWinner ? ' · <span class="dc-badge">Победитель</span>' : ''}
          </div>
          ${links}
        </div>
      </div>
    `;
  }

  function renderAll(data){
    const duel = data.duel || {};
    const users = data.users || {};

    setTopbar(duel.id || '—');

    // head
    const head = $('#dc-head');
    if (head){
      const title = `Дуэль #${escapeHtml(duel.id ?? '—')} · ${escapeHtml(duel.mode || '1v1')}`;
      const sub = `${statusHtml(duel.status)} <span class="muted">·</span> created: ${escapeHtml(fmtDT(duel.created_at))}`;
      head.querySelector('.dc-title')?.classList.remove('skel','skel-line');
      head.querySelector('.dc-sub')?.classList.remove('skel','skel-line');
      head.querySelector('.dc-title').innerHTML = title;
      head.querySelector('.dc-sub').innerHTML = sub;

      const k = $('#dc-head-kpis');
      if (k){
        k.innerHTML = `
          <span class="dc-badge">stake: ${fmtMoney(duel.stake||0)}</span>
          <span class="dc-badge">fee_bps: ${escapeHtml(duel.fee_bps ?? '—')}</span>
          <span class="dc-badge">pot: ${fmtMoney(duel.pot ?? 0)}</span>
          <span class="dc-badge">rake: ${fmtMoney(duel.rake ?? 0)}</span>
        `;
      }
    }

    // participants
    {
      const el = $('#dc-participants .dc-panel-body');
      const creator = users.creator || null;
      const opponent = users.opponent || null;
      const winnerId = (duel.winner_user_id != null) ? Number(duel.winner_user_id) : null;

      const cId = duel.creator_user_id != null ? Number(duel.creator_user_id) : null;
      const oId = duel.opponent_user_id != null ? Number(duel.opponent_user_id) : null;

      el.innerHTML = `
        <div class="dc-people">
          ${personCard('Создатель', cId, creator, winnerId!=null && cId!=null && winnerId===cId)}
          <div class="dc-vs">VS</div>
          ${personCard('Оппонент', oId, opponent, winnerId!=null && oId!=null && winnerId===oId)}
        </div>
      `;
    }

    // timings
    {
      const t = data.timings || {};
      const el = $('#dc-timings .dc-panel-body');
      el.innerHTML = `
        <div class="dc-kv">
          <div class="k">Создана</div><div class="v">${escapeHtml(fmtDT(t.created_at || duel.created_at))}</div>
          <div class="k">Подключение оппонента</div><div class="v">${escapeHtml(fmtDT(t.joined_at))}</div>
          <div class="k">Завершена</div><div class="v">${escapeHtml(fmtDT(t.finished_at || duel.finished_at))}</div>
          <div class="k">Ожидание до join</div><div class="v">${t.wait_seconds!=null ? escapeHtml(fmtDur(t.wait_seconds)) : '—'}</div>
          <div class="k">Время от создания до финиша</div><div class="v">${t.duration_seconds!=null ? escapeHtml(fmtDur(t.duration_seconds)) : '—'}</div>
        </div>
      `;
    }

    // finance
    {
      const el = $('#dc-finance .dc-panel-body');
      const isCancelled = String(duel.status||'') === 'cancelled';
      const extra = isCancelled && duel.refund != null
        ? `<div class="k">Возврат создателю</div><div class="v">${fmtMoney(duel.refund)}</div>`
        : '';
      el.innerHTML = `
        <div class="dc-kv">
          <div class="k">stake</div><div class="v">${fmtMoney(duel.stake||0)}</div>
          <div class="k">pot</div><div class="v">${fmtMoney(duel.pot ?? 0)}</div>
          <div class="k">rake</div><div class="v">${fmtMoney(duel.rake ?? 0)}</div>
          <div class="k">payout (победителю)</div><div class="v">${duel.payout!=null ? fmtMoney(duel.payout) : '—'}</div>
          ${extra}
        </div>
      `;
    }

    // rng
    {
      const el = $('#dc-rng .dc-panel-body');
      const rng = data.rng || null;
      if (!rng){
        el.innerHTML = `<div class="muted">Нет данных (duel_rooms.result пустой или отсутствует).</div>`;
      } else {
        el.innerHTML = `
          <div class="dc-kv">
            <div class="k">method</div><div class="v">${escapeHtml(rng.method || '—')}</div>
            <div class="k">rand_source</div><div class="v">${escapeHtml(rng.rand_source || '—')}</div>
            <div class="k">winner_user_id</div><div class="v">${rng.winner_user_id!=null ? '#' + escapeHtml(rng.winner_user_id) : '—'}</div>
            <div class="k">credited_user_id</div><div class="v">${rng.credited_user_id!=null ? '#' + escapeHtml(rng.credited_user_id) : '—'}</div>
          </div>
          <div class="note muted tiny" style="margin-top:8px">
            Сейчас MVP хранит только итог (method/rand_source). Если захочешь «provably fair» — добавим seed/nonce/commit.
          </div>
        `;
      }
    }

    // events
    {
      const tbody = $('#dc-events-table tbody');
      const items = Array.isArray(data.events) ? data.events : [];
      if (!items.length){
        tbody.innerHTML = `<tr><td colspan="5" class="muted">Событий по этой дуэли не найдено</td></tr>`;
      } else {
        tbody.innerHTML = items.map(e=>{
          const amount = (e.amount==null) ? '—' : fmtMoney(e.amount);
          const uid = (e.user_id==null || e.user_id==='') ? '—' : ('#' + escapeHtml(e.user_id));

          const payload = e.payload ? JSON.stringify(e.payload, null, 2) : '';
          const meta = e.meta ? JSON.stringify(e.meta, null, 2) : '';

          const details = `
            <details>
              <summary class="muted">payload / meta</summary>
              ${payload ? `<div class="tiny muted" style="margin-top:6px">payload:</div><pre class="out">${escapeHtml(payload)}</pre>` : ''}
              ${meta ? `<div class="tiny muted" style="margin-top:6px">meta:</div><pre class="out">${escapeHtml(meta)}</pre>` : ''}
              ${(e.ip || e.ua) ? `<div class="tiny muted" style="margin-top:6px">ip/ua:</div><pre class="out">${escapeHtml(String(e.ip||''))}\n${escapeHtml(String(e.ua||''))}</pre>` : ''}
            </details>
          `;

          return `
            <tr>
              <td class="muted">${escapeHtml(fmtDT(e.created_at))}</td>
              <td>${escapeHtml(e.event_type || '—')}</td>
              <td>${uid}</td>
              <td class="right">${amount}</td>
              <td>${details}</td>
            </tr>
          `;
        }).join('');
      }

      // raw
      const raw = $('#dc-raw-json');
      if (raw){
        raw.textContent = JSON.stringify({ duel: data.duel, users: data.users }, null, 2);
      }
    }
  }

  async function boot(){
    const qs = new URLSearchParams(location.search);
    const duelId = Number(String(qs.get('duel_id') || qs.get('id') || '').trim());

    const headTitle = $('#dc-head .dc-title');
    const headSub = $('#dc-head .dc-sub');
    if (headTitle) headTitle.textContent = 'Загрузка…';
    if (headSub) headSub.textContent = '';

    if (!Number.isFinite(duelId) || duelId <= 0){
      setTopbar('—');
      const el = $('#dc-participants .dc-panel-body');
      if (el) el.innerHTML = `<div class="muted">Не указан duel_id в URL. Пример: <code>/admin/duel-card.html?duel_id=123</code></div>`;
      return;
    }

    try{
      const tz = 'Europe/Moscow';
      const data = await jget(`/api/admin/duel-card?duel_id=${encodeURIComponent(duelId)}&tz=${encodeURIComponent(tz)}`);
      renderAll(data);
    }catch(err){
      console.error(err);
      setTopbar(duelId);
      const el = $('#dc-participants .dc-panel-body');
      if (el) el.innerHTML = `<div class="muted">Ошибка загрузки: ${escapeHtml(err?.message||err)}</div>`;
      const tbody = $('#dc-events-table tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="muted">—</td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
