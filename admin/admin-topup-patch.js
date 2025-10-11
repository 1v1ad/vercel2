<script>
/**
 * FEAT: admin_topup_redirect_safely
 * WHY:  не светим пароль в URL; открываем topup в новой вкладке; передаём pwd через sessionStorage
 * DATE: 2025-10-11
 */
(function () {
  function pickBtn() {
    const sels = [
      '#topup-run', '#btnManualTopup', '#btnTopup',
      '[data-action="manual-topup"]'
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    const candidates = Array.from(document.querySelectorAll('button,.btn'));
    return candidates.find(el => /попол(нить|нение)/i.test(el.textContent || ''));
  }
  function val(id) { return (document.getElementById(id)?.value || '').trim(); }

  function run() {
    let btn = pickBtn();
    if (!btn || btn.dataset._wired) return;

    const clone = btn.cloneNode(true);
    clone.type = 'button';
    btn.replaceWith(clone);
    btn = clone;

    btn.addEventListener('click', (e) => {
      e.preventDefault();

      const api = val('apiBase') || localStorage.getItem('admin_api') || '';
      const pwd = val('adminPassword') || localStorage.getItem('admin_pwd') || '';
      const uid = val('topup-user-id') || '';

      // пароль кладём в sessionStorage (живёт до закрытия вкладки)
      try { if (pwd) sessionStorage.setItem('admin_pwd', pwd); } catch {}

      const p = new URLSearchParams();
      if (uid) p.set('user_id', uid);
      if (api) p.set('api', api);

      const url = '/admin/topup.html' + (p.toString() ? ('?' + p.toString()) : '');
      // открываем в новой вкладке; не даём доступ к opener
      window.open(url, '_blank', 'noopener');
    });

    btn.dataset._wired = '1';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
</script>
