// admin/chart-range.js — линейный график по произвольному диапазону дат
// Синий — всего авторизаций, зелёный — уникальные HUM.
// Есть hover: вертикальная линия, точки и тултип.

(function(){
  const SVG = document.getElementById('chart-range');
  if (!SVG) return;

  const fromEl   = document.getElementById('range-from');
  const toEl     = document.getElementById('range-to');
  const noteEl   = document.getElementById('range-note');
  const applyBtn = document.getElementById('range-apply');

  const TZ = 'Europe/Moscow';
  const NS = 'http://www.w3.org/2000/svg';

  // ===== helpers =====
  function apiBase(){
    return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,'');
  }
  function headers(){
    return window.adminHeaders ? window.adminHeaders() : {};
  }

  function todayIso(){
    const d = new Date();
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: TZ,
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
  const fmtInt = (n) => {
    const v = Number(n)||0;
    return v.toLocaleString('ru-RU');
  };

  // ===== fetch & draw =====
  async function run(){
    const API = apiBase();
    if (!API) return;

    const qs = new URLSearchParams({ tz: TZ });
    if (fromEl.value) qs.set('from', fromEl.value);
    if (toEl.value)   qs.set('to',   toEl.value);

    const humFlag = window.getAdminHumFlag ? (window.getAdminHumFlag() ? '1' : '0') : '1';
    qs.set('include_hum', humFlag);

    let j;
    try{
      const r = await fetch(API + '/api/admin/range?' + qs.toString(), {
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

    if (!j || !j.ok || !Array.isArray(j.days)) {
      // пустой набор — просто чистим график
      drawLine([], [], []);
      if (noteEl) noteEl.textContent = 'Нет данных';
      return;
    }

    const xs = j.days.map(d => d.date || d.day);
    const sTotal  = j.days.map(d => Number(d.auth_total  ?? d.total  ?? 0)); // синий
    const sUnique = j.days.map(d => Number(d.auth_unique ?? d.unique ?? 0)); // зелёный

    // обновляем поля дат тем, что вернул бэкенд
    if (j.from) fromEl.value = String(j.from).slice(0,10);
    if (j.to)   toEl.value   = String(j.to).slice(0,10);

    drawLine(xs, sTotal, sUnique);
    if (noteEl) {
      noteEl.textContent = `Период: ${j.from} – ${j.to} • дней: ${j.days.length}`;
    }
  }

  function drawLine(xDates, yTotal, yUnique){
    clearSvg();

    const n = xDates.length;
    const box = SVG.getBoundingClientRect();
    const W = Math.max(320, box.width | 0);
    const H = Math.max(180, (SVG.getAttribute('height')|0) || 260);
    SVG.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const padL = 52, padR = 16, padT = 18, padB = 28;
    const X0 = padL, X1 = W - padR;
    const Y0 = H - padB, Y1 = padT;

    const allValsRaw = [...yTotal, ...yUnique].map(v => Number(v) || 0);
    const allVals = allValsRaw.filter(v => v > 0);
    let maxY = allVals.length ? Math.max(...allVals) : 1;

    // маленький запас, чтобы график не прилипал к верху
    maxY = Math.max(1, Math.ceil(maxY * 1.1));

    const scaleX = i => (n <= 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0) / (n - 1)));
    const scaleY = v => Y0 - (v * (Y0 - Y1) / maxY);

    // сетка Y
    for (let g = 0; g <= 4; g++){
      const val = Math.round(maxY * g / 4);
      const y = scaleY(val);
      const line = elt('line', { x1:X0, y1:y, x2:X1, y2:y, stroke:'#1b2737', 'stroke-width':1 });
      const text = elt('text', { x:X0-6, y:y+4, fill:'#8fa4c6', 'font-size':11, 'text-anchor':'end' }, String(val));
      SVG.appendChild(line);
      SVG.appendChild(text);
    }

    // подписи X (не более 6)
    const ticks = Math.min(6, Math.max(2, n || 0));
    for (let i = 0; i < ticks && n > 0; i++){
      const idx = Math.round(i * (n - 1) / (ticks - 1));
      const x = scaleX(idx);
      const label = xDates[idx] || '';
      const anchor = (i === 0) ? 'start' : (i === ticks - 1 ? 'end' : 'middle');
      const text = elt('text', {
        x, y: H - 6,
        fill:'#8fa4c6', 'font-size':11, 'text-anchor': anchor
      }, label);
      SVG.appendChild(text);
    }

    function pathFor(arr){
      if (!n) return `M${X0} ${Y0}`;
      let d = '';
      for (let i = 0; i < n; i++){
        const x = scaleX(i);
        const y = scaleY(arr[i] || 0);
        d += (i ? 'L' : 'M') + x + ' ' + y;
      }
      return d;
    }

    const blue  = '#0a84ff';
    const green = '#4ed1a9';

    const pathTotal = elt('path', {
      d: pathFor(yTotal),
      fill:'none',
      stroke: blue,
      'stroke-width':2
    });
    const pathUnique = elt('path', {
      d: pathFor(yUnique),
      fill:'none',
      stroke: green,
      'stroke-width':2
    });
    SVG.appendChild(pathTotal);
    SVG.appendChild(pathUnique);

    // легенда
    const legend = elt('g');
    const lx = X0, ly = Y1 - 8;
    legend.appendChild(elt('rect',{x:lx,y:ly,width:10,height:10,fill:blue,rx:2}));
    legend.appendChild(elt('text',{x:lx+16,y:ly+9,fill:'#a5c4f1','font-size':12},'Всего авторизаций'));
    legend.appendChild(elt('rect',{x:lx+190,y:ly,width:10,height:10,fill:green,rx:2}));
    legend.appendChild(elt('text',{x:lx+206,y:ly+9,fill:'#a5c4f1','font-size':12},'Уникальных HUM'));
    SVG.appendChild(legend);

    if (!n) return;

    // ===== hover / tooltip =====
    const hover = elt('g', { style:'pointer-events:none' });
    const vline = elt('line', { x1:X0, y1:Y1, x2:X0, y2:Y0, stroke:'#8fa4c6', 'stroke-width':1, 'stroke-opacity':'0.5' });
    const dotT  = elt('circle', { r:4, fill:blue,  stroke:'#0b1a2b', 'stroke-width':1 });
    const dotU  = elt('circle', { r:4, fill:green, stroke:'#0b1a2b', 'stroke-width':1 });

    hover.appendChild(vline);
    hover.appendChild(dotT);
    hover.appendChild(dotU);

    // тултип
    const tip = elt('g');
    const tipBg = elt('rect',{x:0,y:0,rx:6,ry:6,fill:'#0b1a2b',stroke:'#213047','stroke-width':1,opacity:'0.95'});
    const tipL1 = elt('text',{x:10,y:16,fill:'#a5c4f1','font-size':12});
    const tipL2 = elt('text',{x:10,y:34,fill:'#a5c4f1','font-size':12});
    const tipL3 = elt('text',{x:10,y:52,fill:'#a5c4f1','font-size':12});
    tip.appendChild(tipBg);
    tip.appendChild(tipL1);
    tip.appendChild(tipL2);
    tip.appendChild(tipL3);
    hover.appendChild(tip);

    SVG.appendChild(hover);

    const overlay = elt('rect',{
      x:X0, y:Y1, width:(X1-X0), height:(Y0-Y1),
      fill:'transparent',
      style:'cursor:crosshair'
    });
    SVG.appendChild(overlay);

    function handlePos(px){
      if (!n) return;
      const box = SVG.getBoundingClientRect();
      const localX = clamp(px - box.left, X0, X1);
      const rel = (localX - X0) / (X1 - X0);
      const idx = clamp(Math.round(rel * (n - 1)), 0, n - 1);

      const x = scaleX(idx);
      const tVal = yTotal[idx] || 0;
      const uVal = yUnique[idx] || 0;
      const yT = scaleY(tVal);
      const yU = scaleY(uVal);
      const label = xDates[idx] || '';

      vline.setAttribute('x1', x);
      vline.setAttribute('x2', x);
      dotT.setAttribute('cx', x);
      dotT.setAttribute('cy', yT);
      dotU.setAttribute('cx', x);
      dotU.setAttribute('cy', yU);

      tipL1.textContent = label;
      tipL2.textContent = `Всего: ${fmtInt(tVal)}`;
      tipL3.textContent = `Уник.: ${fmtInt(uVal)}`;

      const maxLen = Math.max(tipL1.textContent.length, tipL2.textContent.length, tipL3.textContent.length);
      const tipW = clamp(20 + maxLen * 7.2, 120, 260);
      const tipH = 62;
      tipBg.setAttribute('width', tipW);
      tipBg.setAttribute('height', tipH);

      const center = (X0 + X1) / 2;
      const isRight = x > center;
      const baseX = isRight ? (x - 8 - tipW) : (x + 8);
      const baseY = Math.min(yT, yU) - 10 - tipH;

      const finalX = clamp(baseX, X0, X1 - tipW);
      const finalY = clamp(baseY, Y1, Y0 - tipH);
      tip.setAttribute('transform', `translate(${finalX},${finalY})`);
    }

    function resetTip(){
      vline.setAttribute('x1', X0);
      vline.setAttribute('x2', X0);
      dotT.setAttribute('cx', -9999);
      dotT.setAttribute('cy', -9999);
      dotU.setAttribute('cx', -9999);
      dotU.setAttribute('cy', -9999);
      tip.setAttribute('transform', 'translate(-9999,-9999)');
    }
    resetTip();

    function onMove(e){
      if (e.touches && e.touches.length){
        handlePos(e.touches[0].clientX);
      } else {
        handlePos(e.clientX);
      }
    }

    overlay.addEventListener('mousemove', onMove, { passive:true });
    overlay.addEventListener('touchmove', onMove, { passive:true });
    overlay.addEventListener('mouseenter', onMove, { passive:true });
    overlay.addEventListener('mouseleave', resetTip, { passive:true });
  }

  // ===== presets & wiring =====
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset');
      if (p === 'all') {
        // "Все" — очищаем даты, просим бэкенд сам отдать полный диапазон
        fromEl.value = '';
        toEl.value   = '';
        run();
      } else {
        const days = Number(p) || 7;
        const t = todayIso();
        fromEl.value = addDays(t, -days);
        toEl.value   = t;
        run();
      }
    });
  });

  applyBtn?.addEventListener('click', run);

  fromEl?.addEventListener('change', () => {
    if (toEl.value && fromEl.value > toEl.value) toEl.value = fromEl.value;
  });
  toEl?.addEventListener('change', () => {
    if (fromEl.value && toEl.value < fromEl.value) fromEl.value = toEl.value;
  });

  // если глобальный переключатель HUM меняется — перерисуем график
  try {
    window.addEventListener('adminHumToggle', run);
  } catch (_) {}

  // старт — последние 30 дней
  (function init(){
    const t = todayIso();
    fromEl.value = addDays(t, -30);
    toEl.value   = t;
    run();
  })();
})();
