// gg-linker.js — фоновая «теневая» склейка по device_id без риска
(function(){
  const API = (window.API || localStorage.getItem('ADMIN_API') || '').toString().trim() || location.origin;

  function getDeviceId(){
    // stable device id in localStorage
    let id = localStorage.getItem('gg_device_id');
    if (!id) {
      id = (Date.now().toString(36) + Math.random().toString(36).slice(2,10)).toUpperCase();
      localStorage.setItem('gg_device_id', id);
    }
    return id;
  }

  async function fetchJSON(url, init){
    try{
      const r = await fetch(url, init);
      return await r.json();
    } catch(_){ return null; }
  }

  async function fetchMe(api){
    const url = api.replace(/\/$/,'') + '/api/me';
    return await fetchJSON(url, { credentials:'include' });
  }

  function detectProvider(me){
    try {
      const p = (me && me.user && me.user.provider) || null;
      if (p) return { provider: p, id: me.user.provider_user_id };
      // fallback: try to detect by URL params or DOM
      return null;
    } catch(_){ return null; }
  }

  async function linkBackground(){
    const api = API.replace(/\/$/,'');
    const me = await fetchMe(api);
    if (!me || !me.user) return;

    const info = detectProvider(me) || {};
    const device_id = getDeviceId();

    const body = JSON.stringify({
      provider: info.provider || null,
      provider_user_id: info.id || null,
      device_id
    });

    await fetch(api + '/api/link/bind', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body
    }).catch(()=>{});
  }

  // run soon after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', linkBackground);
  } else {
    setTimeout(linkBackground, 0);
  }
})();
