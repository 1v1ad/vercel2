<!-- admin/chart.js -->
<script>
(function(){
  const svg = document.getElementById('chart');
  if (!svg) return;

  const API = (window.API || localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,'');
  const PWD = (localStorage.getItem('ADMIN_PWD') || '').toString();
  const DAYS = 7;

  const RU_DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

  function fmtLabel(iso){
    // iso = YYYY-MM-DD
    const [y,m,d] = iso.split('-').map(n=>parseInt(n,10));
    const dt = new Date(Date.UTC(y, m-1, d)); // без сдвигов
    const dow = RU_DOW[dt.getUTCDay()];
    const dd = String(d).padStart(2,'0');
    const mm = String(m).padStart(2,'0');
    return `${dow}.${dd}.${mm}`;
  }

  async function get(url){
    const r = await fetch(url, { headers: { 'X-Admin-Password': PWD }});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function load() {
    // Пытаемся сначала по "правильному" пути, если 404 — по алиасу
    let data;
    try {
      data = await get(`${API}/api/admin/summary/daily?days=${DAYS}`);
    } catch(_) {
      data = await get(`${API}/api/admin/daily?days=${DAYS}`);
    }
    if (!data || !data.ok) throw new Error('Bad daily payload');

    draw(data.labels.map(fmtLabel), data.auth, data.unique);
  }

  function draw(labels, seriesA, seriesB){
    // размеры и отступы
    const W = svg.clientWidth || 900;
    const H = 300;
    const px = n => Math.round(n*10)/10;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';

    const M = {t:20,r:16,b:36,l:36};
    const innerW = W - M.l - M.r;
    const innerH = H - M.t - M.b;

    const maxV = Math.max(1, ...seriesA, ...seriesB);
    const ticks = niceTicks(0, maxV, 4); // 4 деления по Y
    const kY = innerH / ticks.max; // масштаб Y
    const colW = innerW / labels.length;
    const gap = Math.min(12, colW*0.2);
    const barW = (colW - gap) / 2;

    // ось Y + сетка
    const g = mk('g', {transform:`translate(${M.l},${M.t})`});
    svg.appendChild(g);

    ticks.values.forEach(v=>{
      const y = innerH - v * kY;
      g.appendChild(mk('line', {x1:0, y1:y, x2:innerW, y2:y, stroke:'#233', 'stroke-width':1}));
      g.appendChild(mk('text', {x:-8, y:y+4, 'text-anchor':'end', 'font-size':11, fill:'#8aa'}, v));
    });

    // столбики
    labels.forEach((lab, i)=>{
      const x0 = i*colW + gap/2;

      // A — авторизации (синяя)
      const hA = seriesA[i]*kY;
      const yA = innerH - hA;
      g.appendChild(mk('rect', {x:x0, y:yA, width:barW, height:hA, rx:3, fill:'#3b82f6'}));
      if (seriesA[i]>0) g.appendChild(mk('text', {x:x0+barW/2, y:yA-6, 'text-anchor':'middle', 'font-size':11, fill:'#9db'}, String(seriesA[i])));

      // B — уникальные (зелёная)
      const hB = seriesB[i]*kY;
      const yB = innerH - hB;
      g.appendChild(mk('rect', {x:x0+barW+4, y:yB, width:barW, height:hB, rx:3, fill:'#22c55e'}));
      if (seriesB[i]>0) g.appendChild(mk('text', {x:x0+barW+4+barW/2, y:yB-6, 'text-anchor':'middle', 'font-size':11, fill:'#9db'}, String(seriesB[i])));

      // подпись X
      g.appendChild(mk('text', {x:x0+barW, y:innerH+18, 'text-anchor':'middle', 'font-size':11, fill:'#9db'}, lab));
    });

    // легенда
    const lgY = 0;
    g.appendChild(mk('rect', {x:0, y:lgY-14, width:10, height:10, rx:2, fill:'#3b82f6'}));
    g.appendChild(mk('text', {x:14, y:lgY-5, 'font-size':12, fill:'#bcd'}, 'Авторизации'));
    g.appendChild(mk('rect', {x:120, y:lgY-14, width:10, height:10, rx:2, fill:'#22c55e'}));
    g.appendChild(mk('text', {x:134, y:lgY-5, 'font-size':12, fill:'#bcd'}, 'Уникальные'));

    function mk(tag, attrs, text){
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs||{}).forEach(([k,v])=>el.setAttribute(k, v));
      if (text!=null) el.textContent = text;
      return el;
    }

    function niceTicks(min, max, steps){
      // грубый "nice" расчёт делений
      const span = max - min;
      const step = Math.max(1, Math.ceil(span / steps));
      const top = Math.ceil(max / step) * step;
      const vals = [];
      for (let v = 0; v <= top; v += step) vals.push(v);
      return { max: top, values: vals };
    }
  }

  load().catch(err => console.error('daily chart error:', err));
})();
</script>
