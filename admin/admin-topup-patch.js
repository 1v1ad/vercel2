// Жёсткая очистка обработчиков: клонируем кнопку, чтобы снять старые слушатели, и вешаем только наш редирект.
(function () {
  function $(s){ return document.querySelector(s); }
  function val(el){ return (el && el.value || '').trim(); }

  function run(){
    let btn = $('#btnManualTopup') || document.getElementById('btnTopup') || document.querySelector('[data-action="manual-topup"]');
    if (!btn || btn.dataset._wired) return;

    // replaceWith clone — срубает все старые слушатели
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
    btn = clone;

    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();

      const uid = val($('#manualTopupUserId')) || val($('#topupUserId')) || val($('#user_id')) || '';
      const api = val($('#apiHost')) || val($('#api')) || localStorage.getItem('admin_api') || '';
      const pwd = val($('#adminPassword')) || val($('#adminPwd')) || val($('#pwd')) || localStorage.getItem('admin_pwd') || '';

      const p = new URLSearchParams();
      if (uid) p.set('user_id', uid);
      if (api) p.set('api', api);
      if (pwd) p.set('pwd', pwd);

      location.href = '/admin/topup.html' + (p.toString() ? ('?' + p.toString()) : '');
    });

    btn.dataset._wired = '1';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
