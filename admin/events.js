
// admin/events.js — standalone loader for Events table
(function(){
  function getApi(){
    try{
      const v = (localStorage.getItem('admin_api') || '').trim();
      if (v) return v;
    }catch(_){}
    var el = document.getElementById('api-url');
    return (el && el.value || '').trim();
  }

  async function refreshEvents(){
    try{
      const API = getApi();
      if (!API){ console.warn('[events] no API url'); return; }
      const type = (document.getElementById('events-type')?.value || '').trim();
      const user = (document.getElementById('events-user')?.value || '').trim();

      const q = new URLSearchParams();
      if (type) q.set('term', type);
      if (user) q.set('user_id', user);
      const url = API + '/api/admin/events' + (q.toString() ? ('?' + q.toString()) : '');
      console.log('[events] GET', url);

      const r = await fetch(url, { headers: (typeof headers==='function'? headers() : {}), cache:'no-store' });
      if (!r.ok){ 
        const txt = await r.text().catch(()=>'');
        console.error('[events] HTTP', r.status, txt); 
        return; 
      }
      const data = await r.json().catch(()=>({}));
      const arr = Array.isArray(data.events) ? data.events : (Array.isArray(data.rows) ? data.rows : []);

      const tbody = document.getElementById('events-tbody');
      if (!tbody){ console.warn('[events] tbody not found'); return; }
      if (!arr.length){
        tbody.innerHTML = '<tr><td colspan="8" class="muted">Нет событий</td></tr>';
        return;
      }
      tbody.innerHTML = arr.map(e => `
        <tr>
          <td>${e.id ?? ''}</td>
          <td>${e.hum_id ?? ''}</td>
          <td>${e.user_id ?? ''}</td>
          <td>${e.event_type ?? e.type ?? ''}</td>
          <td>${e.type ?? ''}</td>
          <td>${e.ip ?? ''}</td>
          <td>${e.ua ? String(e.ua).slice(0,64) : ''}</td>
          <td>${(e.created_at || '').toString().slice(0,19).replace('T',' ')}</td>
        </tr>
      `).join('');
    }catch(err){
      console.error('[events] error', err);
    }
  }
  window.refreshEvents = refreshEvents;

  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('events-refresh');
    if (btn) btn.addEventListener('click', refreshEvents);
    if (document.getElementById('events-tbody')) refreshEvents();
  });
})();
