// admin/chart-duels.js — big chart: finished duels per day (bars) + turnover (line)
// Tooltip shows: date, duels_count, turnover, rake.

(function(){
  const SVG = document.getElementById('chart-duels');
  if (!SVG) return;

  const fromEl   = document.getElementById('duels-from');
  const toEl     = document.getElementById('duels-to');
  const noteEl   = document.getElementById('duels-note');
  const applyBtn = document.getElementById('duels-apply');

  const NS = 'http://www.w3.org/2000/svg';
  const TZ_FALLBACK = 'Europe/Moscow';

  // ===== helpers =====
  function apiBase(){
    return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,'');
  }
  function headers(){
    return window.adminHeaders ? window.adminHeaders() : {};
  }
  function tz(){
    return (localStorage.getItem('ADMIN_TZ') || TZ_FALLBACK);
  }
  function todayIso(){
    const d = new Date();
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz(),
      year:'numeric', month:'2-digit', day:'2-digit'
    });
    return fmt.format(d); // YYYY-MM-DD
  }
  function addDays(iso, delta){
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0,10);
  }
  function clearSvg(){
    while (SVG.firstChild) SVG.removeChild(SVG.firstChild);
  }
  function elt(tag, attrs, text){
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.appendChild(document.createTextNode(text));
    return e;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmtInt = (n) => (Number(n)||0).toLocaleString('ru-RU');
  const fmtRub = (n) => (Number(n)||0).toLocaleString('ru-RU') + ' ₽';

  // ===== fetch =====
  async function run(){
    const API = apiBase();
    if (!API) return;

    // normalize dates
    let fromV = (fromEl?.value || '').trim();
    let toV   = (toEl?.value || '').trim();
    if (fromV && toV && fromV > toV) {
      const t = fromV; fromV = toV; toV = t;
      fromEl.value = fromV;
      toEl.value = toV;
    }

    const qs = new URLSearchParams({ tz: tz() });
    if (fromV) qs.set('from', fromV);
    if (toV)   qs.set('to', toV);

    let j;
    try{
      const r = await fetch(API + '/api/admin/analytics/duels/daily?' + qs.toString(), {
        headers: headers(),
        cache: 'no-store'
      });
      j = await r.json();
    }catch(e){
      console.error(e);
      clearSvg();
      if (noteEl) noteEl.textContent = 'Ошибка загрузки';
      return;
    }

    const days = Array.isArray(j?.days) ? j.days : [];
    if (!days.length){
      draw([], [], [], []);
      if (noteEl) noteEl.textContent = 'Нет данных';
      return;
    }

    if (j.from && fromEl) fromEl.value = String(j.from).slice(0,10);
    if (j.to && toEl)     toEl.value   = String(j.to).slice(0,10);

    const xs  = days.map(d => d.day || d.date);
    const cnt = days.map(d => Number(d.duels_count ?? d.duels ?? d.count ?? 0));
    const turn= days.map(d => Number(d.turnover ?? d.pot ?? 0));
    const rake= days.map(d => Number(d.rake ?? d.fee ?? 0));

    draw(xs, cnt, turn, rake);

    const sumCnt  = cnt.reduce((a,b)=>a+(Number(b)||0),0);
    const sumTurn = turn.reduce((a,b)=>a+(Number(b)||0),0);
    const sumRake = rake.reduce((a,b)=>a+(Number(b)||0),0);
    const trunc = j?.truncated ? ' • (период укорочен)' : '';
    if (noteEl) noteEl.textContent = `Период: ${j.from} – ${j.to} • дуэлей: ${fmtInt(sumCnt)} • оборот: ${fmtRub(sumTurn)} • рейк: ${fmtRub(sumRake)}${trunc}`;
  }

  // ===== draw =====
  function draw(xDates, duelsCount, turnover, rake){
    clearSvg();

    const n = xDates.length;
    const box = SVG.getBoundingClientRect();
    const W = Math.max(320, box.width | 0);
    const H = Math.max(180, (SVG.getAttribute('height')|0) || 260);
    SVG.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const padL = 56, padR = 62, padT = 20, padB = 28;
    const X0 = padL, X1 = W - padR;
    const Y0 = H - padB, Y1 = padT;

    const maxCntRaw  = duelsCount.map(v=>Number(v)||0);
    const maxTurnRaw = turnover.map(v=>Number(v)||0);
    let maxCnt  = Math.max(1, ...(maxCntRaw.length?maxCntRaw:[1]));
    let maxTurn = Math.max(1, ...(maxTurnRaw.length?maxTurnRaw:[1]));
    maxCnt  = Math.max(1, Math.ceil(maxCnt * 1.15));
    maxTurn = Math.max(1, Math.ceil(maxTurn * 1.12));

    const scaleX = i => (n <= 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0) / (n - 1)));
    const yCnt   = v => Y0 - ((Number(v)||0) * (Y0 - Y1) / maxCnt);
    const yTurn  = v => Y0 - ((Number(v)||0) * (Y0 - Y1) / maxTurn);

    // grid (4 lines)
    for (let g = 0; g <= 4; g++){
      const frac = g / 4;
      const y = Y0 - frac * (Y0 - Y1);

      SVG.appendChild(elt('line', { x1:X0, y1:y, x2:X1, y2:y, stroke:'#1b2737', 'stroke-width':1 }));

      const vL = Math.round(maxCnt * frac);
      SVG.appendChild(elt('text', { x:X0-6, y:y+4, fill:'#8fa4c6', 'font-size':11, 'text-anchor':'end' }, String(vL)));

      // right axis (turnover)
      const vR = Math.round(maxTurn * frac);
      SVG.appendChild(elt('text', { x:X1+6, y:y+4, fill:'#8fa4c6', 'font-size':11, 'text-anchor':'start' }, String(vR)));
    }

    // x labels (<=6)
    const ticks = Math.min(6, Math.max(2, n || 0));
    for (let i = 0; i < ticks && n > 0; i++){
      const idx = Math.round(i * (n - 1) / (ticks - 1));
      const x = scaleX(idx);
      const label = (xDates[idx] || '').slice(0,10);
      const anchor = (i === 0) ? 'start' : (i === ticks - 1 ? 'end' : 'middle');
      SVG.appendChild(elt('text', { x, y: H - 6, fill:'#8fa4c6', 'font-size':11, 'text-anchor': anchor }, label));
    }

    const blue  = '#0a84ff';
    const green = '#4ed1a9';

    // bars (duels count)
    if (n > 0) {
      const step = (n <= 1) ? (X1 - X0) : (X1 - X0) / (n - 1);
      const bw = Math.max(3, Math.min(22, step * 0.55));
      for (let i=0;i<n;i++){
        const x = scaleX(i) - bw/2;
        const v = duelsCount[i] || 0;
        const y = yCnt(v);
        const h = Math.max(0, Y0 - y);
        SVG.appendChild(elt('rect', { x, y, width:bw, height:h, fill:green, rx:2 }));
      }
    }

    // turnover line
    function pathFor(arr){
      if (!n) return `M${X0} ${Y0}`;
      let d = '';
      for (let i=0;i<n;i++){
        const x = scaleX(i);
        const y = yTurn(arr[i]||0);
        d += (i ? 'L' : 'M') + x + ' ' + y;
      }
      return d;
    }
    SVG.appendChild(elt('path', { d: pathFor(turnover), fill:'none', stroke:blue, 'stroke-width':2 }));

    // legend
    const lx = X0, ly = Y1 - 16;
    SVG.appendChild(elt('rect',{x:lx,y:ly,width:10,height:10,fill:green,rx:2}));
    SVG.appendChild(elt('text',{x:lx+16,y:ly+9,fill:'#a5c4f1','font-size':12},'Дуэлей'));
    // line sample
    SVG.appendChild(elt('line',{x1:lx+90,y1:ly+5,x2:lx+110,y2:ly+5,stroke:blue,'stroke-width':2}));
    SVG.appendChild(elt('text',{x:lx+118,y:ly+9,fill:'#a5c4f1','font-size':12},'Оборот'));

    if (!n) return;

    // hover / tooltip
    const hover = elt('g', { style:'pointer-events:none' });
    const vline = elt('line', { x1:X0, y1:Y1, x2:X0, y2:Y0, stroke:'#8fa4c6', 'stroke-width':1, 'stroke-opacity':'0.5' });
    const dot   = elt('circle', { r:4, fill:blue, stroke:'#0b1a2b', 'stroke-width':1 });
    hover.appendChild(vline);
    hover.appendChild(dot);

    const tip = elt('g');
    const tipBg = elt('rect',{x:0,y:0,rx:6,ry:6,fill:'#0b1a2b',stroke:'#213047','stroke-width':1,opacity:'0.95'});
    const l1 = elt('text',{x:10,y:16,fill:'#a5c4f1','font-size':12});
    const l2 = elt('text',{x:10,y:34,fill:'#a5c4f1','font-size':12});
    const l3 = elt('text',{x:10,y:52,fill:'#a5c4f1','font-size':12});
    const l4 = elt('text',{x:10,y:70,fill:'#a5c4f1','font-size':12});
    tip.appendChild(tipBg);
    tip.appendChild(l1);
    tip.appendChild(l2);
    tip.appendChild(l3);
    tip.appendChild(l4);
    hover.appendChild(tip);
    SVG.appendChild(hover);

    const overlay = elt('rect', { x:X0, y:Y1, width:(X1-X0), height:(Y0-Y1), fill:'transparent', style:'cursor:crosshair' });
    SVG.appendChild(overlay);

    function update(px){
      const box = SVG.getBoundingClientRect();
      const localX = clamp(px - box.left, X0, X1);
      const rel = (localX - X0) / (X1 - X0);
      const idx = clamp(Math.round(rel * (n - 1)), 0, n - 1);

      const x = scaleX(idx);
      const tv = turnover[idx] || 0;
      const cv = duelsCount[idx] || 0;
      const rv = rake[idx] || 0;
      const y = yTurn(tv);
      const label = (xDates[idx] || '').slice(0,10);

      vline.setAttribute('x1', x);
      vline.setAttribute('x2', x);
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);

      l1.textContent = label;
      l2.textContent = `Дуэлей: ${fmtInt(cv)}`;
      l3.textContent = `Оборот: ${fmtRub(tv)}`;
      l4.textContent = `Рейк: ${fmtRub(rv)}`;

      // tooltip size
      const w = Math.max(l1.getComputedTextLength(), l2.getComputedTextLength(), l3.getComputedTextLength(), l4.getComputedTextLength()) + 20;
      const h = 82;

      let tx = x + 12;
      let ty = Y1 + 8;
      if (tx + w > W - 4) tx = x - w - 12;
      if (ty + h > H - 4) ty = H - h - 4;

      tip.setAttribute('transform', `translate(${tx} ${ty})`);
      tipBg.setAttribute('width', w);
      tipBg.setAttribute('height', h);
    }

    function onMove(ev){
      const px = ev.touches ? ev.touches[0].clientX : ev.clientX;
      update(px);
    }

    overlay.addEventListener('mousemove', onMove, { passive:true });
    overlay.addEventListener('touchmove', onMove, { passive:true });
    overlay.addEventListener('mouseenter', onMove, { passive:true });
  }

  // ===== wiring =====
  function applyPreset(p, btn){
    // keep UI "active" state inside this panel only
    if (btn){
      const panel = btn.closest('.panel');
      if (panel){
        panel.querySelectorAll('[data-duels-preset].active').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    }
    if (!fromEl || !toEl) return;

    if (p === 'all') {
      fromEl.value = '';
      toEl.value   = '';
      run();
      return;
    }

    let days = Number(p);
    if (!Number.isFinite(days) || days < 1) days = 7;

    const t = todayIso();
    // inclusive range: today + (days-1) previous
    fromEl.value = addDays(t, -(days - 1));
    toEl.value   = t;

    run();
  }

  // Robust click handling: works even if DOM is re-rendered or buttons are inside <form>.
  // Also shields from accidental submit/reload.
  document.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('[data-duels-preset]');
    if (!btn) return;

    // make sure it's OUR duels chart panel
    const panel = btn.closest('.panel');
    if (!panel || !panel.querySelector('#chart-duels')) return;

    ev.preventDefault();
    ev.stopPropagation();

    const p = (btn.getAttribute('data-duels-preset') || '').trim();
    applyPreset(p, btn);
  }, true);

applyBtn?.addEventListener('click', run);

  fromEl?.addEventListener('change', () => {
    if (toEl.value && fromEl.value > toEl.value) toEl.value = fromEl.value;
  });
  toEl?.addEventListener('change', () => {
    if (fromEl.value && toEl.value < fromEl.value) fromEl.value = toEl.value;
  });

  try {
    window.addEventListener('adminApiChanged', run);
  } catch (_) {}

  // старт — последние 30 дней
  (function init(){
    const t = todayIso();
    if (fromEl) fromEl.value = addDays(t, -30);
    if (toEl)   toEl.value   = t;
    run();
  })();
})();
