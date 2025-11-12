// admin/chart-range.js — SVG график диапазона с ретраями и явным X-Admin-Password
(function(){
  const SVG = document.getElementById('chart-range');
  if (!SVG) return;

  const fromEl = document.getElementById('range-from');
  const toEl   = document.getElementById('range-to');
  const noteEl = document.getElementById('range-note');
  const applyBtn = document.getElementById('range-apply');

  function apiBase(){
    return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,'');
  }
  function adminPwd(){
    return (localStorage.getItem('ADMIN_PWD') || '').toString();
  }
  function today(tz){
    try{
      const r = new Date().toLocaleString('ru-RU', { timeZone: tz });
      const d = new Date(r);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${yyyy}-${mm}-${dd}`;
    }catch(_){
      const d = new Date();
      return d.toISOString().slice(0,10);
    }
  }
  function addDays(iso, k){
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate()+k);
    return d.toISOString().slice(0,10);
  }
  function fmtInt(x){ return (x|0).toString(); }
  function elt(tag, attrs, text){
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text!=null) e.appendChild(document.createTextNode(text));
    return e;
  }

  async function fetchRange(qs, retries=2){
    const API = apiBase(); if (!API) throw new Error('no_api');
    const url = API + '/api/admin/range?' + qs.toString();
    const opt = { headers: { 'X-Admin-Password': adminPwd() }, cache:'no-store' };
    try{
      const r = await fetch(url, opt);
      if (!r.ok) {
        if (retries>0 && (r.status>=500 || r.status===502 || r.status===504)) {
          await new Promise(res=>setTimeout(res, 800));
          return fetchRange(qs, retries-1);
        }
        const t = await r.text().catch(()=>'');
        throw new Error('http_'+r.status+' '+t.slice(0,150));
      }
      return await r.json();
    }catch(e){
      if (retries>0) {
        await new Promise(res=>setTimeout(res, 800));
        return fetchRange(qs, retries-1);
      }
      throw e;
    }
  }

  async function run(){
    // clean note & show loading
    noteEl.textContent = 'Загрузка…';
    draw([],[]);

    const API = apiBase();
    if (!API) { noteEl.textContent = 'Укажи API и пароль вверху и нажми "Сохранить"'; return; }

    const qs = new URLSearchParams({ tz:'Europe/Moscow' });
    if (fromEl.value) qs.set('from', fromEl.value);
    if (toEl.value)   qs.set('to',   toEl.value);
    // поддержка чекбокса "учесть аналитику", если он существует
    const chk = document.getElementById('range-analytics');
    if (chk && chk.checked) qs.set('analytics','1');

    try{
      const j = await fetchRange(qs);
      if (!j || !j.ok || !Array.isArray(j.days)) {
        draw([],[]); noteEl.textContent = 'Нет данных';
        return;
      }
      const xs = j.days.map(d => d.date || d.day);
      const sTotal  = j.days.map(d => Number(d.auth_total  || 0));
      const sUnique = j.days.map(d => Number((d.auth_unique_analytics ?? d.auth_unique) || 0));
      draw(xs, sTotal, sUnique);
      noteEl.textContent = `Период: ${j.from} – ${j.to} • дней: ${j.days.length}` + (qs.get('analytics')?' • учет аналитики: да':'');
    }catch(e){
      draw([],[]);
      noteEl.textContent = 'Ошибка: ' + (e && e.message ? e.message : 'network');
    }
  }

  function draw(xDates, yTotal, yUnique){
    while (SVG.firstChild) SVG.removeChild(SVG.firstChild);
    const W = Math.max(320, SVG.clientWidth || 820);
    const H = Math.max(180, (SVG.getAttribute('height')|0) || 260);
    SVG.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const pad = { l:42, r:12, t:12, b:26 };
    const X0 = pad.l, X1 = W - pad.r;
    const Y0 = H - pad.b, Y1 = pad.t;
    const n  = xDates.length;

    const safeMax = (arr) => arr.length ? Math.max(...arr) : 1;
    const maxY = Math.max(1, safeMax(yTotal), safeMax(yUnique));
    const scaleX = (i)=> (n<=1 ? X0 : X0 + (i*(X1-X0)/(n-1)));
    const scaleY = (v)=> (Y0 - (v * (Y0-Y1) / maxY));

    // сетка Y
    for (let g=0; g<=4; g++){
      const val = Math.round(maxY * g / 4);
      const y = scaleY(val);
      const line = elt('line', {x1:X0, y1:y, x2:X1, y2:y, stroke:'#1b2737','stroke-width':1});
      const lbl  = elt('text', {x:X0-6, y:y+4, fill:'#8fa4c6','font-size':11,'text-anchor':'end'}, String(val));
      SVG.appendChild(line); SVG.appendChild(lbl);
    }
    // ось X ~6 меток
    const ticks = Math.min(6, Math.max(2, n||2));
    for (let i=0;i<ticks;i++){
      const idx = n ? Math.round(i*(n-1)/(ticks-1)) : 0;
      const x = scaleX(idx);
      const lbl = elt('text',{x, y:H-6, fill:'#8fa4c6','font-size':11,'text-anchor': i==0?'start':(i==ticks-1?'end':'middle')}, xDates[idx]||'');
      SVG.appendChild(lbl);
    }
    // path helper
    function pathFor(arr){
      let d = '';
      for (let i=0;i<arr.length;i++){
        const x = scaleX(i), y = scaleY(arr[i]||0);
        d += (i===0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
      }
      return d;
    }
    const colorBlue = '#0a84ff', colorGreen = '#4ed1a9';
    // линии
    const p1 = elt('path',{ d:pathFor(yTotal),  stroke:colorBlue,  'stroke-width':2, fill:'none' });
    const p2 = elt('path',{ d:pathFor(yUnique), stroke:colorGreen, 'stroke-width':2, fill:'none' });
    SVG.appendChild(p1); SVG.appendChild(p2);
  }

  // UI
  document.querySelectorAll('[data-preset]').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      const p = ev.currentTarget.getAttribute('data-preset');
      const tz='Europe/Moscow';
      const t = today(tz);
      toEl.value = t;
      if (p==='7')   fromEl.value = addDays(t,-6);
      else if (p==='30') fromEl.value = addDays(t,-29);
      else if (p==='90') fromEl.value = addDays(t,-89);
      else if (p==='365') fromEl.value = addDays(t,-364);
      else fromEl.value = '';
      run();
    });
  });
  applyBtn?.addEventListener('click', run);

  // старт: 30 дней
  (function init(){
    const tz='Europe/Moscow';
    const t = today(tz);
    fromEl.value = addDays(t, -30);
    toEl.value   = t;
    run();
  })();
})();