(function(){
  const svg = document.getElementById('chart');
  if (!svg) return;

  const API = (window.API || localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,'');
  const PWD = (localStorage.getItem('ADMIN_PWD') || '').toString();
  const DAYS = 7;
  const RU_DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

  function fmtLabelISO(iso){
    // iso = '2025-09-01'
    const [y,m,d] = (iso || '').split('-').map(Number);
    if (!y || !m || !d) return iso || '';
    const dt = new Date(Date.UTC(y, m-1, d));
    const dd = String(d).padStart(2,'0');
    const mm = String(m).padStart(2,'0');
    return `${RU_DOW[dt.getUTCDay()]}.${dd}.${mm}`;
  }

  async function tryFetch(url){
    const r = await fetch(url, { headers:{ 'X-Admin-Password': PWD } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function fetchDaily(){
    // пробуем /summary/daily, затем /daily
    let data;
    try {
      data = await tryFetch(`${API}/api/admin/summary/daily?days=${DAYS}`);
    } catch(_) {
      data = await tryFetch(`${API}/api/admin/daily?days=${DAYS}`);
    }
    return normalize(data);
  }

  function normalize(raw){
    // Возвращаем { labels:[], auth:[], unique:[] } в любом случае
    if (!raw) throw new Error('empty payload');

    // Вариант 1: { ok:true, labels, auth, unique }
    if (raw.ok && Array.isArray(raw.labels) && Array.isArray(raw.auth) && Array.isArray(raw.unique)) {
      return { labels: raw.labels, auth: raw.auth, unique: raw.unique };
    }

    // Вариант 2: { ok:true, days:[{date, auth, unique}] }
    if (raw.ok && Array.isArray(raw.days)) {
      const labels = raw.days.map(d => d.date);
      const auth   = raw.days.map(d => Number(d.auth || d.count || 0));
      const unique = raw.days.map(d => Number(d.unique || d.uniques || 0));
      return { labels, auth, unique };
    }

    // Вариант 3: просто массив [{date, auth, unique}]
    if (Array.isArray(raw)) {
      const labels = raw.map(d => d.date);
      const auth   = raw.map(d => Number(d.auth || d.count || 0));
      const unique = raw.map(d => Number(d.unique || d.uniques || 0));
      return { labels, auth, unique };
    }

    // На всякий случай попробуем common-поля
    const labels = Array.isArray(raw.labels) ? raw.labels : [];
    const auth   = Array.isArray(raw.auth)   ? raw.auth   : [];
    const unique = Array.isArray(raw.unique) ? raw.unique : [];
    if (labels.length && auth.length && unique.length) {
      return { labels, auth, unique };
    }

    throw new Error('unrecognized payload shape');
  }

  function niceTicks(min, max, steps){
    const span = Math.max(1, max - min);
    const step = Math.max(1, Math.ceil(span / steps));
    const top  = Math.ceil(max / step) * step;
    const vals = [];
    for (let v=0; v<=top; v+=step) vals.push(v);
    return {max: top, vals};
  }

  function draw(labelsISO, A, B){
    const labels = labelsISO.map(fmtLabelISO);

    const W = svg.clientWidth || 900, H = 300;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    const M = {t:20,r:16,b:36,l:36};
    const iw = W - M.l - M.r, ih = H - M.t - M.b;

    const maxV = Math.max(1, ...A, ...B);
    const ticks = niceTicks(0, maxV, 4);
    const kY = ih / ticks.max;
    const colW = iw / labels.length;
    const gap = Math.min(12, colW*0.2);
    const barW = (colW - gap) / 2;

    const g = mk('g', {transform:`translate(${M.l},${M.t})`});
    svg.appendChild(g);

    // сетка + ось Y
    g.appendChild(mk('line',{x1:0,y1:0,x2:0,y2:ih,stroke:'#345','stroke-width':1}));
    ticks.vals.forEach(v=>{
      const y = ih - v*kY;
      g.appendChild(mk('line',{x1:0,y1:y,x2:iw,y2:y,stroke:'#233','stroke-width':1}));
      g.appendChild(mk('text',{x:-8,y:y+4,'text-anchor':'end','font-size':11,fill:'#8aa'}, String(v)));
    });

    labels.forEach((lab,i)=>{
      const x0 = i*colW + gap/2;

      const hA = (A[i]||0)*kY, yA = ih - hA;
      g.appendChild(mk('rect',{x:x0,y:yA,width:barW,height:hA,rx:3,fill:'#3b82f6'}));
      if ((A[i]||0)>0) g.appendChild(mk('text',{x:x0+barW/2,y:yA-6,'text-anchor':'middle','font-size':11,fill:'#9db'}, String(A[i])));

      const hB = (B[i]||0)*kY, yB = ih - hB;
      g.appendChild(mk('rect',{x:x0+barW+4,y:yB,width:barW,height:hB,rx:3,fill:'#22c55e'}));
      if ((B[i]||0)>0) g.appendChild(mk('text',{x:x0+barW+4+barW/2,y:yB-6,'text-anchor':'middle','font-size':11,fill:'#9db'}, String(B[i])));

      g.appendChild(mk('text',{x:x0+barW,y:ih+18,'text-anchor':'middle','font-size':11,fill:'#9db'}, lab));
    });

    // легенда
    g.appendChild(mk('rect',{x:0,y:-14,width:10,height:10,rx:2,fill:'#3b82f6'}));
    g.appendChild(mk('text',{x:14,y:-5,'font-size':12,fill:'#bcd'},'Авторизации'));
    g.appendChild(mk('rect',{x:120,y:-14,width:10,height:10,rx:2,fill:'#22c55e'}));
    g.appendChild(mk('text',{x:134,y:-5,'font-size':12,fill:'#bcd'},'Уникальные'));

    function mk(tag, attrs, text){
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
      if (text != null) el.textContent = text;
      return el;
    }
  }

  fetchDaily()
    .then(d => draw(d.labels, d.auth, d.unique))
    .catch(err => console.error('daily chart error:', err));
})();
