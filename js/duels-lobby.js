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
      row.className = 'duel-item';

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

  
  // ----- history -----
  function renderHistory(items){
    const list = byId('duels-history-list');
    if (!list) return;
    list.innerHTML = '';

    if (!items || !items.length){
      const d = document.createElement('div');
      d.className = 'muted';
      d.textContent = 'Пока нет игр. Самое время устроить первую драму.';
      list.appendChild(d);
      return;
    }

    for (const it of items){
      const row = document.createElement('div');
      row.className = 'duel-item';
      row.style.cursor = 'default';

      // кто соперник (для отображения)
      const iAmCreator = myUserId && Number(it.creator_user_id) === myUserId;
      const oppFirst = iAmCreator ? it.opponent_first_name : it.creator_first_name;
      const oppLast  = iAmCreator ? it.opponent_last_name  : it.creator_last_name;
      const oppAvatar = iAmCreator ? it.opponent_avatar : it.creator_avatar;

      const left = document.createElement('div');
      left.className = 'duel-left';

      const img = document.createElement('img');
      img.className = 'avatar';
      img.alt = '';
      img.src = oppAvatar || '';
      left.appendChild(img);

      const txt = document.createElement('div');
      txt.style.minWidth = '0';

      const oppName = [oppFirst, oppLast].filter(Boolean).join(' ') || 'Соперник';
      const title = document.createElement('div');
      title.className = 'duel-title';

      // статус win/lose/cancel
      let badge = '';
      if (String(it.status) === 'cancelled'){
        badge = ' · отмена';
      } else if (myUserId && Number(it.winner_user_id) === myUserId){
        badge = ' · победа';
      } else if (myUserId && Number(it.winner_user_id) && Number(it.winner_user_id) !== myUserId){
        badge = ' · поражение';
      }

      title.textContent = fmtRub(it.stake) + ' · ' + oppName + badge;

      const sub = document.createElement('div');
      sub.className = 'duel-sub';
      const t = timeShort(it.finished_at || it.updated_at || it.created_at);

      // пот/фии из result (если есть)
      let pot = 0, fee = 0, payout = 0;
      try{
        const r = it.result || {};
        pot = Number(r.pot || 0);
        fee = Number(r.fee || 0);
        payout = Number(r.payout || 0);
      }catch(_e){}

      const parts = [];
      parts.push('Комната #' + it.id);
      if (t) parts.push(t);
      if (pot) parts.push('банк ' + fmtRub(pot));
      if (fee) parts.push('комиссия ' + fmtRub(fee));
      if (payout) parts.push('выплата ' + fmtRub(payout));
      sub.textContent = parts.join(' · ');

      txt.appendChild(title);
      txt.appendChild(sub);

      left.appendChild(txt);
      row.appendChild(left);
      list.appendChild(row);
    }
  }

  async function loadHistoryDuels(){
    const list = byId('duels-history-list');
    if (list) list.innerHTML = '<div class="muted">Загружаю историю…</div>';

    try{
      const { r, j } = await apiJson('/api/duels/history?limit=10');
      if (!r.ok || !j || !j.ok){
        if (r.status === 401) {
          // не спамим тостами — история просто будет скрыта
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

  // ----- polling (только когда у тебя есть своя открытая комната) -----
  let pollTimer = null;
  let lastMyOpenIds = {};

  function setPoll(ms){
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (!ms || ms < 1000) return;
    pollTimer = setInterval(function(){
      if (document.hidden) return;
      loadOpenDuels(true);
    }, ms);
  }

  function idsMap(arr){
    const m = {};
    (arr||[]).forEach(function(x){ m[String(x)] = 1; });
    return m;
  }

  function mapKeys(m){
    return Object.keys(m||{});
  }

async function loadOpenDuels(silent){
    const list = byId('duels-list');
    if (list && !silent) list.innerHTML = '<div class="muted">Загружаю комнаты…</div>';

    try{
      const { r, j } = await apiJson('/api/duels?status=open&order=queue&limit=10');
      if (!r.ok || !j || !j.ok){
        if (r.status === 401) toast('Нужен вход', 'Сессия не найдена. Открой главную и войди через VK/TG.');
        else toast('Не получилось', 'Не удалось загрузить список комнат.');
        renderList([]);
        return;
      }
      renderList(j.items || []);
      // --- polling & событие: моя комната исчезла из open ---
      const items = j.items || [];
      const myIds = [];
      if (myUserId){
        for (const it of items){
          if (Number(it.creator_user_id) === myUserId) myIds.push(String(it.id));
        }
      }

      const hadMine = mapKeys(lastMyOpenIds).length > 0;
      const hasMineNow = myIds.length > 0;

      // поллим только если есть МОЯ открытая комната
      if (hasMineNow) setPoll(4500);
      else setPoll(0);

      // если раньше была моя открытая, а теперь нет — значит кто-то зашёл/сыграли/закрыли
      if (hadMine && !hasMineNow){
        try{
          await Promise.all([refreshBalance(), loadHistoryDuels()]);
          toast('Дуэль обновилась', 'Проверь историю — там уже результат.');
        } catch(_e){}
      }

      lastMyOpenIds = idsMap(myIds);

    } catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось получить комнаты.');
      renderList([]);
    }
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
      await Promise.all([loadOpenDuels(true), refreshBalance()]);
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

      if (iWon){
        toast('GG! Победа', '+' + fmtRub(payout) + ' · комиссия ' + fmtRub(fee));
      } else {
        toast('Сегодня не твой coinflip', '-' + fmtRub(stake) + '. Это не «не повезло» — это статистика. Реванш?');
      }

      await Promise.all([loadOpenDuels(true), refreshBalance()]);
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
      await Promise.all([loadOpenDuels(true), refreshBalance()]);
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
    if (refreshBtn) refreshBtn.addEventListener('click', function(){ loadOpenDuels(false); });

    await initMe();
    await loadOpenDuels(false);
    await loadHistoryDuels();
  });
})();
