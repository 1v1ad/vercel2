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
      left.style.cursor = 'pointer';
      left.addEventListener('click', function(ev){
        // клик по карточке — детали (кроме кнопок)
        if (ev && ev.target && (ev.target.closest && ev.target.closest('button'))) return;
        openDuelModal(it.id);
      });

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

  
function whoName(prefix, it){
  const fn = (it && it[prefix + '_first_name']) ? String(it[prefix + '_first_name']) : '';
  const ln = (it && it[prefix + '_last_name']) ? String(it[prefix + '_last_name']) : '';
  return (fn + ' ' + ln).trim() || '—';
}

function showCoinOverlay(text){
  const ov = byId('coin-overlay');
  const tx = byId('coin-text');
  if (!ov) return Promise.resolve();
  if (tx) tx.textContent = safeText(text || 'Подбрасываем монетку…');
  ov.classList.add('show');
  return new Promise(resolve => {
    setTimeout(() => { ov.classList.remove('show'); resolve(); }, 3200);
  });
}

async function openDuelModal(id){
  const modal = byId('duel-modal');
  const title = byId('duel-modal-title');
  const body = byId('duel-modal-body');
  if (!modal || !body) return;

  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  body.innerHTML = '<div class="muted">Загружаю…</div>';
  if (title) title.textContent = 'Дуэль #' + id;

  try{
    const { r, j } = await apiJson('/api/duels/' + encodeURIComponent(id));
    if (!r.ok || !j || !j.ok || !j.room){
      body.innerHTML = '<div class="muted">Не удалось загрузить детали.</div>';
      return;
    }
    const d = j.room;
    const res = d.result || {};
    const pot = Number(res.pot || (Number(d.stake||0)*2) || 0);
    const fee = Number(res.fee || 0);
    const payout = Number(res.payout || 0);

    const creator = (d.creator_first_name || d.creator_last_name) ? (String(d.creator_first_name||'')+' '+String(d.creator_last_name||'')).trim() : ('#'+d.creator_user_id);
    const opp = d.opponent_user_id ? ((String(d.opponent_first_name||'')+' '+String(d.opponent_last_name||'')).trim() || ('#'+d.opponent_user_id)) : '—';
    const winner = d.winner_user_id ? ((String(d.winner_first_name||'')+' '+String(d.winner_last_name||'')).trim() || ('#'+d.winner_user_id)) : '—';

    const status = String(d.status||'');
    const method = safeText(res.method || 'coinflip');

    body.innerHTML = `
      <div class="kv">
        <div class="k">Статус</div><div class="v">${safeText(status)}</div>
        <div class="k">Режим</div><div class="v">${safeText(d.mode||'1v1')}</div>
        <div class="k">Создатель</div><div class="v">${safeText(creator)}</div>
        <div class="k">Соперник</div><div class="v">${safeText(opp)}</div>
        <div class="k">Победитель</div><div class="v">${safeText(winner)}</div>
        <div class="k">Ставка</div><div class="v">${fmtRub(d.stake)}</div>
        <div class="k">Банк (pot)</div><div class="v">${fmtRub(pot)}</div>
        <div class="k">Рейк (fee)</div><div class="v">${fmtRub(fee)}</div>
        <div class="k">Выплата</div><div class="v">${fmtRub(payout)}</div>
        <div class="k">Метод</div><div class="v">${safeText(method)}</div>
        <div class="k">Создано</div><div class="v">${safeText(d.created_at||'')}</div>
        <div class="k">Завершено</div><div class="v">${safeText(d.finished_at||'')}</div>
      </div>
    `;
  } catch(e){
    console.error(e);
    body.innerHTML = '<div class="muted">Ошибка сети при загрузке деталей.</div>';
  }
}

