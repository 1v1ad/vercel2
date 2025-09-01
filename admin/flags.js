// admin/flags.js
(function () {
  function ccToFlag(cc) {
    if (!cc) return '';
    const s = String(cc).trim().toUpperCase();
    if (s.length !== 2) return s; // если это не ISO2 — оставим как есть
    // 'DE' -> '🇩' + '🇪'
    return s.replace(/./g, ch => String.fromCodePoint(0x1F1E6 + (ch.charCodeAt(0) - 65)));
  }

  // доступно глобально при желании
  window.flagEmoji = ccToFlag;

  // украшает все элементы с [data-cc] внутри root (по умолчанию document)
  function decorateFlags(root = document) {
    const nodes = root.querySelectorAll('[data-cc]');
    nodes.forEach(el => {
      const cc = (el.getAttribute('data-cc') || '').trim().toUpperCase();
      if (!cc) { el.textContent = ''; return; }
      const emoji = ccToFlag(cc);
      el.textContent = (emoji ? (emoji + ' ') : '') + cc;
    });
  }

  // первый прогон — если разметка уже есть
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => decorateFlags());
  } else {
    decorateFlags();
  }

  // экспортируем, чтобы вызывать после динамического рендера
  window.decorateFlags = decorateFlags;
})();
