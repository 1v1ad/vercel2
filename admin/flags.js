// admin/flags.js
(function(){
  function ccToFlag(cc){
    if(!cc) return '';
    const s = String(cc).trim().toUpperCase();
    if (s.length !== 2) return s; // оставим как есть (например, 'DE')
    // Преобразуем 'DE' -> '🇩🇪' через региональные индикаторы
    return s.replace(/./g, ch => String.fromCodePoint(0x1F1E6 + (ch.charCodeAt(0) - 65)));
  }

  // Сделаем доступным глобально (можно вызывать из шаблона)
  window.flagEmoji = ccToFlag;

  // Автоматический пост-процессор: все элементы с [data-cc] украшаем флагом.
  function decorateFlags(root=document){
    const nodes = root.querySelectorAll('[data-cc]');
    nodes.forEach(el => {
      const cc = el.getAttribute('data-cc') || '';
      const emoji = ccToFlag(cc);
      // если в ячейке уже есть код страны — заменим на флаг + код
      el.textContent = (emoji ? (emoji + ' ') : '') + cc;
    });
  }

  // дергаем при загрузке и экспортируем на всякий случай
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => decorateFlags());
  } else {
    decorateFlags();
  }
  window.decorateFlags = decorateFlags;
})();
