// /js/duels-lobby.js — Лобби дуэлей 1v1 (front)
// Цели:
// 1) open-румы обновляем (poll) ТОЛЬКО для создателя, пока у него есть открытая комната
// 2) историю НЕ поллим — грузим 1 раз при входе и 1 раз, когда "моя open пропала" (дуэль сыграна/закрыта)
// 3) показываем имя/аватар из полей creator_* / opponent_* (которые отдаёт бэкенд)
// 4) монетка 3.2с на join перед результатом
(function(){
  function byId(id){ return document.getElementById(id); }

  function readMeta(name){
    var m = document.querySelector('meta[name="'+name+'"]');
    return m ? String(m.getAttribute('content')||'').trim() : '';
  }

  function apiBase(){
    var v = '';
    try { v = (localStorage.getItem('api-base') || ''); } catch(_){}
    v = v || readMeta('api-base') || '';
    return v.replace(/\/+$/,'');
  }

  function getAuthHeaders(){
    try {
      if (typeof window.headers === 'function') return window.headers() || {};
      if (typeof window.authHeaders === 'function') return window.authHeaders() || {};
    } catch(_){}
    return {};
  }

  function fmtRub(n){
    n = Number(n||0);
    var s = Math.round(n).toString();
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function safeText(x){ return (x===null || x===undefined) ? '' : String(x); }

  function fullName(fn, ln, id){
    var f = safeText(fn).trim();
    var l = safeText(ln).trim();
    var t = (f + ' ' + l).trim();
    return t || ('user_id ' + id);
  }

  function makeAvatarImg(url, alt){
    var img = document.createElement('img');
    img.alt = alt || 'avatar';
    img.loading = 'lazy';

    // Плейсхолдер, чтобы не было "битой" иконки при пустом src
    var placeholder = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
      '<rect width="100%" height="100%" rx="14" ry="14" fill="rgba(255,255,255,0.06)"/>' +
      '</svg>'
    );

    img.src = url ? url : placeholder;
    img.onerror = function(){ img.src = placeholder; };
    return img;
  }

  async function apiJson(path, opts){
    var base = apiBase();
    var url = base + path;
    opts = opts || {};
    var headers = opts.headers || {};
    // merge auth headers
    var H = getAuthHeaders();
    for (var k in H) headers[k] = H[k];
    opts.headers = headers;
    opts.credentials = 'include';

    var r = await fetch(url, opts);
    var j = null;
    try { j = await r.json(); } catch(_){}
    return { r:r, j:j };
  }

  function toast(title, body){
    var t = byId('toast');
    if (!t) return;
    byId('toast-title').textContent = title || '';
    byId('toast-body').textContent = body || '';
    t.style.display = 'block';
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function(){ t.style.display = 'none'; }, 2200);
  }

  function showCoin(show){
    var ov = byId('coin-overlay');
    if (!ov) return;
    ov.style.display = show ? 'flex' : 'none';
  }

  function delay(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }

  async function withCoin(fn){
    var start = Date.now();
    showCoin(true);
    try {
      return await fn();
    } finally {
      var spent = Date.now() - start;
      var minShow = 3200;
      if (spent < minShow) await delay(minShow - spent);
      showCoin(false);
    }
  }

  var myUserId = null;
  var myLinked = null;
  var lastMyOpenIds = {}; // map id->true
  var pollTimer = null;
  var selectedStake = '100';
  var lastOpenItems = [];

  function setKpi(id, val){
    var el = byId(id);
    if (!el) return;
    if (val === null || val === undefined || val === '') el.textContent = '—';
    else el.textContent = String(val);
  }

  function updateLinksKpi(){
    if (!myLinked){
      setKpi('kpi-links', '—');
      return;
    }
    var parts = [];
    if (myLinked.vk) parts.push('VK');
    if (myLinked.tg) parts.push('TG');
    setKpi('kpi-links', parts.length ? parts.join('+') : '—');
  }

  function setSelectedStake(v){
    selectedStake = String(v || selectedStake || '100');
    try{ localStorage.setItem('ggroom_selected_stake_v1', selectedStake); }catch(_){ }
    var cards = document.querySelectorAll('.stake-card[data-stake]');
    for (var i=0;i<cards.length;i++){
      var s = cards[i].getAttribute('data-stake');
      if (String(s) === String(selectedStake)) cards[i].classList.add('is-selected');
      else cards[i].classList.remove('is-selected');
    }
  }


  
  function updateStakeCounts(items){
    items = items || [];
    var map = {};
    for (var i=0;i<items.length;i++){
      var it = items[i];
      var st = String(it.stake || '');
      if (!st) continue;
      map[st] = (map[st]||0) + 1;
    }
    var els = document.querySelectorAll('[data-open-count]');
    for (var j=0;j<els.length;j++){
      var k = String(els[j].getAttribute('data-open-count')||'');
      els[j].textContent = (map[k] != null) ? String(map[k]) : '0';
    }
  }

  async function createWithSelectedStake(){
    var m = Number(selectedStake||0);
    if (!m || m <= 0){ toast('Ошибка', 'Не выбрана ставка'); return; }
    await createDuel(m);
    await pollOpenOnce();
  }

  window.__gg_duels_create_selected = createWithSelectedStake;

function setPollEnabled(enabled){
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    if (!enabled) return;

    pollTimer = setTimeout(async function tick(){
      pollTimer = null;
      try { await pollOpenOnce(); } catch(_){}
      // пересчитаем условие после pollOpenOnce
      var has = false;
      for (var k in lastMyOpenIds){ has = true; break; }
      if (has) setPollEnabled(true);
    }, 4500);
  }

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

    for (var i=0;i<items.length;i++){
      var it = items[i];

      var row = document.createElement('div');
      row.className = 'duel-item';
      row.style.cursor = 'pointer';
      row.onclick = (function(id){
        return function(ev){
          if (ev && ev.target && ev.target.tagName === 'BUTTON') return;
          showDuelDetails(id);
        };
      })(it.id);

      var left = document.createElement('div');
      left.className = 'duel-left';

      var who = fullName(it.creator_first_name, it.creator_last_name, it.creator_user_id);
      var img = makeAvatarImg(it.creator_avatar, who);

      var txt = document.createElement('div');
      txt.className = 'duel-text';

      var title = document.createElement('div');
      title.className = 'duel-title';
      title.textContent = fmtRub(it.stake||0) + ' · ' + who;

      var sub = document.createElement('div');
      sub.className = 'duel-sub';
      // время + комиссия
      var dt = it.created_at ? new Date(it.created_at) : null;
      var tstr = dt ? (String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0')) : '';
      sub.textContent = 'Комната #' + it.id + (tstr ? (' · ' + tstr) : '') + ' · комиссия ' + (it.fee_bps||0)/100 + '%';

      txt.appendChild(title);
      txt.appendChild(sub);

      left.appendChild(img);
      left.appendChild(txt);

      var actions = document.createElement('div');
      actions.className = 'duel-actions';

      var isMine = (myUserId && Number(it.creator_user_id) === myUserId);
      var btn = document.createElement('button');
      btn.className = 'btn ' + (isMine ? 'danger' : 'primary');
      btn.type = 'button';
      btn.textContent = isMine ? 'Отменить' : 'Войти';
      btn.onclick = (function(id, mine){
        return async function(ev){
          ev.stopPropagation();
          if (mine){
            await cancelDuel(id);
            await pollOpenOnce();
          } else {
            await withCoin(async function(){
              await joinDuel(id);
            });
            // после join — обновим всё (open и историю)
            await pollOpenOnce();
            await loadHistory();
            await refreshBalance();
          }
        };
      })(it.id, isMine);

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
      d.textContent = 'Пока пусто. Сыграй пару дуэлей — и здесь будет хроника побед и трагедий.';
      list.appendChild(d);
      return;
    }

    for (var i=0;i<items.length;i++){
      var it = items[i];

      var row = document.createElement('div');
      row.className = 'history-item';
      row.onclick = (function(id){
        return function(){ showDuelDetails(id); };
      })(it.id);

      var left = document.createElement('div');
      left.className = 'history-left';

      var right = document.createElement('div');
      right.className = 'history-right';

      var cName = fullName(it.creator_first_name, it.creator_last_name, it.creator_user_id);
      var oName = fullName(it.opponent_first_name, it.opponent_last_name, it.opponent_user_id || '—');

      // аватары + заголовок как "строка" (ближе к покеру/лобби)
      var avatars = document.createElement('div');
      avatars.className = 'history-avatars';
      avatars.appendChild(makeAvatarImg(it.creator_avatar, cName));
      avatars.appendChild(makeAvatarImg(it.opponent_avatar, oName));

      var info = document.createElement('div');
      info.className = 'history-info';

      var titleRow = document.createElement('div');
      titleRow.className = 'history-title-row';

      var title = document.createElement('div');
      title.className = 'duel-title';
      title.textContent = fmtRub(it.stake||0) + ' · ' + cName + ' vs ' + oName;

      // outcome-плашка (если это "моя" дуэль)
      var pillText = '';
      var pillClass = '';
      try{
        var st = String(it.status||'');
        if (st === 'finished' && it.winner_user_id && myUserId &&
            (Number(it.creator_user_id)===Number(myUserId) || Number(it.opponent_user_id)===Number(myUserId))){
          if (Number(it.winner_user_id) === Number(myUserId)){ pillText = 'победа'; pillClass = 'win'; }
          else { pillText = 'поражение'; pillClass = 'lose'; }
        } else if (st === 'cancelled'){ pillText = 'отмена'; pillClass = 'lose'; }
      }catch(_){}

      titleRow.appendChild(title);
      if (pillText){
        var pill = document.createElement('span');
        pill.className = 'pill ' + pillClass;
        pill.textContent = pillText;
        titleRow.appendChild(pill);
      }

      var sub = document.createElement('div');
      sub.className = 'duel-sub';

      var pot = 0, fee = 0;
      try {
        if (it.result){
          if (typeof it.result === 'string') {
            var rr = JSON.parse(it.result);
            pot = Number(rr.pot||0);
            fee = Number(rr.fee||0);
          } else {
            pot = Number(it.result.pot||0);
            fee = Number(it.result.fee||0);
          }
        }
      } catch(_){}

      var dt = it.finished_at ? new Date(it.finished_at) : (it.updated_at ? new Date(it.updated_at) : null);
      var tstr = dt ? (String(dt.getDate()).padStart(2,'0')+'.'+String(dt.getMonth()+1).padStart(2,'0')+' '+String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0')) : '';
      var w = '';
      if (it.winner_user_id){
        var wName = (Number(it.winner_user_id)===Number(it.creator_user_id)) ? cName : oName;
        w = ' · победил: ' + wName;
      }
      sub.textContent = (it.status||'') + (tstr?(' · '+tstr):'') + w;

      info.appendChild(titleRow);
      info.appendChild(sub);

      var top = document.createElement('div');
      top.className = 'history-top';
      top.appendChild(avatars);
      top.appendChild(info);

      left.appendChild(top);

      var r1 = document.createElement('div');
      r1.textContent = 'pot ' + String(pot||0);
      var r2 = document.createElement('div');
      r2.textContent = 'fee ' + String(fee||0);

      right.appendChild(r1);
      right.appendChild(r2);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    }
  }

async function loadOpen(){
    var list = byId('duels-list');
    if (list) list.innerHTML = '<div class="muted">Загружаю комнаты…</div>';

    var q = '/api/duels?status=open&order=queue&limit=100';
    var res = await apiJson(q);
    if (!res.r.ok || !res.j || !res.j.ok){
      lastOpenItems = [];
      updateStakeCounts([]);
      renderOpen([]);
      try{ setKpi('kpi-open', 0); setKpi('kpi-myopen', 0); }catch(_){ }
      return [];
    }
    var items = res.j.items || [];
    lastOpenItems = items;
    updateStakeCounts(items);
    renderOpen(items.slice(0, 10));

    // KPI: сколько комнат открыто и сколько из них мои
    try{
      setKpi('kpi-open', items.length);
      var myOpen = 0;
      if (myUserId){
        for (var i=0;i<items.length;i++) if (Number(items[i].creator_user_id) === Number(myUserId)) myOpen++;
      }
      setKpi('kpi-myopen', myOpen);
    }catch(_){ }

    return items;
  }

  async function loadHistory(){
    var list = byId('history-list');
    if (list) list.innerHTML = '<div class="muted">Загружаю историю…</div>';

    var res = await apiJson('/api/duels/history?limit=10');
    if (!res.r.ok || !res.j || !res.j.ok){
      renderHistory([]);
      try{ setKpi('kpi-history', 0); }catch(_){ }
      return;
    }
    var items = res.j.items || [];
    renderHistory(items);
    try{ setKpi('kpi-history', items.length); }catch(_){ }
  }

  async function refreshBalance(){
    try {
      var res = await apiJson('/api/me');
      if (res.r.ok && res.j && res.j.ok && res.j.user){
        var balEl = byId('user-balance');
        if (balEl) balEl.textContent = fmtRub(res.j.user.balance||0);
      }
    } catch(_){}
  }

  async function pollOpenOnce(){
    var items = await loadOpen();
    var myNow = {};
    if (myUserId){
      for (var i=0;i<items.length;i++){
        var it = items[i];
        if (Number(it.creator_user_id) === myUserId) myNow[String(it.id)] = true;
      }
    }

    var had = false, has = false;
    for (var k in lastMyOpenIds){ had = true; break; }
    for (var k2 in myNow){ has = true; break; }

    // если была моя open, а теперь нет — значит её заджойнили/закрыли
    if (had && !has){
      toast('Дуэль завершилась', 'Обновляю баланс и историю…');
      await loadHistory();
      await refreshBalance();
    }

    lastMyOpenIds = myNow;

    // включаем/выключаем polling
    setPollEnabled(has);
    return items;
  }

  async function createDuel(stake){
    var body = { mode:'1v1', stake: Number(stake||0) };
    var res = await apiJson('/api/duels/create', {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.r.ok || !res.j || !res.j.ok){
      toast('Ошибка', 'Не удалось создать комнату');
      return null;
    }
    toast('Комната создана', 'Ждём соперника…');
    return res.j.item || null;
  }

  async function joinDuel(id){
    var res = await apiJson('/api/duels/' + id + '/join', { method:'POST' });
    if (!res.r.ok || !res.j || !res.j.ok){
      toast('Ошибка', 'Не удалось войти');
      return null;
    }
    // res.j.result может содержать outcome
    toast('Монетка решила', 'Смотри результат в истории');
    return res.j || null;
  }



  async function quickMatch(stake){
    stake = Number(stake||0);
    if (!stake || stake <= 0){ toast('Ошибка', 'Некорректная ставка'); return; }

    // если список ещё не загружен — подгрузим
    if (!lastOpenItems || !lastOpenItems.length){
      try{ await loadOpen(); }catch(_){ }
    }

    var target = null;
    var items = lastOpenItems || [];
    for (var i=0;i<items.length;i++){
      var it = items[i];
      if (String(it.status||'') !== 'open') continue;
      if (Number(it.stake||0) !== stake) continue;
      if (myUserId && Number(it.creator_user_id) === Number(myUserId)) continue; // не прыгаем в свою же
      target = it;
      break;
    }

    if (target){
      toast('Подключаюсь', 'Вхожу в открытую комнату…');
      await joinDuel(target.id);
      await pollOpenOnce();
      await loadHistory();
      return;
    }

    toast('Поиск', 'Открытых комнат нет — создаю свою…');
    await createDuel(stake);
    await pollOpenOnce();
  }

  async function cancelDuel(id){
    var res = await apiJson('/api/duels/' + id + '/cancel', { method:'POST' });
    if (!res.r.ok || !res.j || !res.j.ok){
      toast('Ошибка', 'Не удалось отменить');
      return;
    }
    toast('Отменено', 'Комната закрыта');
  }

  async function showDuelDetails(id){
    var modal = byId('duel-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    byId('duel-modal-title').textContent = 'Дуэль #' + id;
    var kv = byId('duel-modal-kv');
    if (kv) kv.innerHTML = '<div class="muted">Загружаю…</div>';

    var res = await apiJson('/api/duels/' + id);
    if (!res.r.ok || !res.j || !res.j.ok || !res.j.item){
      if (kv) kv.innerHTML = '<div class="muted">Не удалось загрузить</div>';
      return;
    }
    var it = res.j.item;

    var cName = fullName(it.creator_first_name, it.creator_last_name, it.creator_user_id);
    var oName = fullName(it.opponent_first_name, it.opponent_last_name, it.opponent_user_id || '—');
    var wName = it.winner_user_id ? fullName(it.winner_first_name, it.winner_last_name, it.winner_user_id) : '—';

    var pot=0, fee=0, payout=0;
    try {
      var rr = it.result;
      if (typeof rr === 'string') rr = JSON.parse(rr);
      if (rr){
        pot = Number(rr.pot||0);
        fee = Number(rr.fee||0);
        payout = Number(rr.payout||0);
      }
    } catch(_){}

    var rows = [
      ['Статус', safeText(it.status)],
      ['Ставка', fmtRub(it.stake||0)],
      ['Pot', fmtRub(pot||0)],
      ['Fee', fmtRub(fee||0)],
      ['Payout', fmtRub(payout||0)],
      ['Создатель', cName],
      ['Оппонент', oName],
      ['Победитель', wName],
    ];

    if (kv){
      kv.innerHTML = '';
      for (var i=0;i<rows.length;i++){
        var kEl = document.createElement('div');
        kEl.className = 'k';
        kEl.textContent = rows[i][0];

        var vEl = document.createElement('div');
        vEl.className = 'v';
        vEl.textContent = rows[i][1];

        kv.appendChild(kEl);
        kv.appendChild(vEl);
      }
    }
  }

  function hideModal(){
    var modal = byId('duel-modal');
    if (modal) modal.style.display = 'none';
  }

  async function init(){
    // close modal handlers
    var closeBtn = byId('duel-modal-close');
    if (closeBtn) closeBtn.onclick = hideModal;
    var modal = byId('duel-modal');
    if (modal) modal.onclick = function(ev){ if (ev && ev.target === modal) hideModal(); };

    // stake cards + actions (GGPoker-style)
    try{
      var saved = localStorage.getItem('ggroom_selected_stake_v1');
      if (saved) selectedStake = String(saved);
    }catch(_){ }
    setSelectedStake(selectedStake);

    // клики по карточке — выбор ставки
    var cards = document.querySelectorAll('.stake-card[data-stake]');
    for (var i=0;i<cards.length;i++){
      cards[i].addEventListener('click', function(ev){
        if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
        var v = this.getAttribute('data-stake');
        setSelectedStake(v);
      });
    }

    // кнопки в карточках: быстрый матч / создать
    document.addEventListener('click', async function(ev){
      var btn = ev && ev.target && ev.target.closest && ev.target.closest('[data-action]');
      if (!btn) return;
      var act = btn.getAttribute('data-action');
      if (act !== 'quick' && act !== 'create') return;

      ev.preventDefault();
      var v = btn.getAttribute('data-stake') || (btn.closest('.stake-card') && btn.closest('.stake-card').getAttribute('data-stake')) || selectedStake;
      setSelectedStake(v);

      if (btn.disabled) return;

      if (act === 'create'){
        await createDuel(v);
        await pollOpenOnce();
        return;
      }
      if (act === 'quick'){
        await quickMatch(v);
        return;
      }
    }, false);

    // refresh button
    var refreshBtn = byId('duels-refresh');
    if (refreshBtn){
      refreshBtn.onclick = async function(){
        await pollOpenOnce();
        await loadHistory();
      };
    }

    // load me
    try {
      var me = await apiJson('/api/me');
      if (me.r.ok && me.j && me.j.ok && me.j.user){
        myUserId = Number(me.j.user.id || me.j.user.user_id || 0) || null;
        myLinked = (me.j.user.linked) ? me.j.user.linked : null;
        updateLinksKpi();

        // шапка
        var nm = fullName(me.j.user.first_name, me.j.user.last_name, myUserId||'');
        var nmEl = byId('user-name-text'); if (nmEl) nmEl.textContent = nm;
        var avEl = byId('user-avatar'); if (avEl) avEl.src = me.j.user.avatar || '';
        var balEl = byId('user-balance'); if (balEl) balEl.textContent = fmtRub(me.j.user.balance||0);
      }
    } catch(_){}

    // initial load
    await pollOpenOnce();
    await loadHistory();
  }

  // старт
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();