// /js/duels-lobby.js — Лобби дуэлей 1v1
// Фичи: очередь open (FIFO), история (без polling), детали дуэли, монетка 3.2с перед результатом,
// авто-обновление open только для создателя, когда у него есть открытая комната.
(function(){
  function byId(id){ return document.getElementById(id); }
  function readMeta(name){
    const m = document.querySelector('meta[name="'+name+'"]');
    return m ? (m.getAttribute('content')||'').trim() : '';
  }
  function API(){ return readMeta('api-base') || (window.API_BASE||'').trim() || 'https://vercel2pr.onrender.com'; }

  function fmtRub(n){
    try{ return (Number(n)||0).toLocaleString('ru-RU'); }catch(_){ return String(n||0); }
  }
  function timeShort(ts){
    if (!ts) return '';
    try{
      const d = new Date(ts);
      return d.toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    }catch(_){ return ''; }
  }
  function safe(x){ return (x==null?'':String(x)); }

  function toast(title, body){
    const wrap = byId('toast');
    const t = byId('toast-title');
    const b = byId('toast-body');
    if (!wrap || !t || !b) return;
    t.textContent = safe(title);
    b.textContent = safe(body);
    wrap.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>wrap.classList.remove('show'), 3800);
  }

  async function apiJson(path, opt){
    const url = API().replace(/\/+$/,'') + path;
    const o = Object.assign({ method:'GET', credentials:'include' }, opt||{});
    if (o.body && typeof o.body === 'object' && !(o.body instanceof FormData)){
      o.headers = Object.assign({ 'content-type':'application/json' }, (o.headers||{}));
      o.body = JSON.stringify(o.body);
    }
    const r = await fetch(url, o);
    let j = null;
    try{ j = await r.json(); }catch(_){ j = null; }
    return { r, j };
  }

  let myUserId = null;
  let lastMyOpenIds = new Set();
  let pollTimer = null;

  async function initMe(){
    try{
      const { r, j } = await apiJson('/api/me');
      if (r.ok && j && j.ok && j.user){
        myUserId = Number(j.user.id||0) || null;
        const balEl = byId('user-balance');
        if (balEl) balEl.textContent = fmtRub(j.user.balance||0);
        return j.user;
      }
    }catch(_){}
    return null;
  }

  async function refreshBalance(){
    try{
      const { r, j } = await apiJson('/api/me');
      if (r.ok && j && j.ok && j.user){
        const balEl = byId('user-balance');
        if (balEl) balEl.textContent = fmtRub(j.user.balance||0);
      }
    }catch(_){}
  }

  function showCoin(show){
    const ov = byId('coin-overlay');
    if (!ov) return;
    ov.style.display = show ? 'flex' : 'none';
  }

  function delay(ms){ return new Promise(res=>setTimeout(res, ms)); }

  async function withCoin(fn){
    const start = Date.now();
    showCoin(true);
    try{
      return await fn();
    } finally {
      const spent = Date.now() - start;
      const minShow = 3200;
      if (spent < minShow) await delay(minShow - spent);
      showCoin(false);
    }
  }

  function nameFromUser(u){
    if (!u) return '';
    const fn = u.first_name || u.firstName || '';
    const ln = u.last_name || u.lastName || '';
    const full = (fn + ' ' + ln).trim();
    return full || u.name || ('id ' + (u.id||u.user_id||''));
  }

  // ------- modal -------
  function openModal(title, kvObj){
    const wrap = byId('duel-modal');
    const titleEl = byId('duel-modal-title');
    const kv = byId('duel-modal-kv');
    if (!wrap || !titleEl || !kv) return;
    titleEl.textContent = title || 'Дуэль';
    kv.innerHTML = '';
    for (const [k,v] of Object.entries(kvObj||{})){
      const kEl = document.createElement('div');
      kEl.className = 'k';
      kEl.textContent = k;
      const vEl = document.createElement('div');
      vEl.className = 'v';
      vEl.textContent = safe(v);
      kv.appendChild(kEl);
      kv.appendChild(vEl);
    }
    wrap.style.display = 'flex';
  }
  function closeModal(){
    const wrap = byId('duel-modal');
    if (wrap) wrap.style.display = 'none';
  }

  async function showDuelDetails(id){
    try{
      const { r, j } = await apiJson('/api/duels/' + encodeURIComponent(id));
      if (!r.ok || !j || !j.ok || !j.item){
        openModal('Дуэль #' + id, { 'Ошибка': 'Не удалось загрузить детали' });
        return;
      }
      const it = j.item;
      const res = it.result || {};
      const pot = res.pot ?? (Number(it.stake||0)*2);
      const fee = res.fee ?? Math.round(Number(pot||0) * (Number(it.fee_bps||0)/10000));
      const payout = res.payout ?? (Number(pot||0) - Number(fee||0));
      openModal('Дуэль #' + it.id, {
        'Статус': it.status || '',
        'Ставка': fmtRub(it.stake||0),
        'Пот': fmtRub(pot||0),
        'Рейк': fmtRub(fee||0),
        'Выплата победителю': fmtRub(payout||0),
        'Создатель': nameFromUser(it.creator) || ('user_id ' + it.creator_user_id),
        'Оппонент': it.opponent_user_id ? (nameFromUser(it.opponent) || ('user_id ' + it.opponent_user_id)) : '—',
        'Победитель': it.winner_user_id ? ('user_id ' + it.winner_user_id) : '—',
        'Создано': timeShort(it.created_at),
        'Завершено': timeShort(it.finished_at),
        'Метод': res.method || ''
      });
    }catch(e){
      console.error(e);
      openModal('Дуэль #' + id, { 'Ошибка': 'Сеть шалит' });
    }
  }

  // ------- render open -------
  function renderOpen(items){
    const list = byId('duels-list');
    if (!list) return;
    list.innerHTML = '';

    if (!items || !items.length){
      const d = document.createElement('div');
      d.className = 'muted';
      d.textContent = 'Пока нет открытых комнат. Создай первую — пусть монета выберет драму.';
      list.appendChild(d);
      return;
    }

    for (const it of items){
      const row = document.createElement('div');
      row.className = 'duel-item';
      row.style.cursor = 'pointer';
      row.onclick = function(ev){
        // если клик по кнопке — не открываем модалку
        if (ev && ev.target && (ev.target.tagName === 'BUTTON')) return;
        showDuelDetails(it.id);
      };

      const left = document.createElement('div');
      left.className = 'duel-left';

      const ava = document.createElement('div');
      ava.className = 'avatar';
      ava.textContent = '🎲';

      const txt = document.createElement('div');
      txt.className = 'duel-text';

      const title = document.createElement('div');
      title.className = 'duel-title';
      title.textContent = fmtRub(it.stake||0) + ' · ' + (it.creator ? nameFromUser(it.creator) : ('user_id ' + it.creator_user_id));

      const sub = document.createElement('div');
      sub.className = 'duel-sub';
      sub.textContent = 'Комната #' + it.id + ' · ' + timeShort(it.created_at) + ' · комиссия ' + ((Number(it.fee_bps||0)/100)||0) + '%';

      txt.appendChild(title);
      txt.appendChild(sub);

      left.appendChild(ava);
      left.appendChild(txt);

      const actions = document.createElement('div');
      actions.className = 'duel-actions';

      const isMine = myUserId && Number(it.creator_user_id) === myUserId;
      const btn = document.createElement('button');
      btn.className = 'btn ' + (isMine ? 'danger' : 'primary');
      btn.type = 'button';
      btn.textContent = isMine ? 'Отменить' : 'Войти';
      btn.onclick = async function(ev){
        ev.stopPropagation();
        btn.disabled = true;
        try{
          if (isMine) await cancelDuel(it.id);
          else await joinDuel(it.id);
        } finally { btn.disabled = false; }
      };

      actions.appendChild(btn);

      row.appendChild(left);
      row.appendChild(actions);
      list.appendChild(row);
    }
  }

  // ------- render history -------
  function renderHistory(items){
    const list = byId('history-list');
    if (!list) return;
    list.innerHTML = '';

    if (!items || !items.length){
      const d = document.createElement('div');
      d.className = 'muted';
      d.textContent = 'Пока нет игр. Самое время начать первую.';
      list.appendChild(d);
      return;
    }

    for (const it of items){
      const row = document.createElement('div');
      row.className = 'history-item';
      row.onclick = ()=>showDuelDetails(it.id);

      const left = document.createElement('div');
      left.className = 'history-left';

      const res = it.result || {};
      const pot = res.pot ?? (Number(it.stake||0)*2);
      const fee = res.fee ?? Math.round(Number(pot||0) * (Number(it.fee_bps||0)/10000));
      const payout = res.payout ?? (Number(pot||0) - Number(fee||0));

      const winner = Number(it.winner_user_id || (res.winner_user_id||0) || 0);
      const isFinished = (it.status === 'finished');
      const isCancelled = (it.status === 'cancelled');

      let pill = document.createElement('span');
      pill.className = 'pill';

      if (isCancelled){
        pill.classList.add('cancel');
        pill.textContent = 'отменена';
      } else if (isFinished && myUserId){
        if (winner === myUserId){
          pill.classList.add('win');
          pill.textContent = 'победа';
        } else {
          pill.classList.add('lose');
          pill.textContent = 'поражение';
        }
      } else if (isFinished){
        pill.textContent = 'завершена';
      } else {
        pill.textContent = it.status || '';
      }

      const opponentId = myUserId
        ? (Number(it.creator_user_id)===myUserId ? it.opponent_user_id : it.creator_user_id)
        : (it.opponent_user_id || it.creator_user_id);

      const who = document.createElement('div');
      who.style.fontWeight = '700';
      who.textContent = 'Дуэль #' + it.id + ' · vs user_id ' + safe(opponentId || '—');

      const meta = document.createElement('div');
      meta.className = 'muted';
      meta.style.fontSize = '13px';
      meta.textContent = timeShort(it.finished_at || it.updated_at || it.created_at);

      left.appendChild(who);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'history-right';

      const top = document.createElement('div');
      top.textContent = fmtRub(pot||0) + ' / ' + fmtRub(fee||0);

      const bottom = document.createElement('div');
      bottom.appendChild(pill);

      right.appendChild(top);
      right.appendChild(bottom);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    }
  }

  async function loadHistory(){
    const list = byId('history-list');
    if (list) list.innerHTML = '<div class="muted">Загружаю историю…</div>';
    const { r, j } = await apiJson('/api/duels/history?limit=10');
    if (!r.ok || !j || !j.ok){
      renderHistory([]);
      return;
    }
    renderHistory(j.items || []);
  }

  async function loadOpen(){
    const list = byId('duels-list');
    if (list) list.innerHTML = '<div class="muted">Загружаю комнаты…</div>';

    const { r, j } = await apiJson('/api/duels?status=open&order=queue&limit=10');
    if (!r.ok || !j || !j.ok){
      if (r.status === 401) toast('Нужен вход', 'Сессия не найдена. Открой главную и войди через VK/TG.');
      renderOpen([]);
      return [];
    }
    const items = j.items || [];
    renderOpen(items);
    return items;
  }

  function schedulePoll(hasMyOpen){
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    if (!hasMyOpen) return;
    pollTimer = setTimeout(async ()=>{
      if (document.hidden) { schedulePoll(true); return; }
      await pollOpenOnce();
      schedulePoll(true);
    }, 4500);
  }

  async function pollOpenOnce(){
    const items = await loadOpen();
    const myOpenIds = new Set();
    if (myUserId){
      for (const it of items){
        if (Number(it.creator_user_id) === myUserId) myOpenIds.add(String(it.id));
      }
    }
    const had = lastMyOpenIds.size > 0;
    const has = myOpenIds.size > 0;

    // если у меня была открытая, а теперь нет — значит её заджойнили/закрыли → один раз обновляем историю и баланс
    if (had && !has){
      await Promise.all([refreshBalance(), loadHistory()]);
      toast('Есть результат', 'Твоя комната исчезла из очереди — смотри историю ниже.');
    }

    lastMyOpenIds = myOpenIds;
    schedulePoll(has);
  }

  // ------- actions -------
  function readStake(){
    const inp = byId('stake-input');
    const v = Number(inp ? inp.value : 0);
    if (!Number.isFinite(v)) return null;
    const k = Math.trunc(v);
    if (k < 10 || k > 1_000_000) return null;
    return k;
  }

  async function createDuel(){
    const stake = readStake();
    if (!stake){
      toast('Ставка', 'Введи корректную сумму (>=10).');
      return;
    }
    const btn = byId('duels-create');
    if (btn) btn.disabled = true;
    try{
      const { r, j } = await apiJson('/api/duels/create', { method:'POST', body:{ mode:'1v1', stake } });
      if (!r.ok || !j || !j.ok){
        if (r.status === 401) toast('Нужен вход', 'Сессия не найдена. Открой главную и войди через VK/TG.');
        else if (r.status === 402) toast('Недостаточно средств', 'На HUM-кошельке не хватает на ставку.');
        else toast('Не получилось', (j && j.error) ? ('Ошибка: ' + j.error) : 'Не удалось создать комнату.');
        return;
      }
      toast('Комната создана', 'Ждём соперника…');
      await pollOpenOnce(); // сразу загрузим и поставим polling если это моя комната
    }catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось создать комнату.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function cancelDuel(id){
    try{
      const { r, j } = await apiJson('/api/duels/' + encodeURIComponent(id) + '/cancel', { method:'POST' });
      if (!r.ok || !j || !j.ok){
        toast('Не отменилось', (j && j.error) ? ('Ошибка: ' + j.error) : 'Не удалось отменить.');
        return;
      }
      toast('Ок', 'Комната отменена.');
      await pollOpenOnce();
    }catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось отменить комнату.');
    }
  }

  async function joinDuel(id){
    try{
      const out = await withCoin(async ()=>{
        return await apiJson('/api/duels/' + encodeURIComponent(id) + '/join', { method:'POST' });
      });

      const r = out.r, j = out.j;
      if (!r.ok || !j || !j.ok){
        if (r.status === 401) toast('Нужен вход', 'Сессия не найдена. Открой главную и войди через VK/TG.');
        else if (r.status === 402) toast('Недостаточно средств', 'На HUM-кошельке не хватает на ставку.');
        else toast('Не зашёл', (j && j.error) ? ('Ошибка: ' + j.error) : 'Попробуй другую комнату.');
        return;
      }

      const res = j.result || {};
      const winner = Number(res.winner_user_id || 0);
      const stake = Number(res.stake || 0);
      const payout = Number(res.payout || 0);
      const fee = Number(res.fee || 0);

      const iWon = myUserId && winner === myUserId;

      if (iWon){
        toast('GG! Победа', '+' + fmtRub(payout) + ' · рейк ' + fmtRub(fee));
      } else {
        toast('Сегодня не твой coinflip', '-' + fmtRub(stake) + '. Реванш?');
      }

      // после join: баланс меняется + история должна появиться
      await Promise.all([pollOpenOnce(), refreshBalance(), loadHistory()]);
    }catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось войти в комнату.');
    }
  }

  // ------- init -------
  document.addEventListener('DOMContentLoaded', async function(){
    const createBtn = byId('duels-create');
    const refreshBtn = byId('duels-refresh');
    const stakeInp = byId('stake-input');

    // быстрые чипы
    document.querySelectorAll('.stake-chip').forEach(function(btn){
      btn.addEventListener('click', function(){
        const v = Number(btn.getAttribute('data-stake')||0);
        if (stakeInp && Number.isFinite(v) && v > 0) stakeInp.value = String(v);
      });
    });

    if (createBtn) createBtn.addEventListener('click', createDuel);
    if (refreshBtn) refreshBtn.addEventListener('click', pollOpenOnce);

    const closeBtn = byId('duel-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const modal = byId('duel-modal');
    if (modal) modal.addEventListener('click', (e)=>{ if (e.target === modal) closeModal(); });

    await initMe();
    await Promise.all([pollOpenOnce(), loadHistory()]);
  });
})();
