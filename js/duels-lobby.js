// /js/duels-lobby.js — Лобби дуэлей 1v1 (создать / список / join / cancel) + история + деталка
// Работает с backend:
//   GET  /api/duels?status=open&order=queue&limit=10
//   GET  /api/duels/history?limit=10
//   GET  /api/duels/:id  (опционально, если есть)
//   POST /api/duels/create
//   POST /api/duels/:id/join
//   POST /api/duels/:id/cancel

(function(){
  function byId(id){ return document.getElementById(id); }
  function readMeta(name){
    var m = document.querySelector('meta[name="'+name+'"]');
    return m ? (m.getAttribute('content')||'').trim() : '';
  }
  function API(){ return readMeta('api-base') || (window.API_BASE||'').trim() || 'https://vercel2pr.onrender.com'; }

  function fmtRub(n){
    try{ return '₽ ' + (Number(n)||0).toLocaleString('ru-RU'); }catch(_){ return '₽ 0'; }
  }
  function safeText(x){ return (x==null?'':String(x)); }

  function toast(title, body){
    var wrap = byId('toast');
    var t = byId('toast-title');
    var b = byId('toast-body');
    if (!wrap || !t || !b) return;
    t.textContent = safeText(title);
    b.textContent = safeText(body||'');
    wrap.classList.add('show');
    if (toast._tm) clearTimeout(toast._tm);
    toast._tm = setTimeout(function(){ wrap.classList.remove('show'); }, 4200);
  }

  function timeShort(iso){
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try{ return d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }); }catch(_){ return ''; }
  }

  async function apiJson(path, opts){
    var url = API() + path;
    var o = Object.assign({ credentials:'include', cache:'no-store' }, opts||{});
    if (o.body && typeof o.body !== 'string'){
      o.headers = Object.assign({ 'Content-Type':'application/json' }, o.headers||{});
      o.body = JSON.stringify(o.body);
    }
    var r = await fetch(url, o);
    var j = null;
    try{ j = await r.json(); }catch(_){ }
    return { r:r, j:j };
  }

  async function refreshBalance(){
    // Если в проекте есть отдельный скрипт lobby-balance-fix.js — он сам обновляет UI.
    // Здесь просто пингуем /api/me, чтобы можно было дернуть баланс после join/cancel/create.
    try{ await apiJson('/api/me'); }catch(_){}
  }

  var myUserId = null;

  async function initMe(){
    try{
      var res = await apiJson('/api/me');
      var r = res.r, j = res.j;
      if (r.ok && j && j.ok && j.user){
        myUserId = Number(j.user.id || 0) || null;
        return j.user;
      }
    }catch(_){}
    return null;
  }

  // ---------- Modal ----------
  var cacheById = {}; // id -> item (open/history)

  function kv(k, v){
    return '<div class="kv"><div class="k">'+safeText(k)+'</div><div class="v">'+safeText(v)+'</div></div>';
  }

  function modalOpen(html){
    var m = byId('duel-modal');
    var body = byId('modal-body');
    if (!m || !body) return;
    body.innerHTML = html || '';
    m.classList.add('show');
    m.setAttribute('aria-hidden','false');
  }
  function modalClose(){
    var m = byId('duel-modal');
    if (!m) return;
    m.classList.remove('show');
    m.setAttribute('aria-hidden','true');
  }

  async function openDuelModal(id){
    if (!id) return;
    var it = cacheById[String(id)] || null;

    // попытка догрузить деталку (если эндпоинт есть)
    if (!it){
      try{
        var res = await apiJson('/api/duels/' + encodeURIComponent(id));
        if (res.r.ok && res.j && res.j.ok && res.j.room) it = res.j.room;
      }catch(_){}
    }

    if (!it){
      modalOpen('<div class="muted">Не удалось загрузить детали.</div>');
      return;
    }

    var r = it.result || {};
    var pot = (r.pot!=null ? r.pot : (Number(it.stake||0)*2));
    var fee = (r.fee!=null ? r.fee : null);
    var payout = (r.payout!=null ? r.payout : null);

    var lines = '';
    lines += kv('Комната', '#'+safeText(it.id));
    lines += kv('Статус', safeText(it.status||''));
    lines += kv('Ставка', fmtRub(it.stake));
    lines += kv('Банк (pot)', fmtRub(pot));
    if (fee!=null) lines += kv('Рейк', fmtRub(fee));
    if (payout!=null) lines += kv('Выплата', fmtRub(payout));

    var creatorName = [it.creator_first_name, it.creator_last_name].filter(Boolean).join(' ');
    var oppName = [it.opponent_first_name, it.opponent_last_name].filter(Boolean).join(' ');
    if (!creatorName && it.creator_user_id) creatorName = 'Игрок #' + it.creator_user_id;
    if (!oppName && it.opponent_user_id) oppName = 'Игрок #' + it.opponent_user_id;

    if (creatorName) lines += kv('Создатель', creatorName);
    if (oppName) lines += kv('Соперник', oppName);

    if (it.winner_user_id){
      var w = (Number(it.winner_user_id)===Number(it.creator_user_id)) ? creatorName : oppName;
      lines += kv('Победитель', w || ('ID ' + it.winner_user_id));
    }

    var t = timeShort(it.created_at);
    if (t) lines += kv('Создано', t);

    modalOpen(lines);
  }

  // ---------- Coin overlay ----------
  function coinShow(){
    var el = byId('coin-overlay');
    if (!el) return;
    el.classList.add('show');
    el.setAttribute('aria-hidden','false');
  }
  function coinHide(){
    var el = byId('coin-overlay');
    if (!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden','true');
  }
  async function coinFor(ms){
    coinShow();
    await new Promise(function(res){ setTimeout(res, ms); });
    coinHide();
  }

  // ---------- Rendering ----------
  function renderOpen(items){
    var list = byId('duels-list');
    if (!list) return;

    list.innerHTML = '';
    if (!items || !items.length){
      var d = document.createElement('div');
      d.className = 'muted';
      d.textContent = 'Пока нет открытых комнат. Создай первую — пусть монета выберет драму.';
      list.appendChild(d);
      return;
    }

    for (var i=0; i<items.length; i++){
      var it = items[i];
      cacheById[String(it.id||'')] = it;

      var row = document.createElement('div');
      row.className = 'duel-item clickable';
      row.setAttribute('data-id', String(it.id||''));
      row.addEventListener('click', function(ev){
        if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
        var rid = this.getAttribute('data-id');
        openDuelModal(rid);
      });

      var left = document.createElement('div');
      left.className = 'duel-left';

      var img = document.createElement('img');
      img.alt = 'Игрок';
      img.src = it.creator_avatar || '';
      left.appendChild(img);

      var txt = document.createElement('div');
      txt.style.minWidth = '0';

      var title = document.createElement('div');
      title.className = 'duel-title';
      var name = [it.creator_first_name, it.creator_last_name].filter(Boolean).join(' ') || ('Игрок #' + (it.creator_user_id||''));
      title.textContent = fmtRub(it.stake) + ' · ' + name;

      var sub = document.createElement('div');
      sub.className = 'duel-sub';
      var t = timeShort(it.created_at);
      sub.textContent = 'Комната #' + it.id + (t ? (' · ' + t) : '') + ' · комиссия ' + (((Number(it.fee_bps||0)/100)||0)) + '%';

      txt.appendChild(title);
      txt.appendChild(sub);
      left.appendChild(txt);

      var actions = document.createElement('div');
      actions.className = 'duel-actions';

      var isMine = myUserId && Number(it.creator_user_id) === myUserId;

      var btn = document.createElement('button');
      btn.className = 'btn ' + (isMine ? 'danger' : 'primary');
      btn.type = 'button';
      btn.textContent = isMine ? 'Отменить' : 'Войти';
      btn.onclick = (function(id, mine, button){
        return async function(){
          button.disabled = true;
          try{
            if (mine) {
              await cancelDuel(id);
            } else {
              await joinDuel(id);
            }
          } finally {
            button.disabled = false;
          }
        };
      })(it.id, !!isMine, btn);

      actions.appendChild(btn);

      row.appendChild(left);
      row.appendChild(actions);
      list.appendChild(row);
    }
  }

  function renderHistory(items){
    var list = byId('history-list');
    if (!list) return;

    list.innerHTML = '';
    if (!items || !items.length){
      var d = document.createElement('div');
      d.className = 'muted';
      d.textContent = 'История пока пуста. Сыграй дуэль — и тут появится хроника побед и трагедий.';
      list.appendChild(d);
      return;
    }

    for (var i=0; i<items.length; i++){
      var it = items[i];
      cacheById[String(it.id||'')] = it;

      var row = document.createElement('div');
      row.className = 'duel-item clickable';
      row.setAttribute('data-id', String(it.id||''));
      row.addEventListener('click', function(ev){
        if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
        var rid = this.getAttribute('data-id');
        openDuelModal(rid);
      });

      var left = document.createElement('div');
      left.className = 'duel-left';

      var isCreator = myUserId && Number(it.creator_user_id) === myUserId;
      var otherFirst = isCreator ? it.opponent_first_name : it.creator_first_name;
      var otherLast  = isCreator ? it.opponent_last_name  : it.creator_last_name;
      var otherName  = [otherFirst, otherLast].filter(Boolean).join(' ') || (it.opponent_user_id ? ('Игрок #' + it.opponent_user_id) : '—');
      var otherAvatar = (isCreator ? it.opponent_avatar : it.creator_avatar) || it.creator_avatar || '';

      var img = document.createElement('img');
      img.alt = 'Игрок';
      img.src = otherAvatar || '';
      left.appendChild(img);

      var txt = document.createElement('div');
      txt.style.minWidth = '0';

      var title = document.createElement('div');
      title.className = 'duel-title';
      title.textContent = fmtRub(it.stake) + ' · ' + otherName;

      var sub = document.createElement('div');
      sub.className = 'duel-sub';
      var t = timeShort(it.finished_at || it.created_at);
      sub.textContent = 'Комната #' + it.id + (t ? (' · ' + t) : '');

      txt.appendChild(title);
      txt.appendChild(sub);
      left.appendChild(txt);

      var right = document.createElement('div');
      right.className = 'duel-actions';

      var badge = document.createElement('div');
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

  // ---------- Data loading + polling ----------
  var lastOpenIdsMine = {}; // id -> true
  var pollTimer = null;
  var pollBusy = false;

  function anyMine(openItems){
    if (!myUserId) return false;
    for (var i=0; i<openItems.length; i++){
      if (Number(openItems[i].creator_user_id) === myUserId) return true;
    }
    return false;
  }

  function setPollingEnabled(enabled){
    if (enabled){
      if (pollTimer) return;
      pollTimer = setInterval(function(){
        if (pollBusy) return;
        if (typeof document.hidden === 'boolean' && document.hidden) return;
        loadOpenDuels();
      }, 4500);
    } else {
      if (pollTimer){
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  }

  async function loadOpenDuels(){
    pollBusy = true;
    try{
      var res = await apiJson('/api/duels?status=open&order=queue&limit=10');
      var r = res.r, j = res.j;
      if (!r.ok || !j || !j.ok){
        renderOpen([]);
        return;
      }

      var items = j.items || [];
      renderOpen(items);

      // включаем поллинг только если у меня есть открытая комната (я создатель)
      var mineNow = anyMine(items);
      setPollingEnabled(!!mineNow);

      // если какая-то МОЯ открытая комната пропала из списка — значит её сыграли/закрыли → обновим историю/баланс один раз
      var currentMineIds = {};
      if (myUserId){
        for (var ii=0; ii<items.length; ii++){
          var it2 = items[ii];
          if (Number(it2.creator_user_id) === myUserId){
            currentMineIds[String(it2.id)] = true;
          }
        }
      }
      var removedMine = false;
      for (var k in lastOpenIdsMine){
        if (lastOpenIdsMine[k] && !currentMineIds[k]) { removedMine = true; break; }
      }
      if (removedMine){
        await Promise.all([refreshBalance(), loadHistory()]);
        toast('Дуэль завершилась', 'Комната сыграна/закрыта. История обновлена.');
      }

      // обновим lastOpenIdsMine
      lastOpenIdsMine = currentMineIds;
    } catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось загрузить комнаты.');
    } finally {
      pollBusy = false;
    }
  }

  async function loadHistory(){
    try{
      var res = await apiJson('/api/duels/history?limit=10');
      var r = res.r, j = res.j;
      if (!r.ok || !j || !j.ok){
        renderHistory([]);
        return;
      }
      renderHistory(j.items || []);
    } catch(e){
      console.error(e);
      renderHistory([]);
    }
  }

  // ---------- Actions ----------
  async function createDuel(){
    var input = byId('stake-input');
    var stake = Number(input && input.value || 0) || 0;

    if (!stake || stake < 10 || stake > 1000000){
      toast('Ставка странная', 'Введите число от 10 до 1 000 000.');
      return;
    }

    var btn = byId('duels-create');
    if (btn) btn.disabled = true;

    try{
      var res = await apiJson('/api/duels/create', {
        method:'POST',
        body:{ stake: stake, fee_bps: 500, meta:{ src:'lobby' } }
      });
      var r = res.r, j = res.j;

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
      await Promise.all([loadOpenDuels(), refreshBalance()]);
      // у создателя должна быть авто-слежка за входом соперника
      setPollingEnabled(true);
      lastOpenIdsMine[String(j.room.id)] = true;
    } catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось создать комнату.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function joinDuel(id){
    try{
      // показываем "монетку" минимум 3.2 сек, даже если бэкенд ответит быстро
      var start = Date.now();
      coinShow();

      var res = await apiJson('/api/duels/' + encodeURIComponent(id) + '/join', { method:'POST' });
      var r = res.r, j = res.j;

      var elapsed = Date.now() - start;
      var left = 3200 - elapsed;
      if (left > 0) await new Promise(function(res){ setTimeout(res, left); });
      coinHide();

      if (!r.ok || !j || !j.ok){
        if (r.status === 401) { toast('Нужен вход', 'Сессия не найдена.'); return; }
        if (r.status === 402) { toast('Недостаточно средств', 'На HUM-кошельке не хватает на эту ставку.'); return; }
        toast('Не зашло', (j && j.error) ? ('Ошибка: ' + j.error) : 'Попробуй ещё раз.');
        return;
      }

      // покажем результат кратко
      var win = j.room && j.room.winner_user_id && myUserId && Number(j.room.winner_user_id) === myUserId;
      toast('Дуэль сыграна', win ? 'Победа. Баланс обновлён.' : 'Поражение. Баланс обновлён.');
      await Promise.all([loadOpenDuels(), refreshBalance(), loadHistory()]);
    } catch(e){
      console.error(e);
      coinHide();
      toast('Сеть шалит', 'Не удалось зайти в комнату.');
    }
  }

  async function cancelDuel(id){
    try{
      var res = await apiJson('/api/duels/' + encodeURIComponent(id) + '/cancel', { method:'POST' });
      var r = res.r, j = res.j;

      if (!r.ok || !j || !j.ok){
        toast('Не отменилось', (j && j.error) ? ('Ошибка: ' + j.error) : 'Попробуй ещё раз.');
        return;
      }

      toast('Комната отменена', 'Комната #' + id + ' закрыта.');
      await Promise.all([loadOpenDuels(), refreshBalance(), loadHistory()]);
    } catch(e){
      console.error(e);
      toast('Сеть шалит', 'Не удалось отменить комнату.');
    }
  }

  // ---------- Wire up ----------
  function setupStakes(){
    var chips = document.querySelectorAll('.stake-chip[data-stake]');
    for (var i=0; i<chips.length; i++){
      (function(btn){
        btn.addEventListener('click', function(){
          var v = btn.getAttribute('data-stake');
          var input = byId('stake-input');
          if (input) input.value = String(v||'');
        });
      })(chips[i]);
    }
  }

  function setupModal(){
    var closeBtn = byId('duel-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', modalClose);

    var modal = byId('duel-modal');
    if (modal){
      modal.addEventListener('click', function(ev){
        var t = ev && ev.target;
        if (t && t.getAttribute && t.getAttribute('data-close') === '1') modalClose();
      });
    }

    document.addEventListener('keydown', function(ev){
      if (ev && ev.key === 'Escape') modalClose();
    });
  }

  document.addEventListener('DOMContentLoaded', async function(){
    setupStakes();
    setupModal();

    var createBtn = byId('duels-create');
    var refreshBtn = byId('duels-refresh');

    if (createBtn) createBtn.addEventListener('click', createDuel);
    if (refreshBtn) refreshBtn.addEventListener('click', loadOpenDuels);

    await initMe();
    await loadOpenDuels();
    // история грузим один раз при входе
    await loadHistory();
  });
})();
