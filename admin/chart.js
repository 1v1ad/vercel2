// admin/chart.js — компактный барчарт на canvas, без внешних библиотек
(function(){
  const RU_DOW = ['вс','пн','вт','ср','чт','пт','сб'];

  function getAPI(){
    return (localStorage.getItem('ADMIN_API') || '').toString().trim().replace(/\/+$/,'');
  }
  function adminHeaders(){
    return (window.adminHeaders ? window.adminHeaders() : {});
  }

  function fmtDateKey(d){ // YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function fmtLabel(d){ // "пн.01.09"
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    return `${RU_DOW[d.getDay()]}.${dd}.${mm}`;
  }

  function last7days(){
    const today = new Date();
    today.setHours(0,0,0,0);
    const arr = [];
    for(let i=6;i>=0;i--){
      const d = new Date(today);
      d.setDate(today.getDate()-i);
      arr.push(d);
    }
    return arr; // [ .. , today ] — сегодня справа
  }

  async function fetchDaily(){
    const API = getAPI();
    if(!API) return null;
    try{
      const r = await fetch(`${API}/api/admin/summary/daily?days=7`, { headers: adminHeaders(), cache:'no-store' });
      if(!r.ok) throw 0;
      const j = await r.json();
      // ожидаем один из вариантов: {ok:true, days:[{date,auth,unique},..]} или daily/items
      const items = (j && (j.days || j.daily || j.items)) || [];
      const map = new Map();
      for(const it of items){
        const key = String(it.date || it.day || it.d || '').slice(0,10);
        const auth = Number(it.auth || it.total || it.count || 0) || 0;
        const uniq = Number(it.unique || it.uniques || it.u || 0) || 0;
        if(key) map.set(key, { auth, uniq });
      }
      return map;
    }catch(_){
      return null;
    }
  }

  function drawBars(canvas, labels, a, b){
    if(!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 200;
    canvas.width  = Math.floor(w*dpr);
    canvas.height = Math.floor(h*dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);

    // отступы
    const pad = { l:48, r:12, t:16, b:32 };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;

    // оси/сетка
    ctx.strokeStyle = '#1d2a3a';
    ctx.lineWidth = 1;
    for(let i=0;i<=4;i++){
      const y = pad.t + ch * (i/4);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w-pad.r, y); ctx.stroke();
    }

    // шкала
    const maxVal = Math.max(1, Math.max(...a, ...b));
    const barGroupW = cw / labels.length;
    const gap = Math.min(14, barGroupW*0.2);
    const barW = Math.max(6, (barGroupW - gap)/2);

    function yVal(v){ return pad.t + ch - (v/maxVal)*ch; }

    // серия A: авторизации
    ctx.fillStyle = '#2e7dd7';
    labels.forEach((_,i)=>{
      const x0 = pad.l + i*barGroupW + gap/2;
      const y = yVal(a[i]);
      const hh = pad.t + ch - y;
      ctx.fillRect(x0, y, barW, Math.max(1, hh));
    });

    // серия B: уникальные
    ctx.fillStyle = '#56d364';
    labels.forEach((_,i)=>{
      const x0 = pad.l + i*barGroupW + gap/2 + barW + 4;
      const y = yVal(b[i]);
      const hh = pad.t + ch - y;
      ctx.fillRect(x0, y, barW, Math.max(1, hh));
    });

    // ось X
    ctx.fillStyle = '#8fa4c6';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((lab,i)=>{
      const x = pad.l + i*barGroupW + barGroupW/2;
      ctx.fillText(lab, x, h-10);
    });

    // легенда
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d7dee9';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif';
    // квадратик
    function legend(x,y,color,text){
      ctx.fillStyle = color; ctx.fillRect(x,y,12,12);
      ctx.fillStyle = '#bcd0ef'; ctx.fillText(text, x+18, y+11);
    }
    legend(pad.l, 8, '#2e7dd7', 'Авторизации');
    legend(pad.l+120, 8, '#56d364', 'Уникальные');
  }

  async function buildChart(){
    const cvs = document.getElementById('visits-chart');
    if(!cvs) return;

    const days = last7days(); // сегодня — последний
    const labels = days.map(fmtLabel);
    const keys   = days.map(fmtDateKey);

    const map = await fetchDaily(); // Map(YYYY-MM-DD -> {auth, uniq})
    const auth = [], uniq = [];
    for(const k of keys){
      const it = map && map.get(k);
      auth.push(it ? Number(it.auth||0) : 0);
      uniq.push(it ? Number(it.uniq||it.unique||0) : 0);
    }

    drawBars(cvs, labels, auth, uniq);
  }

  // перерисовка по ресайзу
  let resizeT = 0;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeT);
    resizeT = setTimeout(buildChart, 150);
  });

  // публичный хук, чтобы дергать из других скриптов при надобности
  window.refreshVisitsChart = buildChart;

  // автозапуск
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', buildChart);
  } else {
    buildChart();
  }
})();
