// admin/chart.js — V3.5 (две серии, подписи, MSK)
(function(){
  function api(){ return (localStorage.getItem('ADMIN_API') || window.API || '').replace(/\/+$/,''); }
  function headers(){ return window.adminHeaders ? window.adminHeaders() : {}; }
  const svg = document.getElementById('chart');
  if (!svg) return;

  function draw(days){
    const W = svg.clientWidth || 900;
    const H = svg.clientHeight || 300;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const totals = days.map(d => Number(d.auth_total ?? d.count ?? 0));
    const uniques= days.map(d => Number(d.auth_unique ?? d.unique ?? 0));
    const max = Math.max(1, ...totals, ...uniques);

    const padL=42, padB=26, top=8;
    const group = Math.max(20, (W - padL - 12) / Math.max(1, days.length));
    const bw = Math.max(8, (group - 6) / 2); // две колонки в группе

    // ось/сетка
    const axis = document.createElementNS('http://www.w3.org/2000/svg','line');
    axis.setAttribute('x1', padL); axis.setAttribute('y1', top);
    axis.setAttribute('x2', padL); axis.setAttribute('y2', H - padB);
    axis.setAttribute('stroke','#274260'); svg.appendChild(axis);
    for(let i=0;i<=4;i++){
      const y = top + (H-padB-top)*i/4;
      const ln = document.createElementNS('http://www.w3.org/2000/svg','line');
      ln.setAttribute('x1', padL); ln.setAttribute('y1', y);
      ln.setAttribute('x2', W-8);  ln.setAttribute('y2', y);
      ln.setAttribute('stroke', i===4?'#274260':'#173046');
      ln.setAttribute('stroke-dasharray', i===4?'0':'3 5');
      svg.appendChild(ln);

      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', 6); t.setAttribute('y', y+4);
      t.setAttribute('fill','#88a7d6'); t.setAttribute('font-size','11');
      t.textContent = Math.round(max*(1 - i/4));
      svg.appendChild(t);
    }

    days.forEach((d,i)=>{
      const gx = padL + 8 + i*group;
      const base = H - padB;

      const vt = Number(d.auth_total ?? d.count ?? 0);
      const vu = Number(d.auth_unique ?? d.unique ?? 0);
      const ht = (H-padB-top) * (vt/max);
      const hu = (H-padB-top) * (vu/max);

      // blue (total)
      const rt = document.createElementNS('http://www.w3.org/2000/svg','rect');
      rt.setAttribute('x', gx); rt.setAttribute('y', base-ht);
      rt.setAttribute('width', bw); rt.setAttribute('height', ht);
      rt.setAttribute('fill', '#4ea0ff'); svg.appendChild(rt);

      // label total
      const lt = document.createElementNS('http://www.w3.org/2000/svg','text');
      lt.setAttribute('x', gx + bw/2); lt.setAttribute('y', base-ht-4);
      lt.setAttribute('fill','#cfe3ff'); lt.setAttribute('font-size','11');
      lt.setAttribute('text-anchor','middle'); lt.textContent = vt; svg.appendChild(lt);

      // green (unique)
      const ru = document.createElementNS('http://www.w3.org/2000/svg','rect');
      ru.setAttribute('x', gx + bw + 6); ru.setAttribute('y', base-hu);
      ru.setAttribute('width', bw); ru.setAttribute('height', hu);
      ru.setAttribute('fill', '#39d98a'); svg.appendChild(ru);

      const lu = document.createElementNS('http://www.w3.org/2000/svg','text');
      lu.setAttribute('x', gx + bw + 6 + bw/2); lu.setAttribute('y', base-hu-4);
      lu.setAttribute('fill','#d6ffe8'); lu.setAttribute('font-size','11');
      lu.setAttribute('text-anchor','middle'); lu.textContent = vu; svg.appendChild(lu);

      // x label
      const tx = document.createElementNS('http://www.w3.org/2000/svg','text');
      tx.setAttribute('x', gx + bw); tx.setAttribute('y', H-8);
      tx.setAttribute('fill','#9fb4d9'); tx.setAttribute('font-size','11');
      tx.setAttribute('text-anchor','middle');
      tx.textContent = (d.date||'').slice(5);
      svg.appendChild(tx);
    });

    // легенда
    const leg = document.createElementNS('http://www.w3.org/2000/svg','g');
    const items=[['#4ea0ff','Авторизации'],['#39d98a','Уникальные HUM']];
    items.forEach((it,idx)=>{
      const x = padL + 10 + idx*150, y = 14;
      const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
      r.setAttribute('x', x); r.setAttribute('y', y-10);
      r.setAttribute('width', 14); r.setAttribute('height', 14);
      r.setAttribute('rx',3); r.setAttribute('fill', it[0]); leg.appendChild(r);
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', x+20); t.setAttribute('y', y+1);
      t.setAttribute('fill','#9fb4d9'); t.setAttribute('font-size','12');
      t.textContent = it[1]; leg.appendChild(t);
    });
    svg.appendChild(leg);
  }

  async function load(){
    const root = api(); if(!root) return;
    const r = await fetch(root + `/api/admin/daily?days=7&tz=Europe/Moscow`, { headers: headers(), cache:'no-store' });
    const j = await r.json().catch(()=>({}));
    const days = Array.isArray(j.days)? j.days :
                 Array.isArray(j.daily)? j.daily : [];
    draw(days);
  }
  load();
})();
