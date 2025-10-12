// admin/chart-range.js — линейный график по произвольному диапазону дат
(function(){
  const SVG = document.getElementById('chart-range');
  if (!SVG) return;

  const fromEl = document.getElementById('range-from');
  const toEl   = document.getElementById('range-to');
  const noteEl = document.getElementById('range-note');
  const applyBtn = document.getElementById('range-apply');

  // ===== helpers =====
  function apiBase(){
    return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,'');
  }
  function headers(){
    return window.adminHeaders ? window.adminHeaders() : {};
  }
  function today(tz){
    // Возвращаем YYYY-MM-DD в TZ
    const d = new Date();
    const fmt = new Intl.DateTimeFormat('sv-SE',{ timeZone: tz||'Europe/Moscow', year:'numeric',month:'2-digit',day:'2-digit' });
    return fmt.format(d);
  }
  function addDays(iso, delta){
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0,10);
  }
  function setPreset(days){
    const tz='Europe/Moscow';
    const t = today(tz);
    fromEl.value = addDays(t, -Number(days));
    toEl.value   = t;
    run();
  }

  // ===== fetch & draw =====
  async function run(){
    const API = apiBase();
    if (!API) return;

    const qs = new URLSearchParams({ tz:'Europe/Moscow' });
    if (fromEl.value) qs.set('from', fromEl.value);
    if (toEl.value)   qs.set('to',   toEl.value);

    const r = await fetch(API + '/api/admin/range?' + qs.toString(), { headers: headers(), cache:'no-store' });
    const j = await r.json().catch(()=>({}));
    if (!j || !j.ok || !Array.isArray(j.days)) {
      draw([], []);
      noteEl.textContent = 'Нет данных';
      return;
    }

    const xs = j.days.map(d => d.date || d.day);
    const sTotal  = j.days.map(d => Number(d.auth_total  || 0));
    const sUnique = j.days.map(d => Number(d.auth_unique || 0));
    drawLine(xs, sTotal, sUnique);
    noteEl.textContent = `Период: ${j.from} – ${j.to} • дней: ${j.days.length}`;
  }

  function drawLine(xDates, yTotal, yUnique){
    // очистка
    while (SVG.firstChild) SVG.removeChild(SVG.firstChild);

    const box = SVG.getBoundingClientRect();
    const W = Math.max(320, box.width|0);
    const H = Math.max(180, (SVG.getAttribute('height')|0) || 260);
    SVG.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const pad = { l:42, r:12, t:12, b:26 };
    const X0 = pad.l, X1 = W - pad.r;
    const Y0 = H - pad.b, Y1 = pad.t;
    const n  = xDates.length;

    // границы
    const maxY = Math.max(1, Math.max(...yTotal, ...yUnique));
    const scaleX = (i)=> (n<=1 ? X0 : X0 + (i*(X1-X0)/(n-1)));
    const scaleY = (v)=> (Y0 - (v * (Y0-Y1) / maxY));

    // сетка Y (4 линии)
    for (let g=0; g<=4; g++){
      const val = Math.round(maxY * g / 4);
      const y = scaleY(val);
      const line = elt('line', {x1:X0, y1:y, x2:X1, y2:y, stroke:'#1b2737','stroke-width':1});
      const lbl  = elt('text', {x:X0-6, y:y+4, fill:'#8fa4c6','font-size':11,'text-anchor':'end'}, String(val));
      SVG.appendChild(line); SVG.appendChild(lbl);
    }

    // ось X: 6 меток
    const ticks = 6;
    for (let i=0;i<ticks;i++){
      const idx = Math.round(i*(n-1)/(ticks-1));
      const x = scaleX(idx);
      const lbl = elt('text',{x, y:H-6, fill:'#8fa4c6','font-size':11,'text-anchor': i==0?'start':(i==ticks-1?'end':'middle')}, xDates[idx]||'');
      SVG.appendChild(lbl);
    }

    // вспомогательная функция: путь по массиву
    function pathFor(arr){
      let d = '';
      for (let i=0;i<n;i++){
        const x = scaleX(i), y = scaleY(arr[i]||0);
        d += (i?'L':'M') + x + ' ' + y;
      }
      return d;
    }

    // линии
    const pTotal  = elt('path',{ d: pathFor(yTotal),  fill:'none', stroke:'#4ed1a9','stroke-width':2.5 });
    const pUnique = elt('path',{ d: pathFor(yUnique), fill:'none', stroke:'#0a84ff','stroke-width':2.5 });
    SVG.appendChild(pTotal);
    SVG.appendChild(pUnique);

    // легенда
    const kx = X0 + 6, ky = Y1 + 10;
    SVG.appendChild(elt('rect',{x:kx, y:ky, width:10, height:10, fill:'#4ed1a9', rx:2}));
    SVG.appendChild(elt('text',{x:kx+16, y:ky+9, fill:'#a5c4f1','font-size':12}, 'Авторизаций'));
    SVG.appendChild(elt('rect',{x:kx+120, y:ky, width:10, height:10, fill:'#0a84ff', rx:2}));
    SVG.appendChild(elt('text',{x:kx+136, y:ky+9, fill:'#a5c4f1','font-size':12}, 'Уникальных'));
  }

  function elt(tag, attrs, text){
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text!=null) e.appendChild(document.createTextNode(text));
    return e;
    }

  // пресеты
  document.querySelectorAll('[data-preset]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = btn.getAttribute('data-preset');
      if (p === 'all') {
        fromEl.value = ''; toEl.value = '';
        run();
      } else {
        setPreset(Number(p));
      }
    });
  });
  applyBtn?.addEventListener('click', run);
  fromEl?.addEventListener('change', ()=>{ if (toEl.value && fromEl.value>toEl.value) toEl.value=fromEl.value; });
  toEl?.addEventListener('change', ()=>{ if (fromEl.value && toEl.value<fromEl.value) fromEl.value=toEl.value; });

  // старт: 30 дней
  (function init(){
    const tz='Europe/Moscow';
    const t = today(tz);
    fromEl.value = addDays(t, -30);
    toEl.value   = t;
    run();
  })();
})();
