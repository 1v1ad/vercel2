// Жёстко снимаем любые старые слушатели с кнопки пополнения и вешаем редирект на /admin/topup.html
(function () {
  function $(s){ return document.querySelector(s); }
  function pickBtn(){
    // набор селекторов, первый найденный пойдёт в работу
    const sels = [
      '#topup-run', '#btnManualTopup', '#btnTopup',
      '[data-action="manual-topup"]'
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    // последняя попытка — ищем по тексту
    const candidates = Array.from(document.querySelectorAll('button,.btn'));
    return candidates.find(el => /попол(нить|нение)/i.test(el.textContent||''));
  }

  function run(){
    let btn = pickBtn();
    if (!btn || btn.dataset._wired) return;

    // Отрезаем все старые слушатели одним ударом
    const clone = btn.cloneNode(true);
    clone.type = 'button'; // чтобы форма (если есть) не отправлялась
    btn.replaceWith(clone);
    btn = clone;

    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      // пытаемся забрать текущее API/пароль из полей админки
      const api = (document.getElementById('apiBase')?.value || localStorage.getItem('admin_api') || '').trim();
      const pwd = (document.getElementById('adminPassword')?.value || localStorage.getItem('admin_pwd') || '').trim();
      const uid = (document.getElementById('topup-user-id')?.value || '').trim();

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
