// admin-topup-patch.js
(function(){
  const API = (localStorage.getItem('ADMIN_API') || 'https://vercel2pr.onrender.com').replace(/\/+$/,'');
  const adminPwd = localStorage.getItem('ADMIN_PWD') || localStorage.getItem('ADMIN_PASSWORD') || '';

  function badComment(s) {
    const t = (s||'').trim();
    if (t.length < 4) return true;
    if (/^\d+$/.test(t)) return true;
    const bad = ['test','тест','aaa','bbb','коммент','-', '—','111','123','1234'];
    return bad.includes(t.toLowerCase());
  }

  function findByPh(ph){
    return Array.from(document.querySelectorAll('input,textarea')).find(el => (el.placeholder||'').toLowerCase().includes(ph));
  }

  async function doTopup(uId, amount, comment){
    const r = await fetch(`${API}/api/admin/users/${uId}/topup`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Admin-Password': adminPwd
      },
      body: JSON.stringify({ amount: amount, comment })
    });
    const j = await r.json().catch(()=>({}));
    return { ok: !!(j && j.ok), j, status: r.status };
  }

  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button, input[type=button], input[type=submit]');
    if (!btn) return;
    const text = (btn.value || btn.textContent || '').trim().toLowerCase();
    if (!/пополнить вручную/.test(text)) return;

    e.preventDefault();
    const idInput = document.getElementById('topup-user')   || findByPh('user') || findByPh('id');
    const amtInput= document.getElementById('topup-amount') || findByPh('сумм') || findByPh('sum') || findByPh('amount');

    const uid = parseInt(idInput && idInput.value, 10);
    const amt = Number(amtInput && amtInput.value);

    if (!uid || !Number.isFinite(amt) || !amt) { alert('Укажи user_id и сумму'); return; }

    let cmt = prompt('Комментарий к пополнению (обязательно):', '');
    if (cmt == null) return;
    if (badComment(cmt)) { alert('Нужен осмысленный комментарий (не «111», «123», «test» и т.п.)'); return; }

    try{
      const {ok, j, status} = await doTopup(uid, amt, cmt);
      if (!ok) { alert('Ошибка' + (j && j.error ? `: ${j.error}` : '')); return; }
      alert('Готово!');
      try{ window.dispatchEvent(new Event('admin:topup:done')); }catch{}
    }catch(err){ alert('Ошибка сети'); }
  }, true);
})();
