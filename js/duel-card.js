// /js/duel-card.js — user duel card (front, mobile-first)

(function(){
  function qs(sel){ return document.querySelector(sel); }
  function byId(id){ return document.getElementById(id); }

  function getParam(name){
    try{
      var u = new URL(window.location.href);
      return u.searchParams.get(name);
    }catch(_){
      return null;
    }
  }

  function safeText(v){
    if (v === null || v === undefined) return '';
    return String(v);
  }

  function fullName(first, last, id){
    var a = (first||'').toString().trim();
    var b = (last||'').toString().trim();
    var n = (a + ' ' + b).trim();
    if (!n) return 'user #' + safeText(id||'—');
    return n;
  }

  function fmtRub(n){
    n = Number(n||0);
    try{
      return n.toLocaleString('ru-RU') + ' ₽';
    }catch(_){
      return String(n) + ' ₽';
    }
  }

  function fmtDT(s){
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d.getTime())) return safeText(s);
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var yy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2,'0');
    var mi = String(d.getMinutes()).padStart(2,'0');
    return dd + '.' + mm + '.' + yy + ' ' + hh + ':' + mi;
  }

  function parseDT(v){
    if (!v) return null;
    var s = String(v).trim();
    if (!s) return null;
    // common pg: "YYYY-MM-DD HH:MM:SS"
    if (!s.includes('T') && s.includes(' ')) s = s.replace(' ', 'T');
    // keep timezone if present, strip trailing "Z" only for display (Date can parse it)
    var d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function fmtDurSec(sec){
    var s = Math.max(0, Math.round(Number(sec)||0));
    if (!s) return '0с';
    var m = Math.floor(s/60); s -= m*60;
    var h = Math.floor(m/60); m -= h*60;
    var parts = [];
    if (h) parts.push(h + 'ч');
    if (m) parts.push(m + 'м');
    if (s || !parts.length) parts.push(s + 'с');
    return parts.join(' ');
  }

  function pick(obj, keys){
    if (!obj) return null;
    for (var i=0;i<keys.length;i++){
      var k = keys[i];
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
    }
    return null;
  }

  async function sha256Hex(str){
    if (!window.crypto || !crypto.subtle) throw new Error('WebCrypto недоступен');
    var buf = new TextEncoder().encode(String(str));
    var hash = await crypto.subtle.digest('SHA-256', buf);
    var arr = Array.from(new Uint8Array(hash));
    return arr.map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }

  function readMeta(name){
    var m = document.querySelector('meta[name="'+name+'"]');
    return m ? String(m.getAttribute('content')||'').trim() : '';
  }

  function apiBase(){
    var v = '';
    try { v = (localStorage.getItem('api-base') || ''); } catch(_){}
    v = v || readMeta('api-base') || (window.API_BASE||'') || 'https://vercel2pr.onrender.com';
    return String(v||'').trim().replace(/\/+$/,'');
  }

  function getAuthHeaders(){
    try{
      if (typeof window.headers === 'function') return window.headers() || {};
      if (typeof window.authHeaders === 'function') return window.authHeaders() || {};
    }catch(_){}
    return {};
  }

  async function apiJson(path, opts){
    var base = apiBase();
    var url = (/^https?:\/\//i.test(path) ? path : (base + path));
    opts = opts || {};
    var headers = opts.headers || {};
    // merge auth headers (if any)
    var H = getAuthHeaders();
    for (var k in H) headers[k] = H[k];
    opts.headers = headers;
    opts.credentials = 'include';

    var r=null, j=null;
    try{
      r = await fetch(url, opts);
      try{ j = await r.json(); }catch(_){}
    }catch(_){}
    return { r:r, j:j };
  }

  function setAva(el, url, name){
    if (!el) return;
    el.innerHTML = '';
    if (url){
      var img = document.createElement('img');
      img.src = url;
      img.alt = name || 'avatar';
      img.referrerPolicy = 'no-referrer';
      el.appendChild(img);
      return;
    }
    // fallback initials
    var t = (name||'').trim();
    var parts = t.split(/\s+/).filter(Boolean);
    var ini = parts.length ? parts[0][0] : '?';
    if (parts.length>1) ini += parts[parts.length-1][0];
    el.textContent = ini.toUpperCase();
  }

  function tag(html, cls){
    var s = document.createElement('span');
    s.className = 'dc-tag' + (cls ? (' ' + cls) : '');
    s.textContent = html;
    return s;
  }

  function setTags(root, tags){
    if (!root) return;
    root.innerHTML = '';
    for (var i=0;i<tags.length;i++) root.appendChild(tags[i]);
  }

  async function boot(){
    var duelId = getParam('id') || (location.hash ? location.hash.replace('#','') : '');
    duelId = String(duelId||'').replace(/[^0-9]/g,'');
    if (!duelId){
      byId('dcSubtitle').textContent = 'Не указан id дуэли';
      return;
    }

    var back = getParam('back');
    if (back){
      var a = byId('backLink');
      if (a) a.href = back;
    }

    var copyBtn = byId('copyBtn');
    if (copyBtn){
      copyBtn.onclick = function(){
        try{
          navigator.clipboard.writeText(duelId);
          copyBtn.textContent = 'Скопировано';
          setTimeout(function(){ copyBtn.textContent = 'Скопировать ID'; }, 1200);
        }catch(_){}
      };
    }

    byId('dcId').textContent = '#' + duelId;
    byId('dcTitle').textContent = 'Дуэль #' + duelId;

    // who am I?
    var myUserId = null;
    try{
      var me = await apiJson('/api/me');
      if (me.r && me.r.ok && me.j && me.j.ok && me.j.user) myUserId = me.j.user.id;
    }catch(_){}

    var res = await apiJson('/api/duels/' + encodeURIComponent(duelId));
    if (!res.r || !res.r.ok || !res.j || !res.j.ok || !res.j.item){
      byId('dcSubtitle').textContent = 'Не удалось загрузить данные дуэли';
      byId('dcStatusPill').textContent = 'Ошибка';
      return;
    }

    var it = res.j.item;
    byId('dcSubtitle').textContent = safeText(it.status||'');
    byId('dcStatusPill').textContent = safeText(it.status||'—');
    byId('dcStakePill').textContent = 'Ставка: ' + fmtRub(it.stake||0);

    var pot=0, fee=0, payout=0;
    try{
      var rr = it.result;
      if (typeof rr === 'string') rr = JSON.parse(rr);
      if (rr){
        pot = Number(rr.pot||0);
        fee = Number(rr.fee||0);
        payout = Number(rr.payout||0);
      }
    }catch(_){}

    byId('kpiPot').textContent = fmtRub(pot||0);
    byId('kpiFee').textContent = fmtRub(fee||0);
    byId('kpiPayout').textContent = fmtRub(payout||0);

    var cName = fullName(it.creator_first_name, it.creator_last_name, it.creator_user_id);
    var oName = fullName(it.opponent_first_name, it.opponent_last_name, it.opponent_user_id);

    setAva(byId('p1Ava'), it.creator_avatar, cName);
    setAva(byId('p2Ava'), it.opponent_avatar, oName);
    byId('p1Name').textContent = cName;
    byId('p2Name').textContent = oName;

    var winnerId = it.winner_user_id || (it.winner && it.winner.user_id) || null;
    var cTags = [tag('Создатель')];
    var oTags = [tag('Оппонент')];

    if (myUserId && Number(it.creator_user_id) === Number(myUserId)) cTags.push(tag('Вы', 'dc-tag-me'));
    if (myUserId && Number(it.opponent_user_id) === Number(myUserId)) oTags.push(tag('Вы', 'dc-tag-me'));

    if (winnerId){
      if (Number(winnerId) === Number(it.creator_user_id)){
        cTags.push(tag('Победа', 'dc-tag-win'));
        if (it.opponent_user_id) oTags.push(tag('Поражение', 'dc-tag-lose'));
      } else if (Number(winnerId) === Number(it.opponent_user_id)){
        oTags.push(tag('Победа', 'dc-tag-win'));
        if (it.creator_user_id) cTags.push(tag('Поражение', 'dc-tag-lose'));
      }
    }

    setTags(byId('p1Tags'), cTags);
    setTags(byId('p2Tags'), oTags);

        // winner highlight
    try{
      var p1El = byId('p1');
      var p2El = byId('p2');
      if (p1El) p1El.classList.remove('is-win','is-lose');
      if (p2El) p2El.classList.remove('is-win','is-lose');
      if (winnerId){
        if (Number(winnerId) === Number(it.creator_user_id)){
          if (p1El) p1El.classList.add('is-win');
          if (p2El) p2El.classList.add('is-lose');
        } else if (Number(winnerId) === Number(it.opponent_user_id)){
          if (p2El) p2El.classList.add('is-win');
          if (p1El) p1El.classList.add('is-lose');
        }
      }
    }catch(_){}

    // Финансы (best-effort)
    var stake = Number(it.stake||0);
    if ((!pot || pot===0) && stake) pot = stake*2;
    if ((!fee || fee===0) && rr && typeof rr === 'object'){
      fee = Number(pick(rr, ['fee','rake','rake_fee','rake_amount','platform_fee']) || 0);
    }
    if ((!payout || payout===0) && pot) payout = Math.max(0, pot - fee);

    if (byId('finStake')) byId('finStake').textContent = fmtRub(stake||0);
    if (byId('finPot')) byId('finPot').textContent = fmtRub(pot||0);
    if (byId('finFee')) byId('finFee').textContent = fmtRub(fee||0);
    if (byId('finPayout')) byId('finPayout').textContent = fmtRub(payout||0);

    var profit = (payout && stake) ? (payout - stake) : null;
    if (byId('finProfit')) byId('finProfit').textContent = (profit!=null ? fmtRub(profit) : '—');

    var cNet = '—', oNet = '—';
    if (winnerId && stake){
      if (Number(winnerId) === Number(it.creator_user_id)){
        cNet = '+' + fmtRub(profit!=null?profit:0);
        oNet = '−' + fmtRub(stake);
      } else if (Number(winnerId) === Number(it.opponent_user_id)){
        oNet = '+' + fmtRub(profit!=null?profit:0);
        cNet = '−' + fmtRub(stake);
      }
    } else if (stake){
      // дуэль ещё не завершена — показываем только ожидание ставок
      if (it.creator_user_id) cNet = '−' + fmtRub(stake);
      if (it.opponent_user_id) oNet = '−' + fmtRub(stake);
    }
    if (byId('finCreator')) byId('finCreator').textContent = cNet;
    if (byId('finOpponent')) byId('finOpponent').textContent = oNet;

    // Таймлайн: created → join → coinflip → payout (best-effort)
    var createdAt = pick(it, ['created_at','createdAt']) || it.created_at;
    var joinedAt = pick(it, ['joined_at','opponent_joined_at','started_at']);
    if (!joinedAt && rr && typeof rr === 'object') joinedAt = pick(rr, ['joined_at','opponent_joined_at','join_at','join_ts','started_at','joinedAt']);
    if (!joinedAt && it.opponent_user_id && it.updated_at) joinedAt = it.updated_at;

    var coinAt = (rr && typeof rr === 'object') ? pick(rr, ['coinflip_at','coinflip_ts','rng_at','coin_at','flip_at']) : null;
    var payoutAt = (rr && typeof rr === 'object') ? pick(rr, ['payout_at','payout_ts','paid_at']) : null;
    if (!payoutAt) payoutAt = pick(it, ['finished_at','finishedAt']) || it.finished_at;

    byId('tCreated').textContent = fmtDT(createdAt);
    byId('tJoined').textContent  = joinedAt ? fmtDT(joinedAt) : '—';
    byId('tCoinflip').textContent = coinAt ? fmtDT(coinAt) : '—';
    byId('tPayout').textContent  = payoutAt ? fmtDT(payoutAt) : '—';

    if (byId('tUpdated')) byId('tUpdated').textContent  = fmtDT(it.updated_at);
    if (byId('tFinished')) byId('tFinished').textContent = it.finished_at ? fmtDT(it.finished_at) : '—';

    var dC = parseDT(createdAt);
    var dJ = parseDT(joinedAt);
    var dCoin = parseDT(coinAt);
    var dP = parseDT(payoutAt);

    var dparts = [];
    if (dC && dJ) dparts.push('Ожидание соперника: ' + fmtDurSec((dJ - dC)/1000));
    if (dJ && dCoin) dparts.push('До coinflip: ' + fmtDurSec((dCoin - dJ)/1000));
    if (dCoin && dP) dparts.push('До выплаты: ' + fmtDurSec((dP - dCoin)/1000));
    if (!dparts.length && dC && dP) dparts.push('Длительность: ' + fmtDurSec((dP - dC)/1000));
    if (byId('tDur')) byId('tDur').textContent = dparts.length ? dparts.join(' • ') : '—';

    // PF (provably fair): вытаскиваем из result/meta, если есть
    var pf = {};
    function take(src, fromKey, toKey){
      if (!src || typeof src !== 'object') return;
      var v = src[fromKey];
      if (v === undefined || v === null) return;
      var s = String(v);
      if (!s.trim()) return;
      if (pf[toKey] === undefined || pf[toKey] === null || !String(pf[toKey]).trim()){
        pf[toKey] = v;
      }
    }

    var sources = [];
    if (rr && typeof rr === 'object'){
      sources.push(rr);
      if (rr.pf) sources.push(rr.pf);
      if (rr.provably_fair) sources.push(rr.provably_fair);
      if (rr.provablyFair) sources.push(rr.provablyFair);
      if (rr.rng) sources.push(rr.rng);
    }
    sources.push(it);
    try{
      var meta = it.meta;
      if (typeof meta === 'string') meta = JSON.parse(meta);
      if (meta) sources.push(meta);
    }catch(_){}

    for (var si=0; si<sources.length; si++){
      var ssrc = sources[si];
      take(ssrc, 'commit', 'commit');
      take(ssrc, 'hash', 'commit');
      take(ssrc, 'server_seed_hash', 'commit');

      take(ssrc, 'nonce', 'nonce');
      take(ssrc, 'pf_nonce', 'nonce');

      take(ssrc, 'client_seed', 'client_seed');
      take(ssrc, 'clientSeed', 'client_seed');

      take(ssrc, 'server_seed', 'server_seed');
      take(ssrc, 'serverSeed', 'server_seed');

      take(ssrc, 'method', 'method');
      take(ssrc, 'rand_source', 'rand_source');

      take(ssrc, 'winner_user_id', 'winner_user_id');
      take(ssrc, 'roll', 'roll');
    }

    if (byId('pfCommit')) byId('pfCommit').textContent = safeText(pf.commit || '—');
    if (byId('pfNonce')) byId('pfNonce').textContent = safeText(pf.nonce || '—');
    if (byId('pfClientSeed')) byId('pfClientSeed').textContent = safeText(pf.client_seed || '—');

    function kvAppend(container, k, v){
      if (!container) return;
      var kk = document.createElement('div'); kk.className = 'dc-k'; kk.textContent = k;
      var vv = document.createElement('div'); vv.className = 'dc-v mono'; vv.textContent = (v==null? '—' : String(v));
      container.appendChild(kk); container.appendChild(vv);
    }

    var pfKv = byId('pfKv');
    if (pfKv){
      pfKv.innerHTML = '';
      if (pf.method) kvAppend(pfKv, 'method', pf.method);
      if (pf.rand_source) kvAppend(pfKv, 'rand_source', pf.rand_source);
      kvAppend(pfKv, 'commit', pf.commit || '—');
      kvAppend(pfKv, 'nonce', pf.nonce || '—');
      kvAppend(pfKv, 'client_seed', pf.client_seed || '—');
      kvAppend(pfKv, 'server_seed', pf.server_seed ? pf.server_seed : '—');
      if (pf.roll) kvAppend(pfKv, 'roll', pf.roll);
      if (pf.winner_user_id) kvAppend(pfKv, 'winner_user_id', pf.winner_user_id);
    }

    var pfNote = byId('pfNote');
    if (pfNote){
      pfNote.textContent = 'Проверка: sha256(server_seed:client_seed:nonce) → первые 16 hex как roll. roll чётный — победа creator, иначе opponent.';
    }

    var pfBtn = byId('pfVerifyBtn');
    var pfResEl = byId('pfResult');
    if (pfBtn){
      var canVerify = !!(pf.server_seed && pf.client_seed && (pf.nonce !== undefined && pf.nonce !== null && String(pf.nonce).trim() !== '') && window.crypto && crypto.subtle);
      pfBtn.disabled = !canVerify;
      if (!canVerify && pfResEl){
        if (!window.crypto || !crypto.subtle) pfResEl.textContent = 'Проверка недоступна в браузере';
        else pfResEl.textContent = 'Нужны server_seed + client_seed + nonce';
      }

      pfBtn.onclick = async function(){
        if (!pfResEl) return;
        try{
          var base = String(pf.server_seed) + ':' + String(pf.client_seed) + ':' + String(pf.nonce);
          var h = await sha256Hex(base);
          var roll = BigInt('0x' + h.slice(0,16));
          var side = (roll % 2n === 0n) ? 'creator' : 'opponent';

          var hSeed = await sha256Hex(String(pf.server_seed));
          var commitOk = '';
          if (pf.commit){
            var c = String(pf.commit).toLowerCase().replace(/^0x/, '');
            if (c === h) commitOk = 'commit OK (hash)';
            else if (c === hSeed) commitOk = 'commit OK (sha256(server_seed))';
            else commitOk = 'commit ≠ hash';
          }

          pfResEl.textContent = 'roll: ' + String(roll) + ' → ' + side + (commitOk ? ' • ' + commitOk : '');

          // append computed into details
          if (pfKv){
            kvAppend(pfKv, 'computed.hash', h);
            kvAppend(pfKv, 'computed.roll', String(roll));
            kvAppend(pfKv, 'computed.side', side);
            kvAppend(pfKv, 'computed.sha256(server_seed)', hSeed);
          }

          var predicted = (side === 'creator') ? it.creator_user_id : it.opponent_user_id;
          var actualWinner = winnerId || pf.winner_user_id || null;
          if (predicted && actualWinner){
            var ok = (Number(predicted) === Number(actualWinner));
            pfResEl.textContent += ok ? ' • winner совпал' : ' • winner НЕ совпал';
          }
        }catch(err){
          pfResEl.textContent = 'Ошибка проверки: ' + (err && err.message ? err.message : String(err));
        }
      };
    }

  boot();
})();
