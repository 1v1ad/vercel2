// admin/flags.js — стабильные флаги: без эмодзи на Windows/без поддержки
(function () {
  // 1) Грубый детект платформы
  const IS_WINDOWS = /windows/i.test(navigator.userAgent || '');

  // 2) Замер рендеринга: если 🇩🇪 рисуется как две буквы, ширина ~ "DE"
  function isFlagEmojiUnsupportedByWidth() {
    try {
      const probeWrap = document.createElement('div');
      probeWrap.style.cssText = 'position:fixed;left:-10000px;top:-10000px;';
      const mk = (txt) => {
        const s = document.createElement('span');
        s.style.cssText =
          'font-size:16px; line-height:1; white-space:nowrap; ' +
          'text-transform:none; ' +
          'font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif;';
        s.textContent = txt;
        return s;
      };
      const sFlag = mk('🇩🇪');
      const sDE   = mk('DE');
      probeWrap.appendChild(sFlag);
      probeWrap.appendChild(sDE);
      document.body.appendChild(probeWrap);
      const wFlag = sFlag.getBoundingClientRect().width;
      const wDE   = sDE.getBoundingClientRect().width;
      probeWrap.remove();

      // если почти как "DE", считаем, что это не цветной флаг
      return Math.abs(wFlag - wDE) < 2; // порог в пикселях
    } catch (_) {
      return true; // на всякий случай: считаем "не поддерживается"
    }
  }

  const FLAG_EMOJI_SUPPORTED = !IS_WINDOWS && !isFlagEmojiUnsupportedByWidth();


  function ccToFlagImg(cc) {
    if (!cc) return '';
    const s = String(cc).trim().toLowerCase();
    if (s.length !== 2) return '';
    const url = `https://flagcdn.com/24x18/${s}.png`;
    return `<img src="${url}" alt="${cc}" loading="lazy" class="flag-img">`;
  }

  function ccToFlag(cc) {
    if (!cc) return '';
    const s = String(cc).trim().toUpperCase();
    if (s.length !== 2) return s;
    return s.replace(/./g, ch => String.fromCodePoint(0x1F1E6 + (ch.charCodeAt(0) - 65)));
  }

  function decorateFlags(root = document) {
    const nodes = root.querySelectorAll('[data-cc]');
    nodes.forEach(el => {
      const cc = (el.getAttribute('data-cc') || '').trim().toUpperCase();
      if (!cc) { el.textContent = ''; return; }

      const imgHtml = ccToFlagImg(cc);
      if (imgHtml) {
        el.innerHTML = imgHtml + ` <span class="cc" style="text-transform:none">${cc}</span>`;
      } else if (FLAG_EMOJI_SUPPORTED) {
        const emoji = ccToFlag(cc);
        el.innerHTML =
          `<span class="flag-emoji" style="text-transform:none;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',system-ui,sans-serif">${emoji || ''}</span>` +
          ` <span class="cc" style="text-transform:none">${cc}</span>`;
      } else {
        // fallback: только код страны
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
