// /js/duel-card.js — user duel card (front)
// Loads duel data from backend and renders compact "support-friendly" duel card.

(function () {
  var API_FALLBACK = 'https://vercel2pr.onrender.com';

  function qs(sel) { return document.querySelector(sel); }
  function byId(id) { return document.getElementById(id); }

  function getParam(name) {
    try {
      var u = new URL(window.location.href);
      return u.searchParams.get(name);
    } catch (_) {
      return null;
    }
  }

  function apiBase() {
    try {
      var meta = qs('meta[name="api-base"]');
      if (meta && meta.content) return meta.content.replace(/\/+$/, '');
    } catch (_) {}
    try {
      var ls = localStorage.getItem('API_BASE');
      if (ls) return String(ls).replace(/\/+$/, '');
    } catch (_) {}
    return API_FALLBACK;
  }

  function getAuthHeaders() {
    try {
      if (typeof window.adminHeaders === 'function') return window.adminHeaders() || {};
      if (typeof window.headers === 'function') return window.headers() || {};
      if (typeof window.authHeaders === 'function') return window.authHeaders() || {};
    } catch (_) {}
    return {};
  }

  async function apiJson(path, opts) {
    var base = apiBase();
    var url = /^https?:\/\//i.test(path) ? path : (base + path);

    var o = opts || {};
    o.credentials = 'include';
    o.headers = o.headers || {};

    var H = getAuthHeaders();
    for (var k in H) o.headers[k] = H[k];

    var r = null;
    var j = null;
    try {
      r = await fetch(url, o);
      try { j = await r.json(); } catch (_) {}
    } catch (_) {}
    return { r: r, j: j };
  }

  function safeText(v) {
    if (v === null || v === undefined) return '';
    return String(v);
  }

  function fullName(first, last, id) {
    var a = (first || '').toString().trim();
    var b = (last || '').toString().trim();
    var n = (a + ' ' + b).trim();
    if (!n) return 'user #' + safeText(id || '—');
    return n;
  }

  function fmtRub(n) {
    n = Number(n || 0);
    if (!isFinite(n)) n = 0;
    try {
      return n.toLocaleString('ru-RU') + ' ₽';
    } catch (_) {
      return String(n) + ' ₽';
    }
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return safeText(ts);
    try {
      // Always show MSK (+3) to be consistent with admin/ops.
      return d.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    } catch (_) {
      return d.toLocaleString('ru-RU');
    }
  }

  function setText(id, v) {
    var el = byId(id);
    if (!el) return;
    el.textContent = (v === null || v === undefined || v === '') ? '—' : String(v);
  }

  function setAva(el, url, name) {
    if (!el) return;
    el.innerHTML = '';
    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = name || 'avatar';
      img.referrerPolicy = 'no-referrer';
      el.appendChild(img);
      return;
    }
    var ph = document.createElement('div');
    ph.className = 'dc-ava-ph';
    ph.textContent = (name && name.trim()) ? name.trim().slice(0, 1).toUpperCase() : '•';
    el.appendChild(ph);
  }

  function pillStatus(status) {
    status = String(status || '').toLowerCase();
    if (status === 'open') return { t: 'Ожидает', cls: 'dc-pill dc-pill-live' };
    if (status === 'finished') return { t: 'Завершено', cls: 'dc-pill dc-pill-ok' };
    if (status === 'cancelled' || status === 'canceled') return { t: 'Отменено', cls: 'dc-pill dc-pill-muted' };
    return { t: status || '—', cls: 'dc-pill dc-pill-muted' };
  }

  function setTags(container, tags) {
    if (!container) return;
    container.innerHTML = '';
    (tags || []).forEach(function (t) {
      var s = document.createElement('span');
      s.className = 'dc-tag';
      s.textContent = t;
      container.appendChild(s);
    });
  }

  function addTag(container, text, kind) {
    if (!container) return;
    var s = document.createElement('span');
    s.className = 'dc-tag' + (kind ? (' dc-tag-' + kind) : '');
    s.textContent = text;
    container.appendChild(s);
  }

  function kvAppend(container, k, v) {
    if (!container) return;
    var kk = document.createElement('div');
    kk.className = 'dc-k';
    kk.textContent = k;
    var vv = document.createElement('div');
    vv.className = 'dc-v mono';
    vv.textContent = (v === null || v === undefined) ? '—' : String(v);
    container.appendChild(kk);
    container.appendChild(vv);
  }

  async function sha256Hex(str) {
    var enc = new TextEncoder();
    var buf = enc.encode(str);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    var arr = Array.from(new Uint8Array(hash));
    return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function computeEconomy(stake, feeBps) {
    var pot = stake * 2;
    var fee = Math.floor(pot * (feeBps / 10000));
    var payout = pot - fee;
    var profit = payout - stake;
    return { pot: pot, fee: fee, payout: payout, profit: profit };
  }

  function render(it, me) {
    // Header
    setText('dcId', '#' + it.id);
    setText('dcTitle', 'Дуэль #' + it.id);
    setText('dcSubtitle', 'Открыта: ' + fmtDate(it.created_at));

    var sp = byId('dcStatusPill');
    var st = pillStatus(it.status);
    if (sp) { sp.textContent = st.t; sp.className = st.cls; }

    setText('dcStakePill', 'Ставка: ' + fmtRub(it.stake || 0));

    // Economy
    var stake = Number(it.stake || 0);
    var feeBps = Number(it.fee_bps || 500);
    var eco = computeEconomy(stake, feeBps);

    setText('kpiPot', fmtRub(eco.pot));
    setText('kpiFee', fmtRub(eco.fee));
    setText('kpiPayout', fmtRub(eco.payout));

    setText('finStake', fmtRub(stake));
    setText('finPot', fmtRub(eco.pot));
    setText('finFee', fmtRub(eco.fee));
    setText('finPayout', fmtRub(eco.payout));
    setText('finProfit', fmtRub(eco.profit));

    // Participants
    var p1Ava = byId('p1Ava'), p2Ava = byId('p2Ava');
    var p1Name = byId('p1Name'), p2Name = byId('p2Name');
    var p1Tags = byId('p1Tags'), p2Tags = byId('p2Tags');

    var creatorName = fullName(it.creator_first_name, it.creator_last_name, it.creator_user_id);
    var oppName = it.opponent_user_id
      ? fullName(it.opponent_first_name, it.opponent_last_name, it.opponent_user_id)
      : 'Ожидаем соперника';

    if (p1Name) p1Name.textContent = creatorName;
    if (p2Name) p2Name.textContent = oppName;

    setAva(p1Ava, it.creator_avatar, creatorName);
    setAva(p2Ava, it.opponent_avatar, oppName);

    if (p1Tags) p1Tags.innerHTML = '';
    if (p2Tags) p2Tags.innerHTML = '';

    var myId = me && (me.id || me.user_id) ? Number(me.id || me.user_id) : null;
    if (myId && Number(it.creator_user_id) === myId) addTag(p1Tags, 'Вы', 'me');
    if (myId && Number(it.opponent_user_id) === myId) addTag(p2Tags, 'Вы', 'me');

    var winnerId = it.winner_user_id ? Number(it.winner_user_id) : null;
    if (winnerId) {
      if (Number(it.creator_user_id) === winnerId) addTag(p1Tags, 'Победитель', 'win');
      if (Number(it.opponent_user_id) === winnerId) addTag(p2Tags, 'Победитель', 'win');
      if (Number(it.creator_user_id) !== winnerId) addTag(p1Tags, 'Проиграл', 'lose');
      if (Number(it.opponent_user_id) !== winnerId) addTag(p2Tags, 'Проиграл', 'lose');
      // add class to cards
      var p1 = byId('p1'), p2 = byId('p2');
      if (p1) p1.classList.toggle('is-win', Number(it.creator_user_id) === winnerId);
      if (p1) p1.classList.toggle('is-lose', it.opponent_user_id && Number(it.creator_user_id) !== winnerId);
      if (p2) p2.classList.toggle('is-win', it.opponent_user_id && Number(it.opponent_user_id) === winnerId);
      if (p2) p2.classList.toggle('is-lose', it.opponent_user_id && Number(it.opponent_user_id) !== winnerId);
    }

    // Split (net for each side)
    var creatorNet = '—';
    var oppNet = '—';
    if (it.status === 'finished' && winnerId && stake > 0) {
      if (Number(it.creator_user_id) === winnerId) creatorNet = '+' + fmtRub(eco.profit);
      else creatorNet = '−' + fmtRub(stake);
      if (it.opponent_user_id) {
        if (Number(it.opponent_user_id) === winnerId) oppNet = '+' + fmtRub(eco.profit);
        else oppNet = '−' + fmtRub(stake);
      }
    }
    setText('finCreator', creatorNet);
    setText('finOpponent', oppNet);

    // Timeline
    setText('tCreated', fmtDate(it.created_at));
    // We don't have dedicated joined/coinflip/payout timestamps in duel_rooms now; approximate from updated/finished.
    setText('tUpdated', safeText(it.updated_at || '—'));
    setText('tFinished', safeText(it.finished_at || '—'));

    var joinedGuess = it.opponent_user_id ? fmtDate(it.updated_at || it.created_at) : '—';
    setText('tJoined', joinedGuess);

    var coinflipGuess = (it.status === 'finished') ? fmtDate(it.updated_at || it.finished_at) : '—';
    setText('tCoinflip', coinflipGuess);

    var payoutGuess = (it.status === 'finished') ? fmtDate(it.finished_at || it.updated_at) : '—';
    setText('tPayout', payoutGuess);

    // Duration hint
    var tDur = byId('tDur');
    if (tDur) {
      var d0 = it.created_at ? new Date(it.created_at).getTime() : NaN;
      var d1 = it.finished_at ? new Date(it.finished_at).getTime() : NaN;
      if (!isNaN(d0) && !isNaN(d1) && d1 >= d0) {
        var sec = Math.floor((d1 - d0) / 1000);
        var mm = Math.floor(sec / 60);
        var ss = sec % 60;
        tDur.textContent = 'Длительность: ' + mm + 'м ' + ss + 'с';
      } else {
        tDur.textContent = '—';
      }
    }

    // PF
    var meta = null;
    if (it.meta && typeof it.meta === 'object') meta = it.meta;
    else if (typeof it.meta === 'string') meta = parseMaybeJson(it.meta);

    var pfMeta = meta && meta.pf && typeof meta.pf === 'object' ? meta.pf : {};

    var resultObj = null;
    if (it.result && typeof it.result === 'object') resultObj = it.result;
    else if (typeof it.result === 'string') resultObj = parseMaybeJson(it.result);

    var pfRes = null;
    if (resultObj && typeof resultObj === 'object') {
      pfRes = resultObj.provably_fair || resultObj.provablyFair || resultObj.provably_fair_v1 || null;
      if (pfRes && typeof pfRes !== 'object') pfRes = null;
    }

    var pf = Object.assign({}, pfMeta, (pfRes || {}));

    // normalize common keys
    pf.commit = pf.commit || pf.commit_hash || pf.commitHash || pf.server_commit || pf.serverCommit;
    pf.nonce = (pf.nonce === 0 || pf.nonce) ? pf.nonce : ((pfMeta.nonce === 0 || pfMeta.nonce) ? pfMeta.nonce : ((pfRes && (pfRes.nonce === 0 || pfRes.nonce)) ? pfRes.nonce : null));
    pf.server_seed = pf.server_seed || pf.serverSeed || pf.serverseed;
    pf.client_seed = pf.client_seed || pf.clientSeed || pf.clientseed;

    // our canonical client_seed (backend pfCompute) is deterministic; restore if API didn't store it
    if (!pf.client_seed && it.id && it.creator_user_id && it.opponent_user_id) {
      pf.client_seed = String(it.id) + ':' + String(it.creator_user_id) + ':' + String(it.opponent_user_id);
    }

    setText('pfCommit', pf.commit || '—');
    setText('pfNonce', (pf.nonce === 0 || pf.nonce) ? String(pf.nonce) : '—');
    setText('pfClientSeed', pf.client_seed || '—');

var pfKv = byId('pfKv');
    if (pfKv) {
      pfKv.innerHTML = '';
      if (pf.method) kvAppend(pfKv, 'method', pf.method);
      if (pf.rand_source) kvAppend(pfKv, 'rand_source', pf.rand_source);
      kvAppend(pfKv, 'commit', pf.commit || '—');
      kvAppend(pfKv, 'nonce', (pf.nonce === 0 || pf.nonce) ? String(pf.nonce) : '—');
      kvAppend(pfKv, 'client_seed', pf.client_seed || '—');
      kvAppend(pfKv, 'server_seed', pf.server_seed ? String(pf.server_seed) : '—');
      if (pf.roll !== undefined && pf.roll !== null) kvAppend(pfKv, 'roll', pf.roll);
      if (pf.winner_user_id) kvAppend(pfKv, 'winner_user_id', pf.winner_user_id);
    }

    var pfNote = byId('pfNote');
    if (pfNote) {
      pfNote.textContent = 'Проверка: sha256(server_seed:client_seed:nonce) → берём первые 16 hex как roll. roll чётный — победа creator, иначе opponent.';
    }

    var pfBtn = byId('pfVerifyBtn');
    var pfRes = byId('pfResult');
    if (pfBtn) {
      var hasCrypto = !!(window.crypto && crypto.subtle);
      var nonceOk = (pf.nonce === 0 || (pf.nonce && String(pf.nonce).trim() !== ''));
      var missing = [];
      if (!pf.server_seed) missing.push('server_seed');
      if (!pf.client_seed) missing.push('client_seed');
      if (!nonceOk) missing.push('nonce');

      var canVerify = hasCrypto && missing.length === 0;
      pfBtn.disabled = !canVerify;

      if (pfRes) {
        if (!hasCrypto) pfRes.textContent = 'Проверка недоступна в браузере';
        else if (!canVerify) {
          var st = String(it.status || '').toLowerCase();
          if (missing.indexOf('server_seed') !== -1 && st !== 'finished') {
            pfRes.textContent = 'server_seed раскрывается после завершения дуэли';
          } else {
            pfRes.textContent = 'Нужно: ' + missing.join(' + ');
          }
        } else pfRes.textContent = 'Готово к проверке';
      }

pfBtn.onclick = async function () {
        if (!pfRes) return;
        try {
          var base = String(pf.server_seed) + ':' + String(pf.client_seed) + ':' + String(pf.nonce);
          var h = await sha256Hex(base);
          var roll = BigInt('0x' + h.slice(0, 16));
          var side = (roll % 2n === 0n) ? 'creator' : 'opponent';

          var commitOk = '';
          if (pf.commit) {
            var c = String(pf.commit).toLowerCase().replace(/^0x/, '');
            if (c === h) commitOk = 'commit OK (hash)';
            else {
              var hSeed = await sha256Hex(String(pf.server_seed));
              if (c === hSeed) commitOk = 'commit OK (sha256(server_seed))';
              else commitOk = 'commit ≠ hash';
              if (pfKv) kvAppend(pfKv, 'computed.sha256(server_seed)', hSeed);
            }
          }

          pfRes.textContent = 'roll: ' + String(roll) + ' → ' + side + (commitOk ? ' • ' + commitOk : '');

          if (pfKv) {
            kvAppend(pfKv, 'computed.hash', h);
            kvAppend(pfKv, 'computed.roll', String(roll));
            kvAppend(pfKv, 'computed.side', side);
          }

          var predictedWinner = (side === 'creator') ? it.creator_user_id : it.opponent_user_id;
          if (predictedWinner && winnerId) {
            pfRes.textContent += (Number(predictedWinner) === Number(winnerId)) ? ' • winner совпал' : ' • winner НЕ совпал';
          }
        } catch (err) {
          pfRes.textContent = 'Ошибка проверки: ' + (err && err.message ? err.message : String(err));
        }
      };
    }

    // Copy button
    var copyBtn = byId('copyBtn');
    if (copyBtn) {
      copyBtn.onclick = async function () {
        try {
          await navigator.clipboard.writeText(String(it.id));
          copyBtn.textContent = 'Скопировано!';
          setTimeout(function () { copyBtn.textContent = 'Скопировать ID'; }, 900);
        } catch (_) {
          // fallback
          try {
            var ta = document.createElement('textarea');
            ta.value = String(it.id);
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.textContent = 'Скопировано!';
            setTimeout(function () { copyBtn.textContent = 'Скопировать ID'; }, 900);
          } catch (__) {}
        }
      };
    }
  }

  async function boot() {
    var duelId = getParam('id') || getParam('duel_id') || getParam('duelId');
    if (!duelId) {
      setText('dcSubtitle', 'Нет параметра duel_id');
      return;
    }

    // back link passthrough (optional)
    try {
      var back = getParam('back');
      if (back) {
        var a = byId('backLink');
        if (a) a.href = decodeURIComponent(back);
      }
    } catch (_) {}

    // load me (optional)
    var me = null;
    try {
      var mr = await apiJson('/api/me');
      if (mr.r && mr.r.ok && mr.j && mr.j.ok) {
        me = mr.j.user || mr.j.me || mr.j;
      }
    } catch (_) {}

    // load duel
    var dr = await apiJson('/api/duels/' + encodeURIComponent(duelId));
    if (!dr.r || !dr.r.ok || !dr.j || !dr.j.ok || !dr.j.item) {
      setText('dcSubtitle', 'Не удалось загрузить данные дуэли');
      var sp = byId('dcStatusPill');
      if (sp) { sp.textContent = 'Ошибка'; sp.className = 'dc-pill dc-pill-muted'; }
      return;
    }

    render(dr.j.item, me);
  }

  boot();
})();
