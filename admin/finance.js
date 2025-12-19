// admin/finance.js — лёгкая фин. аналитика (депозиты/обязательства/дуэли)
(function(){
  function apiBase(){
    return (localStorage.getItem('ADMIN_API') || '').toString().trim().replace(/\/+$/,'');
  }
  function headers(){
    return window.adminHeaders ? window.adminHeaders() : {};
  }

  function fmtInt(x){
    if (x == null) return '0';
    try{
      const s = String(x).trim();
      if (!s) return '0';
      // bigint-safe formatting
      const bi = BigInt(s);
      const sign = bi < 0n ? '-' : '';
      const abs = bi < 0n ? -bi : bi;
      const parts = abs.toString().split('');
      let out = '';
      for (let i = 0; i < parts.length; i++){
        const j = parts.length - i;
        out += parts[i];
        if (j > 1 && (j - 1) % 3 === 0) out += ' ';
      }
      return sign + out;
    }catch(_){
      const n = Number(x) || 0;
      return n.toLocaleString('ru-RU');
    }
  }

  async function refreshFinance(){
    const API = apiBase();
    if (!API) return;

    const ids = {
      dep: document.getElementById('fin-deposited'),
      liab: document.getElementById('fin-liabilities'),
      duels: document.getElementById('fin-duels'),
      turnover: document.getElementById('fin-turnover'),
      rake: document.getElementById('fin-rake'),
      rakePct: document.getElementById('fin-rake-pct'),
      note: document.getElementById('fin-note'),
    };

    try{
      const r = await fetch(API + '/api/admin/finance', { headers: headers(), cache:'no-store' });
      const j = await r.json().catch(()=>({}));
      if (!j || !j.ok) throw new Error(j && j.error || 'bad_response');

      const dep = j.totals?.deposited ?? '0';
      const liab = j.totals?.liabilities ?? '0';
      const games = j.duels?.games ?? '0';
      const turnover = j.duels?.turnover ?? '0';
      const rake = j.duels?.rake ?? '0';
      const rakePct = j.duels?.rake_pct ?? '0';

      if (ids.dep) ids.dep.textContent = fmtInt(dep);
      if (ids.liab) ids.liab.textContent = fmtInt(liab);
      if (ids.duels) ids.duels.textContent = fmtInt(games);
      if (ids.turnover) ids.turnover.textContent = fmtInt(turnover);
      if (ids.rake) ids.rake.textContent = fmtInt(rake);
      if (ids.rakePct) ids.rakePct.textContent = String(rakePct).replace('.', ',');

      if (ids.note) {
        // сейчас депозиты = admin_topup (ручные). Позже добавятся "deposit/withdraw" от платёжек.
        const w = j.totals?.withdrawn ?? '0';
        ids.note.textContent = `Депозиты считаем по событиям (admin_topup / deposit). Выводы: ${fmtInt(w)}.`;
      }
    }catch(e){
      console.error('[finance] error', e);
      if (ids.note) ids.note.textContent = 'Ошибка загрузки финансовых метрик';
    }
  }

  window.refreshFinance = refreshFinance;

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('fin-deposited')) refreshFinance();
  });

  // На переключение HUM — просто обновим (пусть будет единообразно)
  try{
    window.addEventListener('adminHumToggle', () => refreshFinance());
  }catch(_){}
})();
