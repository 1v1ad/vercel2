// admin/chart-range.js — линейный график по произвольному диапазону дат
// Цвета: всего (Total) — СИНИЙ, уникальные (Unique) — ЗЕЛЁНЫЙ.
// Поддержка hover: вертикальная линия, точки и тултип (дата + значения).

(function(){
  const SVG = document.getElementById('chart-range');
  if (!SVG) return;

  const fromEl = document.getElementById('range-from');
  const toEl   = document.getElementById('range-to');
  const noteEl = document.getElementById('range-note');
  const includeHumEl = document.getElementById('range-include-hum');
  const applyBtn = document.getElementById('range-apply');

  let lastPreset = null; // 'all' | number | null

  // ===== helpers =====
  function apiBase(){
    return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,'');
  }
  function headers(){
    return window.adminHeaders ? window.adminHeaders() : {};
  }
  function today(tz){
    const d = new Date();
    if (!tz) return d.toISOString().slice(0,10);
    try{
      const s = d.toLocaleString('en-CA',{ timeZone:tz, year:'numeric', month:'2-digit', day:'2-digit' });
      return s.slice(0,10);
    }catch(_){
      return d.toISOString().slice(0,10);
    }
  }
  function addDays(iso, delta){
    const d = new Date(iso+'T00:00:00Z');
    d.setUTCDate(d.getUTCDate()+delta);
    return d.toISOString().slice(0,10);
  }

  function clearSvg(){
    while (SVG.firstChild) SVG.removeChild(SVG.firstChild);
  }

  function elt(tag, attrs, text){
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text!=null) el.textContent = text;
    return el;
  }

  // ===== запрос и отрисовка =====
  async function run(){
    const API = apiBase();
    if (!API) return;

    const qs = new URLSearchParams({ tz:'Europe/Moscow' });
    if (fromEl.value) qs.set('from', fromEl.value);
    if (toEl.value)   qs.set('to',   toEl.value);
    if (includeHumEl) qs.set('include_hum', includeHumEl.checked ? '1' : '0');
    if (lastPreset === 'all') qs.set('preset', 'all');

    const r = await fetch(API + '/api/admin/range?' + qs.toString(), { headers: headers(), cache:'no-store' });
    const j = await r.json().catch(()=>({}));
    if (!j || !j.ok || !Array.isArray(j.days)) {
      draw([], []);
      noteEl.textContent = 'Нет данных';
      return;
    }

    const days = j.days;
    const xDates = days.map(d=>d.date);
    const total = days.map(d=>Number(d.total)||0);
    const unique = days.map(d=>Number(d.unique)||0);

    draw(total, unique, xDates);

    if (days.length) {
      const first = days[0].date;
      const last  = days[days.length-1].date;
      noteEl.textContent = `Показано ${days.length} дней: ${first} — ${last}`;
    } else {
      noteEl.textContent = 'Нет данных';
    }
  }

  function draw(total, unique, xDates){
    clearSvg();
    const W = Number(SVG.getAttribute('width') || 600);
    const H = Number(SVG.getAttribute('height')|| 240);
    const padLeft   = 40;
    const padRight  = 12;
    const padTop    = 10;
    const padBottom = 26;

    const n = total.length;
    if (!n) {
      noteEl.textContent = 'Нет данных';
      return;
    }

    const maxY = Math.max(
      1,
      Math.max(...total),
      Math.max(...unique)
    );

    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    const scaleX = (i)=> padLeft + (n<=1? plotW/2 : (i*(plotW/(n-1))));
    const scaleY = (v)=> padTop + (maxY===0 ? plotH : plotH - (v/maxY)*plotH);

    // фон и оси
    SVG.appendChild(elt('rect',{x:0,y:0,width:W,height:H,fill:'transparent'}));
    SVG.appendChild(elt('line',{x1:padLeft,y1:padTop,x2:padLeft,y2:H-padBottom,stroke:'#23324a','stroke-width':1}));
    SVG.appendChild(elt('line',{x1:padLeft,y1:H-padBottom,x2:W-padRight,y2:H-padBottom,stroke:'#23324a','stroke-width':1}));

    // горизонтальные линии
    const gridSteps = 4;
    for (let i=1;i<=gridSteps;i++){
      const v = (maxY/gridSteps)*i;
      const y = scaleY(v);
      SVG.appendChild(elt('line',{
        x1:padLeft, y1:y, x2:W-padRight, y2:y,
        stroke:'#1b2738', 'stroke-width':1, 'stroke-dasharray':'3 3'
      }));
      SVG.appendChild(elt('text',{
        x:padLeft-4, y:y+4, 'text-anchor':'end', fill:'#8fa4c6','font-size':'10'
      }, String(Math.round(v))));
    }

    // ось X: 6 меток
    const ticks = Math.min(6, Math.max(2, n));
    for (let i=0;i<ticks;i++){
      const idx = Math.round(i*(n-1)/(ticks-1));
      const x = scaleX(idx);
      const lbl = elt('text',{
        x,
        y:H-6,
        fill:'#8fa4c6',
        'font-size':'10',
        'text-anchor': (i===0 ? 'start' : (i===ticks-1 ? 'end' : 'middle'))
      }, xDates[idx] || '');
      SVG.appendChild(lbl);
    }

    // путь из массива
    function pathFor(arr){
      let d = '';
      for (let i=0;i<n;i++){
        const x = scaleX(i);
        const y = scaleY(arr[i]||0);
        d += (i===0 ? 'M' : 'L') + x + ' ' + y + ' ';
      }
      return d;
    }

    // линии
    const totalPath  = elt('path',{ d:pathFor(total),  fill:'none', stroke:'#4b7bec','stroke-width':2 });
    const uniquePath = elt('path',{ d:pathFor(unique), fill:'none', stroke:'#20bf6b','stroke-width':2 });
    SVG.appendChild(totalPath);
    SVG.appendChild(uniquePath);

    // точки
    function drawDots(arr, color){
      for (let i=0;i<n;i++){
        const x = scaleX(i);
        const y = scaleY(arr[i]||0);
        SVG.appendChild(elt('circle',{cx:x,cy:y,r:3,fill:color,stroke:'#0b1020','stroke-width':1}));
      }
    }
    drawDots(total,'#4b7bec');
    drawDots(unique,'#20bf6b');

    // hover: вертикальная линия + тултип
    const hoverLine = elt('line',{
      x1:0,y1:padTop,x2:0,y2:H-padBottom,
      stroke:'#ffffff22','stroke-width':1,visibility:'hidden'
    });
    SVG.appendChild(hoverLine);

    const tooltipBg = elt('rect',{
      x:0,y:0,width:140,height:44,rx:6,ry:6,
      fill:'#02040a',stroke:'#23324a','stroke-width':1,visibility:'hidden'
    });
    const tooltipDate = elt('text',{x:0,y:0,fill:'#e8ecf7','font-size':'11',visibility:'hidden'});
    const tooltipTotal = elt('text',{x:0,y:0,fill:'#4b7bec','font-size':'11',visibility:'hidden'});
    const tooltipUnique = elt('text',{x:0,y:0,fill:'#20bf6b','font-size':'11',visibility:'hidden'});

    SVG.appendChild(tooltipBg);
    SVG.appendChild(tooltipDate);
    SVG.appendChild(tooltipTotal);
    SVG.appendChild(tooltipUnique);

    function showTooltip(i, clientX){
      if (i<0 || i>=n) return;
      const x = scaleX(i);
      hoverLine.setAttribute('x1', x);
      hoverLine.setAttribute('x2', x);
      hoverLine.setAttribute('visibility','visible');

      const date = xDates[i] || '';
      const t = total[i] || 0;
      const u = unique[i] || 0;

      tooltipDate.textContent = date;
      tooltipTotal.textContent = 'Всего: ' + t;
      tooltipUnique.textContent = 'Уникальных: ' + u;

      const pad = 8;
      const ttWidth = 150;
      let ttX = x + 10;
      if (ttX + ttWidth > W) ttX = x - ttWidth - 10;
      const ttY = padTop + 10;

      tooltipBg.setAttribute('x', ttX);
      tooltipBg.setAttribute('y', ttY);
      tooltipDate.setAttribute('x', ttX + pad);
      tooltipDate.setAttribute('y', ttY + 14);
      tooltipTotal.setAttribute('x', ttX + pad);
      tooltipTotal.setAttribute('y', ttY + 28);
      tooltipUnique.setAttribute('x', ttX + pad);
      tooltipUnique.setAttribute('y', ttY + 42);

      tooltipBg.setAttribute('visibility','visible');
      tooltipDate.setAttribute('visibility','visible');
      tooltipTotal.setAttribute('visibility','visible');
      tooltipUnique.setAttribute('visibility','visible');
    }

    function hideTooltip(){
      hoverLine.setAttribute('visibility','hidden');
      tooltipBg.setAttribute('visibility','hidden');
      tooltipDate.setAttribute('visibility','hidden');
      tooltipTotal.setAttribute('visibility','hidden');
      tooltipUnique.setAttribute('visibility','hidden');
    }

    SVG.addEventListener('mousemove', (ev)=>{
      const rect = SVG.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const rel = (x - padLeft) / (W - padLeft - padRight);
      const idx = Math.round(rel * (n-1));
      showTooltip(idx, ev.clientX);
    });
    SVG.addEventListener('mouseleave', hideTooltip);
  }

  // пресеты
  document.querySelectorAll('[data-preset]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = btn.getAttribute('data-preset');
      if (p === 'all') {
        lastPreset = 'all';
        fromEl.value = '';
        toEl.value   = '';
        run();
      } else {
        const days = Number(p) || 0;
        lastPreset = days || null;
        setPreset(days);
      }
    });
  });
  applyBtn?.addEventListener('click', run);
  includeHumEl?.addEventListener('change', run);
  fromEl?.addEventListener('change', ()=>{
    if (toEl.value && fromEl.value>toEl.value) toEl.value=fromEl.value;
  });
  toEl?.addEventListener('change',   ()=>{
    if (fromEl.value && toEl.value<fromEl.value) fromEl.value=toEl.value;
  });

  function setPreset(days){
    const tz='Europe/Moscow';
    const t = today(tz);
    fromEl.value = addDays(t, -days);
    toEl.value   = t;
    run();
  }

  // старт: 30 дней
  (function init(){
    const tz='Europe/Moscow';
    const t = today(tz);
    fromEl.value = addDays(t, -30);
    toEl.value   = t;
    run();
  })();
})();
