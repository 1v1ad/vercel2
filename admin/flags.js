// admin/flags.js
(function () {
  function ccToFlag(cc) {
    if (!cc) return "";
    const s = String(cc).trim().toUpperCase();
    if (s.length !== 2) return s; // если это не ISO2 — оставим как есть
    // 'DE' -> '🇩' + '🇪' (Regional Indicator Symbols)
    return s.replace(/./g, ch => String.fromCodePoint(0x1F1E6 + (ch.charCodeAt(0) - 65)));
  }

  // украшает все элементы с [data-cc] внутри root (по умолчанию document)
  function decorateFlags(root = document) {
    const nodes = root.querySelectorAll("[data-cc]");
    nodes.forEach(el => {
      const cc = (el.getAttribute("data-cc") || "").trim().toUpperCase();
      if (!cc) { el.textContent = ""; return; }

      const emoji = ccToFlag(cc);
      // ВАЖНО: inline-стили выключают любые transform у предков
      el.innerHTML =
        `<span class="flag-emoji" style="text-transform:none; font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',system-ui,sans-serif">${emoji || ""}</span>` +
        ` <span class="cc" style="text-transform:none">${cc}</span>`;
    });
  }

  // первый прогон
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => decorateFlags());
  } else {
    decorateFlags();
  }

  // экспортируем, чтобы вызывать после динамического рендера
  window.decorateFlags = decorateFlags;
})();
