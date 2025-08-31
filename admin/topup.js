
/**
 * admin/topup.js — unobtrusive add-on for manual topups
 */
(function(){
  const lsKeys = { api:['admin.api','apiBase','ggroom_api'], pwd:['admin.pwd','adminPass','ggroom_admin_password'] };
  function findInputByPlaceholder(ph){ const all=document.querySelectorAll('input'); for(const el of all){ if((el.placeholder||'').includes(ph)) return el; } return null; }
  function getApiBase(){
    const candidates=[document.querySelector('#apiBase'), document.querySelector('input[name="apiBase"]'), findInputByPlaceholder('onrender.com')];
    for(const el of candidates) if(el && el.value) return el.value.trim();
    for(const k of lsKeys.api){ const v=localStorage.getItem(k); if(v) return v; }
    return window.prompt('Укажи API URL (например, https://vercel2pr.onrender.com)') || '';
  }
  function getAdminPassword(){
    const candidates=[document.querySelector('#adminPassword'), document.querySelector('input[type="password"]'), document.querySelector('input[name="adminPassword"]')];
    for(const el of candidates) if(el && el.value) return el.value;
    for(const k of lsKeys.pwd){ const v=localStorage.getItem(k); if(v) return v; }
    return window.prompt('Введи X-Admin-Password') || '';
  }
  async function topupUser(userId, amount, reason){
    const API=getApiBase(), ADMIN=getAdminPassword();
    if(!API || !ADMIN){ alert('Не задан API или пароль'); return; }
    const r=await fetch(`${API}/api/admin/users/${userId}/topup`, { method:'POST', headers:{ 'Content-Type':'application/json', 'X-Admin-Password': ADMIN }, body: JSON.stringify({ amount: parseInt(amount,10), reason: reason||'manual' }), credentials:'include' });
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.ok) throw new Error(j.error || 'request_failed');
    return j.user;
  }
  function addFloatingButton(){
    const btn=document.createElement('button');
    btn.textContent='Пополнить вручную';
    Object.assign(btn.style,{ position:'fixed', right:'16px', bottom:'16px', zIndex:9999, padding:'10px 14px', borderRadius:'10px', background:'#2b7a0b', color:'#fff', border:'none', boxShadow:'0 4px 16px rgba(0,0,0,.3)' });
    btn.onclick=async()=>{
      try{
        const id=window.prompt('ID пользователя (число):'); if(!id) return;
        const amt=window.prompt('Сумма (целое, можно отрицательное):','1500'); if(!amt) return;
        const reason=window.prompt('Описание/причина:','owner test');
        const u=await topupUser(parseInt(id,10), parseInt(amt,10), reason);
        alert(`Готово. Новый баланс пользователя #${u.id}: ${u.balance}`);
        try{ refreshUsers && refreshUsers(); }catch(_){}
      }catch(e){ alert('Ошибка: '+e.message); }
    };
    document.body.appendChild(btn);
  }
  function enhanceUsersTable(){
    const tbl=document.querySelector('table'); if(!tbl) return;
    const rows=tbl.querySelectorAll('tbody tr');
    rows.forEach(tr=>{
      const idCell=tr.children?.[0];
      const balCell=tr.children?.[5] || tr.querySelector('[data-col="balance"]');
      const id=idCell ? parseInt(idCell.textContent.trim(),10) : null;
      if(!id || tr.querySelector('.btn-topup')) return;
      const holder=tr.querySelector('td:last-child') || tr;
      const btn=document.createElement('button');
      btn.textContent='💳'; btn.title='Пополнить этому пользователю'; btn.className='btn-topup'; btn.style.marginLeft='8px';
      btn.onclick=async(e)=>{ e.stopPropagation(); const amt=window.prompt(`Сколько начислить пользователю #${id}?`,'1500'); if(!amt) return;
        try{ const u=await topupUser(id, parseInt(amt,10), 'row button'); if(balCell) balCell.textContent=String(u.balance); }catch(e){ alert('Ошибка: '+e.message); } };
      holder.appendChild(btn);
    });
  }
  document.addEventListener('DOMContentLoaded', ()=>{ try{ addFloatingButton(); }catch{} try{ enhanceUsersTable(); }catch{} });
})();
