// admin/admin-topup-patch.js — single top-up handler with required comment + logging
(() => {
  const API = (localStorage.getItem('ADMIN_API') || 'https://vercel2pr.onrender.com').replace(/\/+$/,'');
  const pwd = () => localStorage.getItem('ADMIN_PWD') || localStorage.getItem('ADMIN_PASSWORD') || '';

  const btn = document.querySelector('#admin-topup-btn') || document.querySelector('button#topup-btn-admin') || (()=>{
    const cands = Array.from(document.querySelectorAll('button, input[type="button"]'));
    return cands.find(b => /пополнить вручную/i.test(b.textContent||b.value||''));
  })();

  const inputUser = document.querySelector('#topup_user_id') || document.querySelector('input[name="topup_user_id"]');
  const inputAmount = document.querySelector('#topup_amount') || document.querySelector('input[name="topup_amount"]');

  if (!btn || !inputUser || !inputAmount) return;

  if (btn.__ggTopupBound) return;
  btn.__ggTopupBound = true;

  async function topupOnce() {
    const uid = parseInt((inputUser.value||'').trim(), 10);
    const amount = Math.round(Number((inputAmount.value||'').replace(',', '.')) || 0);

    if (!uid || amount <= 0) {
      alert('Ошибка: укажите user_id и сумму (положительное число).');
      return;
    }

    const comment = (prompt('Комментарий (обязательно):', '') || '').trim();
    if (!comment || /^\d{1,6}$/.test(comment) || comment.length < 3) {
      alert('Ошибка: комментарий обязателен и должен быть осмысленным.');
      return;
    }

    try {
      const r = await fetch(`${API}/api/admin/users/${uid}/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': pwd(),
        },
        body: JSON.stringify({ amount, comment })
      });
      const j = await r.json().catch(()=>({ ok:false, error:'bad_json' }));

      if (!j || !j.ok) {
        alert('Ошибка: ' + (j && j.error || r.status + ' ' + r.statusText));
        return;
      }

      alert('Готово!');
      if (typeof window.refreshUsers === 'function') window.refreshUsers();
      if (typeof window.reloadEvents === 'function') window.reloadEvents();
      if (typeof window.reloadSummary === 'function') window.reloadSummary();
    } catch (e) {
      alert('Ошибка сети: ' + (e && e.message || e));
    }
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    topupOnce();
  }, { capture: true });
})();
