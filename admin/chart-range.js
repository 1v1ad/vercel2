// admin/chart-range.js — range chart with optional analytics and explicit admin header
(async function(){
  const el = (id) => document.getElementById(id);
  function API(){ return (localStorage.getItem('ADMIN_API') || window.API || location.origin).replace(/\/$/,''); }
  function PWD(){ return (localStorage.getItem('ADMIN_PWD') || '').toString(); }

  async function loadRange(){
    const tz='Europe/Moscow';
    const from = el('range-from').value;
    const to   = el('range-to').value;
    const qs = new URLSearchParams({ tz, from, to });
    const chk = document.getElementById('range-analytics');
    if (chk && chk.checked) qs.set('analytics','1');

    const headers = { 'X-Admin-Password': PWD() };
    let resp; try {
      resp = await fetch(API() + '/api/admin/range?' + qs.toString(), { headers, cache:'no-store' });
    } catch(_){ return; }
    if (!resp.ok) return;

    const j = await resp.json().catch(()=>null);
    if (!j || !j.ok || !Array.isArray(j.days)) return;

    const labels = j.days.map(d => d.day);
    const sTotal = j.days.map(d => Number(d.auth_total || 0));
    const sUnique = j.days.map(d => Number((d.auth_unique_analytics ?? d.auth_unique) || 0));

    // draw or update
    const ctx = el('chart-range');
    if (!ctx) return;
    if (window._rangeChart) window._rangeChart.destroy();
    window._rangeChart = new Chart(ctx, {
      type: 'bar',
      data: { labels,
        datasets: [
          { label:'Всего авторизаций', data:sTotal },
          { label:'Уникальные', data:sUnique }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false }
    });
  }

  // Bind UI
  const btn = el('range-apply');
  if (btn) btn.addEventListener('click', loadRange);
  // auto-load on start
  if (document.readyState === 'complete') loadRange();
  else window.addEventListener('load', loadRange);
})();