function closeDuelModal(){
  const modal = byId('duel-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
}

function renderHistory(items){
  const list = byId('duels-history-list');
  if (!list) return;
  list.innerHTML = '';

  if (!items || !items.length){
    const d = document.createElement('div');
    d.className = 'muted';
    d.textContent = 'История пока пустая. Самое время устроить первую драму.';
    list.appendChild(d);
    return;
  }

  for (const it of items){
    const row = document.createElement('div');
    row.className = 'duel-item';

    const left = document.createElement('div');
    left.className = 'duel-left';
    left.style.cursor = 'pointer';

    // оппонент относительно меня
    const creatorId = Number(it.creator_user_id||0);
    const oppId = Number(it.opponent_user_id||0);
    const isCreator = myUserId && creatorId === myUserId;
    const oppName = isCreator ? whoName('opponent', it) : whoName('creator', it);

    const stake = Number(it.stake||0);

    const title = document.createElement('div');
    title.style.minWidth = '0';
    title.innerHTML = `
      <div class="duel-title">${fmtRub(stake)} · ${safeText(oppName)}</div>
      <div class="duel-sub">#${it.id} · ${safeText(it.status)} · ${timeShort(it.finished_at || it.updated_at || it.created_at)}</div>
    `;

    left.addEventListener('click', () => openDuelModal(it.id));

    const actions = document.createElement('div');
    actions.className = 'duel-actions';

    const pill = document.createElement('span');
    pill.className = 'pill neutral';

    const winner = Number(it.winner_user_id||0);
    if (String(it.status) === 'finished' && myUserId){
      const won = winner === myUserId;
      pill.className = 'pill ' + (won ? 'win' : 'lose');
      pill.textContent = won ? 'выигрыш' : 'проигрыш';
    } else if (String(it.status) === 'cancelled'){
      pill.className = 'pill neutral';
      pill.textContent = 'отмена';
    } else {
      pill.textContent = '—';
    }

    actions.appendChild(pill);

    row.appendChild(left);
    row.appendChild(title);
    row.appendChild(actions);

    // сделать нормальную flex-структуру
    row.innerHTML = '';
    row.appendChild(left);
    row.appendChild(actions);

    // слева: аватар не обязателен для истории, но красиво показать
    const img = document.createElement('img');
    const av = isCreator ? (it.opponent_avatar || '') : (it.creator_avatar || '');
    if (av) img.src = av;
    img.alt = '';
    left.appendChild(img);
    left.appendChild(title);

    list.appendChild(row);
  }
}

async function loadHistory(){
  const list = byId('duels-history-list');
  if (list) list.innerHTML = '<div class="muted">Загружаю историю…</div>';

  try{
    const { r, j } = await apiJson('/api/duels/history?limit=10');
    if (!r.ok || !j || !j.ok){
      // если нет юзера — просто скрываем драму
      renderHistory([]);
      return;
    }
    renderHistory(j.items || []);
  } catch(e){
    console.error(e);
    renderHistory([]);
  }
}

async function loadOpenDuels(){
    const list = byId('duels-list');
    if (list) list.innerHTML = '<div class="muted">Загружаю комнаты…</div>';

    try{
      const { r, j } = await apiJson('/api/duels?status=open&order=queue&limit=10');
      if (!r.ok || !j || !j.ok){
        if (r.status === 401) toast('Нужен вход', 'Сессия не найдена. Открой главную и войди через VK/TG.');
        else toast('Не получилось', 'Не удалось загрузить список комнат.');
        renderList([]);
        return;
      }
      renderList(j.items || []);
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
      await Promise.all([loadOpenDuels(), loadHistory(), refreshBalance()]);
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

      await showCoinOverlay(iWon ? 'Монетка на твоей стороне…' : 'Монетка решила иначе…');

      if (iWon){
        toast('GG! Победа', '+' + fmtRub(payout) + ' · комиссия ' + fmtRub(fee));
      } else {
        toast('Сегодня не твой coinflip', '-' + fmtRub(stake) + '. Это не «не повезло» — это статистика. Реванш?');
      }

      await Promise.all([loadOpenDuels(), loadHistory(), refreshBalance()]);
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
      await Promise.all([loadOpenDuels(), loadHistory(), refreshBalance()]);
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
    if (refreshBtn) refreshBtn.addEventListener('click', loadOpenDuels);

    await initMe();
    await Promise.all([loadOpenDuels(), loadHistory()]);

    // модалка: закрытие
    const modal = byId('duel-modal');
    const closeBtn = byId('duel-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDuelModal);
    if (modal) modal.addEventListener('click', function(e){
      const t = e && e.target;
      if (t && (t.getAttribute && t.getAttribute('data-close')==='1')) closeDuelModal();
    });
    document.addEventListener('keydown', function(e){
      if (e && e.key === 'Escape') closeDuelModal();
    });

    // авто-обновление (мягко): раз в 4.5 сек, без параллельных запросов
    let inflight = false;
    setInterval(async function(){
      if (document.hidden) return;
      if (inflight) return;
      inflight = true;
      try{ await Promise.all([loadOpenDuels(), loadHistory()]); } finally { inflight = false; }
    }, 4500);
  });
})();
