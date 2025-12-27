// admin/user-card.js
(function(){
  function qs(sel){ return document.querySelector(sel); }

  function getParam(name){
    try{
      const u = new URL(location.href);
      return u.searchParams.get(name);
    }catch(_){
      // fallback
      const m = new RegExp('[?&]'+name+'=([^&#]*)').exec(location.search||'');
      return m ? decodeURIComponent(m[1].replace(/\+/g,' ')) : null;
    }
  }

  const userId = (getParam('user_id') || '').toString().trim();
  const idEl = qs('#uc-id');
  if (idEl) idEl.textContent = 'user_id: ' + (userId || '—');

  const nameEl = qs('#uc-name');
  if (nameEl) nameEl.textContent = userId ? ('Пользователь #' + userId) : 'Пользователь';

  // На шаге 2 здесь появится fetch('/api/admin/user-card?...') и рендер шапки.
})();
