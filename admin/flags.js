// admin/flags.js — фичедетект флаг-эмодзи + безопасный вывод CC
(function () {
  // Быстрый тест: если вместо 🇩🇪 браузер отдаёт "de"/"DE", считаем что флаги не поддерживаются
  let FLAG_EMOJI_SUPPORTED = true;
  try {
    const test = document.createElement('span');
    test.style.cssText = 'position:fixed;left:-9999px;top:-9999px;text-transform:none;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif;';
    test.textContent = '🇩🇪';
    document.body.appendChild(test);
    const txt = (test.innerText || test.textContent || '').trim();
    if (/^[a-z]{2}$/i.test(txt)) FLAG_EMOJI_SUPPORTED = false;
    test.remove();
  } catch (_) { FLAG_EMOJI_SUPPORTED = false; }

  function ccToFlag(cc) {
    if (!cc) return '';
    const s = String(cc).trim().toUpperCase();
    if (s.length !== 2) return s;
    return s.replace(/./g, ch => String.fromCodePoint(0x1F1E6 + (ch.charCodeAt(0) - 65)));
  }

  // Подкрашиваем все элементы с [data-cc]
  function decorateFlags(root = document) {
    const nodes = root.querySelectorAll('[data-cc]');
    nodes.forEach(el => {
      const cc = (el.getAttribute('data-cc') || '').trim().toUpperCase();
      if (!cc) { el.textContent = ''; return; }

      if (FLAG_EMOJI_SUPPORTED) {
        const emoji = ccToFlag(cc);
        el.innerHTML =
          `<span class="flag-emoji" style="text-transform:none;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',system-ui,sans-serif">${emoji || ''}</span>` +
          ` <span class="cc" style="text-transform:none">${cc}</span>`;
      } else {
        // без флага — только код страны, ВЕРХНИМИ
        el.innerHTML = `<span class="cc" style="text-transform:none">${cc}</span>`;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => decorateFlags());
  } else {
    decorateFlags();
  }

  window.decorateFlags = decorateFlags;
})();
