// External hotfix for user-card page.
// Some builds call fmt$() but don't define it -> duels table crashes.
// We define fmtMoney + fmt$ as globals using `var` (creates a real global binding).

(function(){
  try {
    if (typeof window.fmtMoney !== 'function') {
      window.fmtMoney = function(n){
        const v = Number(n);
        if (!Number.isFinite(v)) return '—';
        return new Intl.NumberFormat('ru-RU').format(Math.trunc(v)) + ' ₽';
      };
    }
    if (typeof window.fmt$ !== 'function') {
      window.fmt$ = function(n){ return window.fmtMoney(n); };
    }
  } catch (e) {
    window.fmt$ = function(n){ return (n == null ? '—' : (String(n) + ' ₽')); };
  }
})();

// Create a true global identifier binding (works for both classic and module scripts)
var fmt$ = window.fmt$;
