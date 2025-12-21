// /js/duels-lobby.js — Лобби дуэлей 1v1 (создать / список / join / cancel)
// Работает с backend: GET /api/duels?status=open, POST /api/duels/create, POST /api/duels/:id/join, POST /api/duels/:id/cancel
(function(){
  function byId(id){ return document.getElementById(id); }
  function readMeta(name){
    const m = document.querySelector('meta[name="'+name+'"]');
    return m ? (m.getAttribute('content')||'').trim() : '';
  }
  function API(){ return readMeta('api-base') || (window.API_BASE||'').trim() || 'https://vercel2pr.onrender.com'; }

  function fmtRub(n){
    try{ return '₽ ' + (Number(n)||0).toLocaleString('ru-RU'); }catch(_){ return '₽ 0'; }
  }
  function safeText(x){ return (x==null?'':String(x)); }

  function toast(title, body){
    const wrap = byId('toast');
    const t = byId('toast-title');
    const b = byId('toast-body');
    if (!wrap || !t || !b) return;
    t.textContent = safeText(title);
    b.textContent = safeText(body);
    wrap.classList.add('show');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(()=>wrap.classList.remove('show'), 4200);
  }

  function timeShort(iso){
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    // коротко: «19:42»
    try{ return d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }); }catch(_){ return ''; }
  }

  async function apiJson(path, opts){
    const url = API() + path;
    const o = Object.assign({ credentials:'include', cache:'no-store' }, opts||{});
    if (o.body && typeof o.body !== 'string'){
      o.headers = Object.assign({ 'Content-Type':'application/json' }, o.headers||{});
      o.body = JSON.stringify(o.body);
    }
    const r = await fetch(url, o);
    let j = null;
    try{ j = await r.json(); }catch(_){ j = null; }
    return { r, j };
  }

  async function refreshBalance(){
    // Мягкий рефреш: только цифра баланса (UI профиля остаётся как есть)
    try{
      const { r, j } = await apiJson('/api/me');
      if (!r.ok || !j || !j.ok || !j.user) return null;
      const balWrap = byId('user-balance');
      const span = balWrap ? balWrap.querySelector('[data-balance]') : null;
      if (span) span.textContent = String(Number(j.user.balance||0));
      return j.user;
    }catch(_){ return null; }
  }

  let myUserId = null;
  let lastMyOpenSet = new Set(); // id комнат, созданных мной, которые сейчас видны в open-списке

  async function initMe(){
    try{
      const { r, j } = await apiJson('/api/me');
      if (r.ok && j && j.ok && j.user){
        myUserId = Number(j.user.id || 0) || null;
        return j.user;
      }
    }catch(_){ }
    return null;
  }

  function renderList(items){
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
      row.className = 'duel-item clickable';
      row.setAttribute('data-id', String(it.id||''));
      row.addEventListener('click', function(ev){
        if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
        openDuelModal(it.id);
      });

      const left = document.createElement('div');
      left.className = 'duel-left';

      const img = document.createElement('img');
      img.alt = 'Создатель';
      img.src = it.creator_avatar || '';
      left.appendChild(img);

      const txt = document.createElement('div');
      txt.style.minWidth = '0';

      const name = [it.creator_first_name, it.creator_last_name].filter(Boolean).join(' ') || 'Игрок';
      const title = document.createElement('div');
      title.className = 'duel-title';
      title.textContent = fmtRub(it.stake) + ' · ' + name;

      const sub = document.createElement('div');
      sub.className = 'duel-sub';
      const t = timeShort(it.created_at);
      sub.textContent = 'Комната #' + it.id + (t ? (' · ' + t) : '') + ' · комиссия ' + ((Number(it.fee_bps||0)/100)||0) + '%';

      txt.appendChild(title);
      txt.appendChild(sub);

      left.appendChild(txt);

      const actions = document.createElement('div');
      actions.className = 'duel-actions';

      const isMine = myUserId && Number(it.creator_user_id) === myUserId;

      const btn = document.createElement('button');
      btn.className = 'btn ' + (isMine ? 'danger' : 'primary');
      btn.type = 'button';
      btn.textContent = isMine ? 'Отменить' : 'Войти';
      btn.onclick = async function(){
        btn.disabled = true;
        try{
          if (isMine) await cancelDuel(it.id);
 
  function renderHistory(items){
    const list = byId('history-list');
    if (!list) return;
    list.innerHTML = '';

    if (!items || !items.length){
      const d = document.createElement('div');
      d.className = 'muted';
      d.textContent = 'История пока пуста. Сыграй дуэль — и тут появится хроника побед и трагедий.';
      list.appendChild(d);
      return;
    }

    for (const it of items){
      const row = document.createElement('div');
      row.className = 'duel-item clickable';
      row.setAttribute('data-id', String(it.id||''));
      row.addEventListener('click', function(ev){
        if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
        openDuelModal(it.id);
      });

      const left = document.createElement('div');
      left.className = 'duel-left';

      const isCreator = myUserId && Number(it.creator_user_id) === myUserId;
      const otherFirst = isCreator ? it.opponent_first_name : it.creator_first_name;
      const otherLast  = isCreator ? it.opponent_last_name  : it.creator_last_name;
      const otherName  = [otherFirst, otherLast].filter(Boolean).join(' ') || (it.opponent_user_id ? 'Игрок' : '—');
      const otherAvatar = (isCreator ? it.opponent_avatar : it.creator_avatar) || it.creator_avatar || '';

      const img = document.createElement('img');
      img.alt = 'Игрок';
      img.src = otherAvatar || '';
      left.appendChild(img);

      const txt = document.createElement('div');
      txt.style.minWidth = '0';

      const title = document.createElement('div');
      title.className = 'duel-title';
      title.textContent = fmtRub(it.stake) + ' · vs ' + otherName;

      const sub = document.createElement('div');
      sub.className = 'duel-sub';
      const t = timeShort(it.finished_at || it.updated_at || it.created_at);
      const pot = it.result && (it.result.pot ?? it.result.pot_amount);
      const fee = it.result && (it.result.fee ?? it.result.fee_amount);
      const extra = (pot!=null && fee!=null) ? (' · ' + fmtRub(pot) + ' / ' + String(fee)) : '';
      sub.textContent = 'Комната #' + it.id + (t ? (' · ' + t) : '') + extra;

      txt.appendChild(title);
      txt.appendChild(sub);
      left.appendChild(txt);

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '10px';

      const badge = document.createElement('div');
      badge.className = 'badge';
      if (String(it.status) !== 'finished'){
        badge.classList.add('cancel');
        badge.textContent = 'Отмена';
      } else if (myUserId && Number(it.winner_user_id) === myUserId){
        badge.classList.add('win');
        badge.textContent = 'Победа';
      } else {
        badge.classList.add('lose');
        badge.textContent = 'Поражение';
      }

      right.appendChild(badge);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    }
  }

         else await joinDuel(it.id);
        } finally {
          btn.disabled = false;
        }
      };

      actions.appendChild(btn);

      row.appendChild(left);
      row.appendChild(actions);
      list.appendChild(row);
    }
  }

  async function loadOpenDuels(opts){
    const silent = !!(opts && opts.silent);
    const list = byId('duels-list');
    if (!silent && list) list.innerHTML = '<div class="muted">Загружаю комнаты…</div>';

    try{
      const { r, j } = await apiJson('/api/duels?status=open&order=queue&limit=10');
      if (!r.ok || !j || !j.ok){
        if (r.status === 401) toast('Нужен вход', 'Сессия не найдена. Открой главную и войди через VK/TG.');
        else toast('Не получилось', 'Не удалось загрузить список комнат.');
        renderList([]);
        return;
      }
      const items = j.items || [];
      renderList(items);
      handleCreatorTransitions(items); // если моя комната исчезла из open — обновим историю один раз
    } catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось получить комнаты.');
      renderList([]);
    }
  }


  async function loadHistoryDuels(opts){
    const silent = !!(opts && opts.silent);
    const list = byId('history-list');
    if (!silent && list) list.innerHTML = '<div class="muted">Загружаю историю…</div>';

    try{
      const { r, j } = await apiJson('/api/duels/history?limit=10');
      if (!r.ok || !j || !j.ok){
        if (r.status === 401) {
          // История требует авторизацию — если сессии нет, просто покажем мягко
          renderHistory([]);
          return;
        }
        renderHistory([]);
        return;
      }
      renderHistory(j.items || []);
    } catch(e){
      console.error(e);
      renderHistory([]);
    }
  }

  async function handleCreatorTransitions(openItems){
    // Нужна только создателю: он должен сразу увидеть, что его комнату сыграли.
    if (!myUserId) return;
    const now = new Set();
    for (const it of (openItems || [])){
      if (Number(it.creator_user_id || 0) === myUserId) now.add(Number(it.id));
    }

    // Если раньше моя комната была в open, а теперь исчезла — значит её заджойнили и она завершилась/отменилась.
    if (lastMyOpenSet && lastMyOpenSet.size){
      const gone = [];
      for (const id of lastMyOpenSet){
        if (!now.has(id)) gone.push(id);
      }
      if (gone.length){
        try{ toast('Дуэль завершена', 'Комната ' + gone.map(x=>'#'+x).join(', ') + ' закрылась. Обновляю историю…'); }catch(_){ }
        try{ await Promise.all([refreshBalance(), loadHistoryDuels({ silent:true })]); }catch(_){ }
      }
    }
    lastMyOpenSet = now;
  }

  let refreshInFlight = false;
  async function refreshAll(opts){
    if (refreshInFlight) return;
    refreshInFlight = true;
    try{
      // Историю не дёргаем в авто-обновлении: только при ручном refresh/важном событии.
      const silent = !!(opts && opts.silent);
      if (silent){
        await loadOpenDuels(opts);
      } else {
        await Promise.all([
          loadOpenDuels(opts),
          loadHistoryDuels(opts)
        ]);
      }
    } finally {
      refreshInFlight = false;
    }
  }

  function startAutoRefresh(){
    if (startAutoRefresh._started) return;
    startAutoRefresh._started = true;

    const fastMs = 4500;   // когда у меня есть открытая комната (я создатель)
    const slowMs = 12000;  // всем остальным — без лишнего спама

    async function tick(){
      try{
        if (!document.hidden){
          // Авто-обновление: только open-румы. История обновляется один раз, когда моя комната исчезает.
          await loadOpenDuels({ silent:true });
        }
      }catch(_){ }

      const isCreatorWatching = !!(myUserId && lastMyOpenSet && lastMyOpenSet.size > 0);
      const nextMs = isCreatorWatching ? fastMs : slowMs;
      startAutoRefresh._t = setTimeout(tick, nextMs);
    }

    startAutoRefresh._t = setTimeout(tick, 1500);
  }

  function el(id){ return document.getElementById(id); }

  function showCoin(ms){
    const o = el('coin-overlay');
    if (!o) return new Promise(r => setTimeout(r, ms||0));
    o.hidden = false;
    return new Promise(resolve => {
      setTimeout(() => { o.hidden = true; resolve(); }, ms || 0);
    });
  }

  function openDuelModal(id){
    const modal = el('duel-modal');
    const body = el('duel-modal-body');
    const title = el('duel-modal-title');
    if (!modal || !body) return;

    modal.hidden = false;
    if (title) title.textContent = 'Комната #' + id;
    body.innerHTML = '<div class="muted">Загружаю детали…</div>';

    apiJson('/api/duels/' + encodeURIComponent(id))
      .then(({r,j}) => {
        if (!r.ok || !j || !j.ok || !j.item){
          body.innerHTML = '<div class="muted">Не удалось загрузить детали.</div>';
          return;
        }
        const it = j.item;
        const cName = [it.creator_first_name, it.creator_last_name].filter(Boolean).join(' ') || ('user#' + it.creator_user_id);
        const oName = it.opponent_user_id ? ([it.opponent_first_name, it.opponent_last_name].filter(Boolean).join(' ') || ('user#' + it.opponent_user_id)) : '—';
        const wName = it.winner_user_id ? ([it.winner_first_name, it.winner_last_name].filter(Boolean).join(' ') || ('user#' + it.winner_user_id)) : '—';

        const res = it.result || {};
        const pot = (res.pot != null) ? res.pot : (Number(it.stake||0) * 2);
        const fee = (res.fee != null) ? res.fee : Math.round((Number(pot)||0) * (Number(it.fee_bps||0)/10000));
        const payout = (res.payout != null) ? res.payout : ((Number(pot)||0) - (Number(fee)||0));

        const status = safeText(it.status || '');

        if (title) title.textContent = 'Комната #' + it.id + (status ? (' · ' + status) : '');

        function row(k,v){
          return '<div class="kv"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>';
        }

        const html = [
          '<div class="kv-grid">',
          row('Режим', safeText(it.mode||'1v1')),
          row('Ставка', safeText(it.stake)),
          row('Банк (pot)', safeText(pot)),
          row('Комиссия (fee)', safeText(fee)),
          row('Выплата (payout)', safeText(payout)),
          row('Создатель', safeText(cName)),
          row('Соперник', safeText(oName)),
          row('Победитель', safeText(wName)),
          row('Создано', safeText(it.created_at||'')),
          row('Завершено', safeText(it.finished_at||'')),
          '</div>'
        ].join('');

        body.innerHTML = html;
      })
      .catch(() => {
        body.innerHTML = '<div class="muted">Не удалось загрузить детали.</div>';
      });
  }

  function closeDuelModal(){
    const modal = el('duel-modal');
    if (modal) modal.hidden = true;
  }


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
      toast('Ставка странная', 'Введите число от 10 до 1 000 000.');
      return;
    }

    const btn = byId('duels-create');
    if (btn) btn.disabled = true;

    try{
      const { r, j } = await apiJson('/api/duels/create', {
        method:'POST',
        body:{ stake, fee_bps: 500, meta:{ src:'lobby' } }
      });

      if (!r.ok || !j || !j.ok){
        if (r.status === 401) {
          toast('Нужен вход', 'Сессия не найдена. Открой главную и войди через VK/TG.');
          return;
        }
        if (r.status === 402) {
          toast('Недостаточно средств', 'На HUM-кошельке не хватает на эту ставку.');
          return;
        }
        toast('Не создалось', (j && j.error) ? ('Ошибка: ' + j.error) : 'Попробуй ещё раз.');
        return;
      }

      toast('Комната создана', 'Комната #' + j.room.id + ' на ' + fmtRub(stake) + '. Ждём соперника.');
      await Promise.all([refreshAll(), refreshBalance()]);
    } catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось создать комнату.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function joinDuel(id){
    try{
      const { r, j } = await apiJson('/api/duels/' + encodeURIComponent(id) + '/join', { method:'POST' });
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

      await showCoin(3200);

      if (iWon){
        toast('GG! Победа', '+' + fmtRub(payout) + ' · комиссия ' + fmtRub(fee));
      } else {
        toast('Сегодня не твой coinflip', '-' + fmtRub(stake) + '. Это не «не повезло» — это статистика. Реванш?');
      }

      await Promise.all([refreshAll(), refreshBalance()]);
    } catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось войти в комнату.');
    }
  }

  async function cancelDuel(id){
    try{
      const { r, j } = await apiJson('/api/duels/' + encodeURIComponent(id) + '/cancel', { method:'POST' });
      if (!r.ok || !j || !j.ok){
        if (r.status === 401) toast('Нужен вход', 'Сессия не найдена.');
        else toast('Не отменилось', (j && j.error) ? ('Ошибка: ' + j.error) : 'Попробуй ещё раз.');
        return;
      }
      toast('Комната отменена', 'Холд вернулся на баланс.');
      await Promise.all([refreshAll(), refreshBalance()]);
    } catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось отменить комнату.');
    }
  }

  // ----- init -----
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
    if (refreshBtn) refreshBtn.addEventListener('click', refreshAll);

    // модалка деталей дуэли
    const modal = byId('duel-modal');
    const modalClose = byId('duel-modal-close');
    if (modalClose) modalClose.addEventListener('click', closeDuelModal);
    if (modal) modal.addEventListener('click', function(e){ if (e && e.target === modal) closeDuelModal(); });
    window.addEventListener('keydown', function(e){ if (e && e.key === 'Escape') closeDuelModal(); });

    await initMe();
    await refreshAll();
    startAutoRefresh();
  });
})();