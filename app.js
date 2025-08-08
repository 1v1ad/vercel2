function getApiBase(){return (window.API_BASE)||''}
const btn=document.getElementById('vk-login');const statusEl=document.getElementById('status');
btn?.addEventListener('click',async()=>{statusEl.textContent='Готовлю авторизацию…';btn.disabled=true;
 try{const r=await fetch(getApiBase()+'/api/auth/vk/init',{method:'POST',credentials:'include'});
 if(!r.ok) throw new Error('init failed'); const data=await r.json(); if(!data?.authUrl) throw new Error('bad payload');
 window.location.href=data.authUrl;}catch(e){console.error(e);statusEl.textContent='Не вышло стартовать авторизацию. Проверь бэкенд.';btn.disabled=false;}
});