// admin/merge-suggest.js
(function(){
  const box = document.createElement('div');
  box.style.position='fixed'; box.style.right='16px'; box.style.bottom='112px';
  box.style.zIndex=9999; box.style.padding='10px 12px'; box.style.minWidth='260px';
  box.style.background='#101522'; box.style.border='1px solid rgba(255,255,255,.08)'; box.style.borderRadius='12px'; box.style.color='#e8eaf0';
  box.innerHTML = '<b>Склейка: предложения</b><div id="msg" style="margin-top:6px">загрузка…</div><div id="mlist" style="max-height:180px; overflow:auto; margin-top:6px"></div><div style="margin-top:8px; display:flex; gap:8px; justify-content:flex-end"><button id="mrun">Склеить все</button></div>';
  document.addEventListener('DOMContentLoaded', ()=>document.body.appendChild(box));

  function getAPI(){ return (document.querySelector('#apiBase')?.value || localStorage.getItem('admin.api') || '').trim(); }
  function getPWD(){ return (document.querySelector('input[type="password"]')?.value || localStorage.getItem('admin.pwd') || '').trim(); }

  async function load(){
    const API = getAPI(), PWD = getPWD();
    if(!API || !PWD){ document.getElementById('msg').textContent='Укажи API и пароль сверху'; return; }
    const r = await fetch(API + '/api/admin/users/merge/suggestions', { headers: { 'X-Admin-Password': PWD }, credentials:'include' });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || !j.ok){ document.getElementById('msg').textContent='нет предложений'; return; }
    document.getElementById('msg').textContent = 'Предложений: ' + j.list.length;
    const list = document.getElementById('mlist'); list.innerHTML='';
    j.list.forEach(p => {
      const el = document.createElement('div');
      el.textContent = '#' + p.secondary_id + ' → #' + p.primary_id;
      list.appendChild(el);
    });
    document.getElementById('mrun').onclick = async () => {
      for (const p of j.list) {
        await fetch(API + '/api/admin/users/merge', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'X-Admin-Password': PWD },
          body: JSON.stringify({ primary_id: p.primary_id, secondary_id: p.secondary_id }),
          credentials:'include'
        });
      }
      alert('Готово. Обнови таблицу.');
    };
  }

  document.addEventListener('DOMContentLoaded', ()=> setTimeout(load, 500));
})();
