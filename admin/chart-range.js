// admin/chart-range.js — надёжный SVG-график: не зависит от ID полей, сам подставит даты и сделает ретраи
(function(){
  const svg = document.getElementById('chart-range');
  const note = document.getElementById('range-note') || (function(){ const p=document.createElement('div'); p.id='range-note'; p.className='muted'; (svg&&svg.parentNode?svg.parentNode:document.body).appendChild(p); return p; })();
  if (!svg) return;

  function api(){ return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,''); }
  function pwd(){ return (localStorage.getItem('ADMIN_PWD') || '').toString(); }

  // Найти элементы управления, если есть
  function pickInputs(){
    const root = svg.closest('.card,section,div') || document;
    const dates = Array.from(root.querySelectorAll('input[type="date"]'));
    // предполагаем, что их максимум два и по порядку: from,to
    const fromEl = dates[0] || null;
    const toEl   = dates[1] || null;
    const apply  = root.querySelector('#range-apply, button[data-action="range-apply"]') || null;
    const analytics = root.querySelector('#range-analytics');
    return { fromEl, toEl, apply, analytics };
  }
  function todayISO(tz){
    try {
      const s = new Date().toLocaleString('ru-RU', { timeZone: tz });
      const d = new Date(s);
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${dd}`;
    } catch(_) {
      return new Date().toISOString().slice(0,10);
    }
  }
  function addDays(iso, k){
    const d = new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+k); return d.toISOString().slice(0,10);
  }
  async function fetchJSON(url, init, retries=2){
    try {
      const r = await fetch(url, init);
      if (!r.ok) {
        if (retries>0 && (r.status>=500 || r.status===502 || r.status===504)) {
          await new Promise(res=>setTimeout(res, 800));
          return fetchJSON(url, init, retries-1);
        }
        const t = await r.text().catch(()=>'');
        throw new Error('http_'+r.status+' '+t.slice(0,180));
      }
      return await r.json();
    } catch(e){
      if (retries>0) {
        await new Promise(res=>setTimeout(res, 800));
        return fetchJSON(url, init, retries-1);
      }
      throw e;
    }
  }

  async function run(){
    note.textContent = 'Загрузка…';
    draw([],[]);

    const base = api();
    if (!base) { note.textContent='Укажи API и пароль вверху и нажми "Сохранить"'; return; }

    const { fromEl, toEl, analytics } = pickInputs();
    const tz = 'Europe/Moscow';
    const toS   = (toEl && toEl.value) || todayISO(tz);
    const fromS = (fromEl && fromEl.value) || addDays(toS, -30);

    const qs = new URLSearchParams({ tz, from: fromS, to: toS });
    if (analytics && analytics.checked) qs.set('analytics','1');

    const headers = { 'X-Admin-Password': pwd() };
    try {
      const j = await fetchJSON(base + '/api/admin/range?' + qs.toString(), { headers, cache:'no-store' });
      if (!j || !j.ok || !Array.isArray(j.days)) { note.textContent='Нет данных'; return; }
      const xs = j.days.map(d => d.date || d.day);
      const sTotal  = j.days.map(d => Number(d.auth_total  || 0));
      const sUnique = j.days.map(d => Number((d.auth_unique_analytics ?? d.auth_unique) || 0));
      draw(xs, sTotal, sUnique);
      note.textContent = `Период: ${j.from} – ${j.to} • дней: ${j.days.length}` + (qs.get('analytics')?' • учёт аналитики: да':'');
    } catch(e){
      note.textContent = 'Ошибка: ' + (e && e.message ? e.message : 'network');
    }
  }

  function draw(xDates, y1, y2){
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = Math.max(320, svg.clientWidth || 820);
    const H = Math.max(180, (svg.getAttribute('height')|0) || 260);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const pad = { l:42, r:12, t:12, b:26 };
    const X0 = pad.l, X1 = W - pad.r;
    const Y0 = H - pad.b, Y1 = pad.t;
    const n  = xDates.length;

    const safeMax = (a)=> a.length?Math.max(...a):1;
    const maxY = Math.max(1, safeMax(y1), safeMax(y2));
    const scaleX = (i)=> (n<=1 ? X0 : X0 + (i*(X1-X0)/(n-1)));
    const scaleY = (v)=> (Y0 - (v * (Y0-Y1) / maxY));

    // сетка
    for (let g=0; g<=4; g++){
      const val = Math.round(maxY * g / 4);
      const y = scaleY(val);
      svg.appendChild(line(X0,y,X1,y,'#1b2737'));
      svg.appendChild(text(X0-6,y+4,String(val),'end'));
    }
    const ticks = Math.min(6, Math.max(2, n||2));
    for (let i=0;i<ticks;i++){
      const idx = n ? Math.round(i*(n-1)/(ticks-1)) : 0;
      const x = scaleX(idx);
      svg.appendChild(text(x, H-6, xDates[idx]||'', i==0?'start':(i==ticks-1?'end':'middle')));
    }

    // линии
    svg.appendChild(path(y1, '#0a84ff', 2));
    svg.appendChild(path(y2, '#4ed1a9', 2));

    function path(arr, color, width){
      let d='';
      for (let i=0;i<arr.length;i++){
        const x=scaleX(i), y=scaleY(arr[i]||0);
        d += (i===0?`M ${x} ${y}`:` L ${x} ${y}`);
      }
      const p = document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d', d); p.setAttribute('stroke', color); p.setAttribute('stroke-width', width); p.setAttribute('fill','none');
      return p;
    }
    function line(x1,y1,x2,y2,color){
      const l = document.createElementNS('http://www.w3.org/2000/svg','line');
      l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2); l.setAttribute('stroke',color); l.setAttribute('stroke-width','1');
      return l;
    }
    function text(x,y,txt,anchor){
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x',x); t.setAttribute('y',y); t.setAttribute('fill','#8fa4c6'); t.setAttribute('font-size','11');
      if (anchor) t.setAttribute('text-anchor', anchor);
      t.appendChild(document.createTextNode(txt));
      return t;
    }
  }

  // Привязка кнопки (если есть)
  const { apply } = pickInputs();
  if (apply) apply.addEventListener('click', run);

  // Авто-старт
  if (document.readyState==='complete' || document.readyState==='interactive') setTimeout(run, 100);
  else document.addEventListener('DOMContentLoaded', ()=>setTimeout(run,100));
})();