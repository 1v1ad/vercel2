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

  async function apiJson(path, opts){
    opts = opts || {};
    opts.credentials = 'include';
    var r=null, j=null;
    try{
      r = await fetch(path, opts);
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

    byId('tCreated').textContent  = fmtDT(it.created_at);
    byId('tUpdated').textContent  = fmtDT(it.updated_at);
    byId('tFinished').textContent = it.finished_at ? fmtDT(it.finished_at) : '—';

    // PF fields (best-effort)
    var pfKv = byId('pfKv');
    var fields = [];
    ['commit','nonce','client_seed','server_seed_hash','server_seed','seed','proof'].forEach(function(k){
      if (it[k] !== undefined && it[k] !== null && safeText(it[k]).trim() !== ''){
        fields.push([k, safeText(it[k])]);
      }
    });
    // Sometimes it may live inside it.result / it.meta
    try{
      var meta = it.meta;
      if (typeof meta === 'string') meta = JSON.parse(meta);
      if (meta && typeof meta === 'object'){
        ['commit','nonce','client_seed','server_seed_hash'].forEach(function(k){
          if (meta[k] !== undefined && meta[k] !== null && safeText(meta[k]).trim() !== ''){
            fields.push(['meta.'+k, safeText(meta[k])]);
          }
        });
      }
    }catch(_){}

    if (fields.length && pfKv){
      byId('pfHint').style.display = 'none';
      var frag = document.createDocumentFragment();
      for (var i=0;i<fields.length;i++){
        var k = document.createElement('div');
        k.className = 'dc-k';
        k.textContent = fields[i][0];

        var v = document.createElement('div');
        v.className = 'dc-v';
        v.textContent = fields[i][1];

        frag.appendChild(k);
        frag.appendChild(v);
      }
      pfKv.appendChild(frag);
      byId('pfDetails').open = true;
    }
  }

  boot();
})();
