// /js/lobby-balance-fix.js — восстановление баланса и правильное размещение кнопки «Связать …»
(function(){
  // ------- helpers -------
  function qs(s){ return document.querySelector(s); }
  function byId(id){ return document.getElementById(id); }
  function readMeta(name){
    var m = document.querySelector('meta[name="'+name+'"]');
    return m ? (m.getAttribute('content')||'').trim() : '';
  }
  function API(){
    return readMeta('api-base') || (window.API_BASE||'').trim() || 'https://vercel2pr.onrender.com';
  }
  function rub(n){
    try { return '₽ ' + (Number(n)||0).toLocaleString('ru-RU'); } catch(_){ return '₽ 0'; }
  }
  function getDeviceId(){
    try{
      var id = localStorage.getItem('device_id');
      if(!id){
        id = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(16)+Math.random().toString(16).slice(2)));
        localStorage.setItem('device_id', id);
      }
      document.cookie = 'device_id=' + id + '; Path=/; Max-Age=' + (60*60*24*365) + '; SameSite=Lax';
      return id;
    }catch(_){ return null; }
  }

  // ------- баланс из /api/me -------
  async function refreshBalance(){
    try{
      var r = await fetch(API() + '/api/me', { credentials:'include', cache:'no-store' });
      if(!r.ok) throw 0;
      var j = await r.json();
      if (!j || !j.ok || !j.user) throw 0;
      var bal = Number(j.user.balance || 0);
      var balSpan = document.querySelector('[data-balance]');
      if (balSpan) balSpan.textContent = String(bal);
      else {
        var pill = byId('user-balance');
        if (pill) pill.textContent = rub(bal);
      }
      // проставим подпись источника, если её ещё не выставили
      var note = byId('provider-note');
      if (note && !note.textContent) {
        var provider = (j.user.vk_id && !String(j.user.vk_id).startsWith('tg:')) ? 'vk' : 'tg';
        note.textContent = 'Источник данных: ' + provider.toUpperCase();
      }
      return j.user;
    }catch(_){
      return null; // тихо падаем, страница рендерится дальше
    }
  }

  // ------- запуск линковки ВК/TG -------
  function startLinkVK(){
    var ret = encodeURIComponent(location.href);
    var url = API() + '/api/auth/vk/start?mode=link&return=' + ret;
    var did = getDeviceId();
    if (did) url += '&device_id=' + encodeURIComponent(did);
    window.location.href = url;
  }
  function ensureTelegramScript(){
    if (window.Telegram && window.Telegram.Login && typeof Telegram.Login.auth === 'function') return Promise.resolve(true);
    return new Promise(function(resolve){
      var s = document.createElement('script');
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      s.async = true;
      s.onload = function(){ resolve(true); };
      s.onerror = function(){ resolve(false); };
      document.head.appendChild(s);
    });
  }
  async function startLinkTG(){
    var ok = await ensureTelegramScript();
    if(!ok){ alert('Не удалось загрузить Telegram Login. Обновите страницу и повторите.'); return; }
    var did = getDeviceId();
    var botId = (window.TG_BOT_ID ? Number(window.TG_BOT_ID) : null);
    if (!botId) { 
      console.warn('[link-tg] нет TG_BOT_ID'); 
      alert('Не указан ID Telegram-бота для линковки.'); 
      return; 
    }
    try{
      Telegram.Login.auth({ bot_id: botId, request_access: 'write' }, function(user){
        if(!user || !user.id){ alert('Telegram не прислал профиль.'); return; }
        var p = new URLSearchParams(Object.assign({}, user, { mode:'link', primary_uid:'', device_id:String(did||'') }));
        window.location.href = API() + '/tg/callback?' + p.toString();
      });
    }catch(e){
      console.error(e);
      alert('Не удалось запустить Telegram Login.');
    }
  }

  // ------- правильная кнопка рядом с балансом -------
  function placeHeaderLinkButton(currentProvider){
    // прячем левый «самодельный» блок
    var leftBox = byId('link-actions');
    if (leftBox) leftBox.classList.add('hidden');

    var btnTG = byId('link-tg');
    var btnVK = byId('link-vk');

    if (currentProvider === 'tg'){
      // показываем синюю VK-кнопку у баланса
      if (btnVK){
        btnVK.classList.add('vk');
        btnVK.style.display = 'inline-flex';
        btnVK.onclick = function(e){ e.preventDefault(); startLinkVK(); };
      }
      if (btnTG) btnTG.style.display = 'none';
    } else if (currentProvider === 'vk'){
      if (btnTG){
        btnTG.classList.add('tg');
        btnTG.style.display = 'inline-flex';
        btnTG.onclick = function(e){ e.preventDefault(); startLinkTG(); };
      }
      if (btnVK) btnVK.style.display = 'none';
    }
  }

  // ------- init -------
  document.addEventListener('DOMContentLoaded', async function(){
    var user = await refreshBalance();
    var provider = 'tg';
    try{
      if (user) {
        provider = (user.vk_id && !String(user.vk_id).startsWith('tg:')) ? 'vk' : 'tg';
      } else {
        var p = new URLSearchParams(location.search);
        provider = p.get('provider') || 'tg';
      }
    }catch(_){}
    placeHeaderLinkButton(provider);
  });
})();
