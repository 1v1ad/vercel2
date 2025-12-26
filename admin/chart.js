// admin/chart.js — V3.9 (grouped bars + value labels + HUM-toggle)
(function(){
  const svg = document.getElementById('chart'); if (!svg) return;
  const NS  = 'http://www.w3.org/2000/svg';

  const api = () => (localStorage.getItem('ADMIN_API') || window.API || '').replace(/\/+$/,'');
  const headers = () => (window.adminHeaders ? window.adminHeaders() : {});

  const labelDM = s =>
    (s && s.length >= 10)
      ? s.slice(0,10)
      : (s || '');

  function draw(days){
    const box = svg.getBoundingClientRect();
    const W = Math.max(320, box.width | 0);
    const H = Math.max(180, (svg.getAttribute('height')|0) || 260);

    const padL = 46;
    const padB = 28;
    const padT = 22;
    const headroom = 1.12;

    const innerGap = 8;   // расстояние между синим и зелёным внутри одного дня
    const outerGap = 12;  // отступы от краёв «дневной группы»

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const totals  = days.map(d => Number(d.auth_total  ?? d.count  ?? 0));
    const uniques = days.map(d => Number(d.auth_unique ?? d.unique ?? 0));

    const maxBase = Math.max(1, ...totals, ...uniques);
    const max     = Math.ceil(maxBase * headroom);

    const n            = Math.max(1, days.length);
    const chartWidth   = W - padL - 16;
    const groupWidth   = chartWidth / n;
    const barWidth     = (groupWidth - 2 * outerGap - innerGap) / 2;
    const chartBottomY = H - padB;

    const y = v =>
      chartBottomY - (v * (chartBottomY - padT) / max);

    // --- сетка и подписи по Y ---
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(max * i / 4);
      const yy  = y(val);

      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', padL);
      line.setAttribute('x2', W - 8);
      line.setAttribute('y1', yy);
      line.setAttribute('y2', yy);
      line.setAttribute('stroke', '#1b2737');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const label = document.createElementNS(NS, 'text');
      label.textContent = val;
      label.setAttribute('x', padL - 6);
      label.setAttribute('y', yy + 4);
      label.setAttribute('fill', '#8fa4c6');
      label.setAttribute('font-size', '11');
      label.setAttribute('text-anchor', 'end');
      svg.appendChild(label);
    }

    const blue  = '#0a84ff';
    const green = '#4ed1a9';

    // --- сами столбцы + цифры ---
    days.forEach((d, idx) => {
      const x0        = padL + idx * groupWidth + outerGap;
      const totalVal  = totals[idx];
      const uniqueVal = uniques[idx];

      const yTotal  = y(totalVal);
      const yUnique = y(uniqueVal);

      const bar1 = document.createElementNS(NS, 'rect');
      bar1.setAttribute('x', x0);
      bar1.setAttribute('y', yTotal);
      bar1.setAttribute('width', barWidth);
      bar1.setAttribute('height', Math.max(0, chartBottomY - yTotal));
      bar1.setAttribute('fill', blue);
      svg.appendChild(bar1);

      const bar2 = document.createElementNS(NS, 'rect');
      bar2.setAttribute('x', x0 + barWidth + innerGap);
      bar2.setAttribute('y', yUnique);
      bar2.setAttribute('width', barWidth);
      bar2.setAttribute('height', Math.max(0, chartBottomY - yUnique));
      bar2.setAttribute('fill', green);
      svg.appendChild(bar2);

      // подписи над столбцами (если значение > 0)
      const labelYMin = padT + 12; // чтобы не уплывали за верх

      if (totalVal > 0) {
        const t = document.createElementNS(NS, 'text');
        t.textContent = String(totalVal);
        t.setAttribute('x', x0 + barWidth / 2);
        t.setAttribute('y', Math.max(yTotal - 4, labelYMin));
        t.setAttribute('fill', '#e2ecff');
        t.setAttribute('font-size', '11');
        t.setAttribute('text-anchor', 'middle');
        svg.appendChild(t);
      }

      if (uniqueVal > 0) {
        const t2 = document.createElementNS(NS, 'text');
        t2.textContent = String(uniqueVal);
        t2.setAttribute('x', x0 + barWidth + innerGap + barWidth / 2);
        t2.setAttribute('y', Math.max(yUnique - 4, labelYMin));
        t2.setAttribute('fill', '#e2fff4');
        t2.setAttribute('font-size', '11');
        t2.setAttribute('text-anchor', 'middle');
        svg.appendChild(t2);
      }

      // подпись даты под группой
      const label = document.createElementNS(NS, 'text');
      label.textContent = labelDM(d.day || d.date || '');
      label.setAttribute('x', x0 + barWidth + innerGap / 2);
      label.setAttribute('y', H - 8);
      label.setAttribute('fill', '#8fa4c6');
      label.setAttribute('font-size', '11');
      label.setAttribute('text-anchor', 'middle');
      svg.appendChild(label);
    });

    // --- легенда ---
    const legendY = 0;
    const legendX = padL;

    const r1 = document.createElementNS(NS, 'rect');
    r1.setAttribute('x', legendX);
    r1.setAttribute('y', legendY);
    r1.setAttribute('width', 10);
    r1.setAttribute('height', 10);
    r1.setAttribute('fill', blue);
    svg.appendChild(r1);

    const t1 = document.createElementNS(NS, 'text');
    t1.textContent = 'Авторизации';
    t1.setAttribute('x', legendX + 16);
    t1.setAttribute('y', legendY + 9);
    t1.setAttribute('fill', '#a5c4f1');
    t1.setAttribute('font-size', '12');
    svg.appendChild(t1);

    const r2 = document.createElementNS(NS, 'rect');
    r2.setAttribute('x', legendX + 140);
    r2.setAttribute('y', legendY);
    r2.setAttribute('width', 10);
    r2.setAttribute('height', 10);
    r2.setAttribute('fill', green);
    svg.appendChild(r2);

    const t2 = document.createElementNS(NS, 'text');
    t2.textContent = 'Уникальные HUM';
    t2.setAttribute('x', legendX + 156);
    t2.setAttribute('y', legendY + 9);
    t2.setAttribute('fill', '#a5c4f1');
    t2.setAttribute('font-size', '12');
    svg.appendChild(t2);
  }

  async function load(){
    const root = api(); if (!root) return;
    const humFlag = window.getAdminHumFlag ? (window.getAdminHumFlag() ? 1 : 0) : 1;

    const r = await fetch(
      root + `/api/admin/daily?days=7&tz=Europe/Moscow&include_hum=${humFlag}`,
      { headers: headers(), cache:'no-store' }
    );

    const j = await r.json().catch(()=>({}));
    const days = Array.isArray(j.days) ? j.days : (Array.isArray(j.daily) ? j.daily : []);
    draw(days);
  }

  load();

  try {
    window.addEventListener('adminHumToggle', load);
    window.addEventListener('adminApiChanged', load);
  } catch (_) {}
})();
