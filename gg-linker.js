// gg-linker.js — robust background link with fallback endpoints
(function(){
  function baseApi(){
    const a = (window.API || localStorage.getItem('ADMIN_API') || '').toString().trim();
    return (a || location.origin).replace(/\/$/, '');
  }
  function getDeviceId(){
    let id = localStorage.getItem('gg_device_id');
    if (!id) { id = (Date.now().toString(36)+Math.random().toString(36).slice(2,10)).toUpperCase(); localStorage.setItem('gg_device_id', id); }
    return id;
  }
  async function fetchJSON(url, init){
    try{ const r = await fetch(url, init); const j = await r.json().catch(()=>({})); return { ok:r.ok, status:r.status, json:j }; }
    catch(e){ return { ok:false, status:0, json:null }; }
  }
  async function tryBind(api, path, body){
    const url = api + path;
    return await fetchJSON(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body });
  }
  async function run(){
    const api = baseApi();
    const me = await fetchJSON(api + '/api/me', { credentials:'include' });
    if (!me.ok || !me.json || !me.json.user) return;
    const provider = me.json.user.provider || null;
    const provider_user_id = me.json.user.provider_user_id || null;
    const payload = JSON.stringify({ provider, provider_user_id, device_id:getDeviceId() });

    // 1) основной маршрут
    let r = await tryBind(api, '/api/link/bind', payload);
    if (r.status === 404) {
      // 2) обратная совместимость
      r = await tryBind(api, '/api/bind', payload);
    }
    // не шумим в консоли — это фоновая операция
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else setTimeout(run, 0);
})();