// admin/admin-auth-headers.js
// Safe shim: auto-add X-Admin-Password to ALL /api/admin requests (absolute or relative)
// + глобальный переключатель HUM-склейки для всей админки.

(function () {
  function getApi() {
    const raw = (window.API || localStorage.getItem('ADMIN_API') || '').toString().trim();
    if (raw) return raw.replace(/\/+$/, ''); // убираем хвостовые /
    return location.origin;
  }

  function getPwd() {
    return (localStorage.getItem('ADMIN_PWD') || '').toString();
  }

  // Экспортируем хелпер, чтобы его могли использовать другие скрипты
  window.adminHeaders = function adminHeaders() {
    return { 'X-Admin-Password': getPwd() };
  };

  // --- Перехватываем fetch для /api/admin* ---
  const _fetch = (window.fetch || fetch).bind(window);

  window.fetch = function patchedFetch(input, init) {
    init = init || {};

    try {
      let urlStr = '';
      if (typeof input === 'string') {
        urlStr = input;
      } else if (input && typeof input.url === 'string') {
        urlStr = input.url;
      } else if (input && input.url != null) {
        urlStr = String(input.url);
      }

      const api = getApi();
      const relPrefix = '/api/admin';
      let isAdmin = false;

      if (urlStr) {
        const u = new URL(urlStr, location.href);
        // {API}/api/admin* или /api/admin* на том же origin
        if (
          (api && u.href.startsWith(api + relPrefix)) ||
          (u.origin === location.origin && u.pathname.startsWith(relPrefix))
        ) {
          isAdmin = true;
        }
      }

      if (isAdmin) {
        const h = new Headers(init.headers || {});
        if (!h.has('X-Admin-Password')) h.set('X-Admin-Password', getPwd());
        const obj = {};
        h.forEach((v, k) => {
          obj[k] = v;
        });
        init.headers = obj;
      }
    } catch (_) {}

    return _fetch(input, init);
  };

  // --- Глобальный флаг HUM-склейки ---

  const HUM_KEY = 'ADMIN_INCLUDE_HUM';

  function readHum() {
    try {
      const v = (localStorage.getItem(HUM_KEY) || '1').toString().toLowerCase();
      if (v === '0' || v === 'false' || v === 'no') return false;
      return true;
    } catch (_) {
      return true;
    }
  }

  function writeHum(val) {
    try {
      localStorage.setItem(HUM_KEY, val ? '1' : '0');
    } catch (_) {}
  }

  // Публичные функции, чтобы все скрипты админки читали один и тот же флаг
  window.getAdminHumFlag = function () {
    return readHum();
  };

  window.setAdminHumFlag = function (v) {
    const val = !!v;
    writeHum(val);
    try {
      window.dispatchEvent(new CustomEvent('adminHumToggle', { detail: { value: val } }));
    } catch (_) {}
  };

  // Синхронизация с переключателем HUM (если есть)
  // Поддерживаем и старую админку (#hum-toggle), и новую v2 (#admin-hum-flag).
  document.addEventListener('DOMContentLoaded', function () {
    const pairs = [
      { cb: document.getElementById('hum-toggle'), note: document.getElementById('hum-toggle-note') },
      { cb: document.getElementById('admin-hum-flag'), note: document.getElementById('admin-hum-note') },
    ].filter(p => p.cb);

    if (!pairs.length) return;

    function setNote(el, val){
      if (!el) return;
      el.textContent = val
        ? 'Показываем с учётом HUM-склейки'
        : 'Показываем по отдельным user_id';
    }

    function sync(val){
      pairs.forEach(p => {
        try { p.cb.checked = !!val; } catch(_){}
        setNote(p.note, !!val);
      });
    }

    // init
    sync(readHum());

    // change from UI
    pairs.forEach(p => {
      p.cb.addEventListener('change', function () {
        const val = !!p.cb.checked;
        sync(val);
        window.setAdminHumFlag(val);
      });
    });

    // change from code (adminHumToggle)
    window.addEventListener('adminHumToggle', function (ev) {
      try { sync(!!(ev && ev.detail && ev.detail.value)); } catch(_){}
    });
  });
})();