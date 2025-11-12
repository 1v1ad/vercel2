/*! gg-linker.js v3 — background link with robust provider detection */
(function(){
  function api(){ return (window.API_BASE || localStorage.getItem('api_base') || '').toString().trim().replace(/\/+$/,''); }
  function getDeviceId(){
    try{
      let id = localStorage.getItem('device_id') || localStorage.getItem('gg_device_id');
      if (!id) { id = (crypto.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2))); }
      localStorage.setItem('device_id', id);
      document.cookie = 'device_id='+id+'; Path=/; Max-Age='+31536000+'; SameSite=Lax';
      return id;
    } catch(_){ return ''; }
  }
  function parseQuery(){
    const u = new URL(location.href);
    return Object.fromEntries(u.searchParams.entries());
  }
  async function json(url, init){
    try{ const r = await fetch(url, init); const j = await r.json().catch(()=>null); return {ok:r.ok,status:r.status,json:j}; }
    catch(_){ return {ok:false,status:0,json:null}; }
  }
  async function detectUser(){
    // 1) try backend /api/me
    const base = api(); if (!base) return null;
    let r = await json(base+'/api/me', { credentials:'include' });
    if (r.ok && r.json && r.json.ok && r.json.user && r.json.user.provider && r.json.user.provider_user_id) return r.json.user;

    // 2) fallback: read provider from URL (lobby.html?provider=vk&id=...)
    const q = parseQuery();
    if ((q.provider==='vk' || q.provider==='tg') && q.id) {
      return { provider:q.provider, provider_user_id:String(q.id) };
    }
    return null;
  }
  async function run(){
    try{
      const u = await detectUser(); if (!u) return;
      const body = JSON.stringify({ provider:u.provider, provider_user_id:u.provider_user_id, device_id:getDeviceId() });
      const base = api(); if (!base) return;
      await json(base + '/api/link/background', { method:'POST', headers:{'Content-Type':'application/json'}, body });
    }catch(_){}
  }
  if (document.readyState==='complete' || document.readyState==='interactive') setTimeout(run, 300);
  else document.addEventListener('DOMContentLoaded', ()=>setTimeout(run,300));
})();