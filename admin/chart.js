// admin/chart.js — V3.4
(function(){
  function api(){ return (localStorage.getItem('ADMIN_API') || window.API || '').replace(/\/+$/,''); }
  function headers(){ return window.adminHeaders ? window.adminHeaders() : {}; }

  const svg = document.getElementById('chart');
  if (!svg) return;

  function drawBars(days){
    const W = svg.clientWidth || svg.viewBox.baseVal.width || 900;
    const H = svg.clientHeight || svg.viewBox.baseVal.height || 300;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const vals = days.map(d => Number(d.count || d.auth_total || 0));
    const max  = Math.max(1, ...vals);
    const padL = 50, padB = 28;
    const barW = Math.max(10, (W - padL - 10) / Math.max(1, days.length) - 6);

    // ось Y
    const axis = document.createElementNS('http://www.w3.org/2000/svg','line');
    axis.setAttribute('x1', padL); axis.setAttribute('y1', 8);
    axis.setAttribute('x2', padL); axis.setAttribute('y2', H - padB);
    axis.setAttribute('stroke','#26435e'); svg.appendChild(axis);

    // сетка и подписи
    for (let i=0;i<=4;i++){
      const y = 8 + (H-padB-8) * i/4;
      const ln = document.createElementNS('http://www.w3.org/2000/svg','line');
      ln.setAttribute('x1', padL); ln.setAttribute('y1', y);
      ln.setAttribute('x2', W-8);  ln.setAttribute('y2', y);
      ln.setAttribute('stroke', i===4 ? '#26435e' : '#152434');
      ln.setAttribute('stroke-dasharray', i===4 ? '0' : '3 5');
      svg.appendChild(ln);

      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', 6); t.setAttribute('y', y+4);
      t.setAttribute('fill', '#87a7d6'); t.setAttribute('font-size','11');
      t.textContent = Math.round(max * (1 - i/4));
      svg.appendChild(t);
    }

    days.forEach((d, i) => {
      const v = Number(d.count || 0);
      const h = (H - padB - 10) * (v / max);
      const x = padL + 10 + i * (barW + 6);
      const y = (H - padB) - h;

      const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
      r.setAttribute('x', x); r.setAttribute('y', y);
      r.setAttribute('width', barW); r.setAttribute('height', h);
      r.setAttribute('fill', '#4ea0ff');
      svg.appendChild(r);

      const tt = document.createElementNS('http://www.w3.org/2000/svg','text');
      tt.setAttribute('x', x + barW/2); tt.setAttribute('y', H - 10);
      tt.setAttribute('fill','#9fb4d9'); tt.setAttribute('font-size','11');
      tt.setAttribute('text-anchor','middle');
      tt.textContent = (d.date || '').slice(5);
      svg.appendChild(tt);
    });
  }

  async function loadDaily(){
    const root = api(); if (!root) return;
    const url = root + `/api/admin/daily?days=7&tz=Europe/Moscow`;
    const r = await fetch(url, { headers: headers(), cache:'no-store' });
    const j = await r.json().catch(()=>({}));
    const days = Array.isArray(j.days) ? j.days : (Array.isArray(j.daily) ? j.daily : []);
    drawBars(days);
  }

  loadDaily();
})();
