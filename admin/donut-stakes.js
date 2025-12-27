// admin/donut-stakes.js — donuts: duels by stake (count) + turnover by stake (₽)
(function(){
  const svgCount = document.getElementById('donut-stakes-count');
  const svgTurn  = document.getElementById('donut-stakes-turnover');
  const legCount = document.getElementById('donut-stakes-count-legend');
  const legTurn  = document.getElementById('donut-stakes-turnover-legend');
  const ctrCount = document.getElementById('donut-stakes-count-center');
  const ctrTurn  = document.getElementById('donut-stakes-turnover-center');
  const noteEl   = document.getElementById('stakes-note');

  if (!svgCount || !svgTurn || !legCount || !legTurn || !ctrCount || !ctrTurn) return;

  const fromEl = document.getElementById('duels-from');
  const toEl   = document.getElementById('duels-to');

  const NS = 'http://www.w3.org/2000/svg';
  const TZ_FALLBACK = 'Europe/Moscow';

  function apiBase(){
    return (localStorage.getItem('ADMIN_API') || window.API || '').toString().trim().replace(/\/+$/,'');
  }
  function headers(){
    return window.adminHeaders ? window.adminHeaders() : {};
  }
  function tz(){
    return (localStorage.getItem('ADMIN_TZ') || TZ_FALLBACK);
  }

  function toBigIntSafe(x){
    try{
      if (typeof x === 'bigint') return x;
      if (x === null || x === undefined) return 0n;
      const s = String(x).trim();
      if (!s) return 0n;
      if (/^-?\d+$/.test(s)) return BigInt(s);
      // strip separators
      const t = s.replace(/[^\d\-]/g,'');
      if (!t || t === '-') return 0n;
      return BigInt(t);
    }catch(_){ return 0n; }
  }

  function fmtInt(x){
    const n = Number(x) || 0;
    return n.toLocaleString('ru-RU');
  }
  function fmtRubBig(x){
    const bi = toBigIntSafe(x);
    const sign = bi < 0n ? '-' : '';
    const abs = bi < 0n ? -bi : bi;
    const chars = abs.toString().split('');
    let out = '';
    for (let i = 0; i < chars.length; i++){
      const j = chars.length - i;
      out += chars[i];
      if (j > 1 && (j - 1) % 3 === 0) out += ' ';
    }
    return sign + out + ' ₽';
  }
  function fmtBig(x){
    const bi = toBigIntSafe(x);
    const sign = bi < 0n ? '-' : '';
    const abs = bi < 0n ? -bi : bi;
    const chars = abs.toString().split('');
    let out = '';
    for (let i = 0; i < chars.length; i++){
      const j = chars.length - i;
      out += chars[i];
      if (j > 1 && (j - 1) % 3 === 0) out += ' ';
    }
    return sign + out;
  }

  function digitsBigInt(bi){
    const a = bi < 0n ? -bi : bi;
    return a.toString().length;
  }

  // Convert bigints to comparable Numbers for chart math (ratios) without overflow:
  // scale all values by 10^drop so numbers stay <= ~1e15.
  function pickScaleDiv(bigints){
    let max = 0n;
    (bigints || []).forEach(b => {
      const a = b < 0n ? -b : b;
      if (a > max) max = a;
    });
    const maxDigits = digitsBigInt(max);
    const drop = Math.max(0, maxDigits - 15);
    const div = 10n ** BigInt(drop);
    return { drop, div };
  }

  function clearSvg(svg){
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }
  function elt(tag, attrs){
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function pickColors(n){
    const vars = ['--seg1','--seg2','--seg3','--seg4','--seg5','--seg6','--seg7','--seg8'];
    const root = getComputedStyle(document.documentElement);
    const arr = [];
    for (let i=0;i<n;i++){
      const v = vars[i % vars.length];
      const c = root.getPropertyValue(v).trim() || '#4dabf7';
      arr.push(c);
    }
    return arr;
  }

  function drawDonut(svg, data, total, centerEl, legendEl, valueFormatter, subLabel){
    clearSvg(svg);
    legendEl.innerHTML = '';

    const R = 40;
    const C = 2 * Math.PI * R;

    // track
    const track = elt('circle', {
      cx: 50, cy: 50, r: R,
      fill: 'none',
      stroke: 'rgba(255,255,255,0.08)',
      'stroke-width': 18
    });
    svg.appendChild(track);

    const nonZero = data.filter(x => (x.valueNum > 0));
    if (!nonZero.length || total <= 0){
      centerEl.innerHTML = `—<span class="sub">${subLabel || ''}</span>`;
      return;
    }

    const colors = pickColors(nonZero.length);
    let offset = 0;

    nonZero.forEach((it, idx) => {
      const frac = it.valueNum / total;
      const seg  = Math.max(0, C * frac);

      // circle segment
      const c = elt('circle', {
        cx: 50, cy: 50, r: R,
        fill: 'none',
        stroke: colors[idx],
        'stroke-width': 18,
        'stroke-dasharray': `${seg} ${C}`,
        'stroke-dashoffset': String(-offset),
        'transform': 'rotate(-90 50 50)',
      });
      c.style.cursor = 'default';
      c.appendChild(elt('title'));
      c.lastChild.textContent = `${it.label}: ${valueFormatter(it.valueRaw)} (${Math.round(frac*100)}%)`;
      svg.appendChild(c);

      offset += seg;
    });

    // center
    centerEl.innerHTML = `${valueFormatter(total)}<span class="sub">${subLabel || ''}</span>`;

    // legend
    nonZero.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'donut-leg-row';

      const dot = document.createElement('span');
      dot.className = 'donut-dot';
      dot.style.background = colors[idx];

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = it.label;

      const val = document.createElement('span');
      val.className = 'val';
      const pct = Math.round((it.valueNum / total) * 100);
      val.textContent = `${valueFormatter(it.valueRaw)} • ${pct}%`;

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(val);

      legendEl.appendChild(row);
    });
  }

  function normalizeItems(items){
    const pref = [100, 250, 500, 1000, 2500];
    const map = new Map();
    (items || []).forEach(r => {
      const stake = (r.stake === null || r.stake === undefined) ? null : Number(r.stake);
      const key = (stake === null || !Number.isFinite(stake)) ? 'vip' : String(stake);
      if (!map.has(key)) map.set(key, { stake, duels_count: 0, turnover: 0n });
      const cur = map.get(key);
      cur.duels_count += Number(r.duels_count || 0);
      cur.turnover += toBigIntSafe(r.turnover);
    });

    const out = [];
    // preferred stakes
    pref.forEach(s => {
      const key = String(s);
      if (map.has(key)){
        const v = map.get(key);
        out.push({ label: `${s} ₽`, stake: s, duels_count: v.duels_count, turnover: v.turnover });
        map.delete(key);
      }
    });

    // remaining numeric stakes
    const restNum = [];
    let vip = null;
    map.forEach((v, k) => {
      if (k === 'vip') { vip = v; return; }
      const s = Number(v.stake);
      if (Number.isFinite(s)) restNum.push({ label: `${s} ₽`, stake: s, duels_count: v.duels_count, turnover: v.turnover });
    });
    restNum.sort((a,b)=> (a.stake||0) - (b.stake||0));
    out.push(...restNum);

    // VIP / other
    if (vip){
      out.push({ label: 'VIP', stake: 0, duels_count: vip.duels_count, turnover: vip.turnover });
    }

    return out;
  }

  async function load(){
    const API = apiBase();
    if (!API) return;

    let fromV = (fromEl?.value || '').trim();
    let toV   = (toEl?.value || '').trim();
    if (fromV && toV && fromV > toV) { const t = fromV; fromV = toV; toV = t; }

    const qs = new URLSearchParams({ tz: tz() });
    if (fromV) qs.set('from', fromV);
    if (toV)   qs.set('to', toV);

    let j;
    try{
      const r = await fetch(API + '/api/admin/analytics/duels/stakes?' + qs.toString(), {
        headers: headers(),
        cache: 'no-store'
      });
      j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || ('http_' + r.status));
    }catch(e){
      console.error('donut-stakes load error', e);
      if (noteEl) noteEl.textContent = 'Ошибка загрузки';
      clearSvg(svgCount); clearSvg(svgTurn);
      legCount.innerHTML = ''; legTurn.innerHTML = '';
      ctrCount.innerHTML = '—';
      ctrTurn.innerHTML  = '—';
      return;
    }

    const items = normalizeItems(Array.isArray(j?.items) ? j.items : []);
    const totalCount = items.reduce((a,b)=> a + (Number(b.duels_count)||0), 0);
    const totalTurn  = items.reduce((a,b)=> a + toBigIntSafe(b.turnover), 0n);

    if (noteEl){
      const trunc = j?.truncated ? ' • (период укорочен)' : '';
      if (j?.from && j?.to) noteEl.textContent = `Период: ${String(j.from).slice(0,10)} – ${String(j.to).slice(0,10)}${trunc}`;
      else noteEl.textContent = 'Нет данных';
    }

    // build datasets
    const dataCount = items.map(it => ({
      label: it.label,
      valueNum: Number(it.duels_count)||0,
      valueRaw: Number(it.duels_count)||0
    }));
    const turnBigs = items.map(it => toBigIntSafe(it.turnover)).concat([totalTurn]);
    const scale = pickScaleDiv(turnBigs);
    const toScaled = (bi) => {
      const b = toBigIntSafe(bi);
      return Number(b / scale.div); // ratios are preserved under common scaling
    };

    const dataTurn = items.map(it => ({
      label: it.label,
      valueNum: toScaled(it.turnover),
      valueRaw: it.turnover
    }));

    drawDonut(
      svgCount,
      dataCount,
      totalCount,
      ctrCount,
      legCount,
      (v)=> fmtInt(v),
      'шт'
    );

    drawDonut(
      svgTurn,
      dataTurn,
      toScaled(totalTurn),
      ctrTurn,
      legTurn,
      (v)=> (typeof v === 'bigint' ? fmtRubBig(v) : fmtRubBig(v)),
      '₽'
    );

    // override center of turnover with BigInt display (avoid Number overflow)
    ctrTurn.innerHTML = `${fmtBig(totalTurn)}<span class="sub">₽</span>`;
  }

  // ===== wiring =====
  const schedule = () => setTimeout(load, 0);

  document.getElementById('duels-apply')?.addEventListener('click', load);
  fromEl?.addEventListener('change', schedule);
  toEl?.addEventListener('change', schedule);

  // preset buttons inside duels panel (capture phase, same spirit as chart-duels.js)
  document.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('.chip,[data-duel-preset],[data-duels-preset],[data-preset]');
    if (!btn) return;
    const panel = btn.closest?.('.panel');
    if (!panel || !panel.querySelector?.('#chart-duels')) return;
    schedule();
  }, true);

  try{ window.addEventListener('adminApiChanged', load); } catch(_){}
  load();
})();
