// admin/chart-duels.js — big duels chart (games + turnover + rake)
// Reads: GET /api/admin/duels_range?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Europe/Moscow
// Draws: bars = number of finished duels; line = turnover (pot sum). Tooltip also shows rake.

(() => {
  const svg = document.getElementById('chart-duels');
  const note = document.getElementById('duels-note');
  const inpFrom = document.getElementById('duels-from');
  const inpTo = document.getElementById('duels-to');
  const btnApply = document.getElementById('duels-apply');

  if (!svg || !note || !inpFrom || !inpTo || !btnApply) return;

  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const ymd = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

  function fmtInt(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '0';
    return Math.round(n).toLocaleString('ru-RU');
  }
  function fmtMoney(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '0';
    return Math.round(n).toLocaleString('ru-RU');
  }

  function clearSvg() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function el(name, attrs = {}, children = []) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      e.setAttribute(k, String(v));
    }
    for (const c of children) e.appendChild(c);
    return e;
  }

  // Tooltip (div over svg)
  const tip = document.createElement('div');
  tip.style.position = 'absolute';
  tip.style.pointerEvents = 'none';
  tip.style.zIndex = '50';
  tip.style.display = 'none';
  tip.style.padding = '8px 10px';
  tip.style.border = '1px solid rgba(255,255,255,0.14)';
  tip.style.borderRadius = '10px';
  tip.style.background = 'rgba(8, 12, 18, 0.92)';
  tip.style.backdropFilter = 'blur(6px)';
  tip.style.color = 'rgba(255,255,255,0.92)';
  tip.style.fontSize = '12px';
  tip.style.lineHeight = '1.25';
  tip.style.whiteSpace = 'nowrap';

  const wrap = svg.parentElement;
  wrap.style.position = 'relative';
  wrap.appendChild(tip);

  function setTip(x, y, html) {
    tip.innerHTML = html;
    tip.style.display = 'block';

    const rect = wrap.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let left = x + 12;
    let top = y - 12;
    if (left + tipRect.width > rect.width - 6) left = x - tipRect.width - 12;
    if (top + tipRect.height > rect.height - 6) top = rect.height - tipRect.height - 6;
    if (top < 6) top = 6;

    tip.style.left = `${Math.max(6, left)}px`;
    tip.style.top = `${Math.max(6, top)}px`;
  }

  function hideTip() {
    tip.style.display = 'none';
  }

  function niceMax(n) {
    const v = Number(n || 0);
    if (!Number.isFinite(v) || v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const x = v / pow;
    const m = x <= 1 ? 1 : x <= 2 ? 2 : x <= 5 ? 5 : 10;
    return m * pow;
  }

  function draw(days) {
    clearSvg();
    hideTip();

    const w = svg.clientWidth || 900;
    const h = svg.clientHeight || 260;

    const L = 44;
    const R = 64;
    const T = 28;
    const B = 34;
    const X0 = L;
    const X1 = w - R;
    const Y0 = h - B;
    const Y1 = T;
    const PW = Math.max(1, X1 - X0);
    const PH = Math.max(1, Y0 - Y1);

    const games = days.map((d) => Number(d.games || 0));
    const turnover = days.map((d) => Number(d.turnover || 0));
    const rake = days.map((d) => Number(d.rake || 0));

    const maxGames = niceMax(Math.max(1, ...games));
    const maxTurn = niceMax(Math.max(1, ...turnover));

    const sx = (i) => {
      if (days.length <= 1) return X0 + PW / 2;
      return X0 + (i * PW) / (days.length - 1);
    };
    const syGames = (v) => Y0 - (Math.max(0, v) * PH) / maxGames;
    const syTurn = (v) => Y0 - (Math.max(0, v) * PH) / maxTurn;

    const grid = el('g');
    svg.appendChild(grid);

    // grid lines + dual labels
    for (let k = 0; k <= 4; k++) {
      const y = Y0 - (k * PH) / 4;
      grid.appendChild(
        el('line', {
          x1: X0,
          y1: y,
          x2: X1,
          y2: y,
          stroke: 'rgba(255,255,255,0.08)',
          'stroke-width': 1,
        })
      );

      const vg = Math.round((maxGames * k) / 4);
      const vt = Math.round((maxTurn * k) / 4);

      grid.appendChild(
        el(
          'text',
          { x: X0 - 8, y: y + 4, 'text-anchor': 'end', fill: 'rgba(255,255,255,0.55)', 'font-size': 11 },
          [document.createTextNode(String(vg))]
        )
      );
      grid.appendChild(
        el(
          'text',
          { x: X1 + 8, y: y + 4, 'text-anchor': 'start', fill: 'rgba(255,255,255,0.55)', 'font-size': 11 },
          [document.createTextNode(fmtMoney(vt))]
        )
      );
    }

    // x labels (sparse)
    const every = days.length <= 8 ? 1 : days.length <= 31 ? 4 : 7;
    for (let i = 0; i < days.length; i++) {
      if (i % every !== 0 && i !== days.length - 1) continue;
      const x = sx(i);
      grid.appendChild(
        el('text', { x, y: h - 10, 'text-anchor': 'middle', fill: 'rgba(255,255,255,0.55)', 'font-size': 11 }, [
          document.createTextNode(days[i].date),
        ])
      );
    }

    // legend
    const legend = el('g', { transform: `translate(${X0},${Y1 - 12})` });
    legend.appendChild(el('rect', { x: 0, y: 0, width: 8, height: 8, rx: 2, fill: 'rgba(78, 209, 169, 0.95)' }));
    legend.appendChild(
      el('text', { x: 12, y: 8, fill: 'rgba(255,255,255,0.8)', 'font-size': 12 }, [document.createTextNode('Дуэлей')])
    );
    legend.appendChild(
      el('line', { x1: 74, y1: 4, x2: 86, y2: 4, stroke: 'rgba(10, 132, 255, 0.95)', 'stroke-width': 2 })
    );
    legend.appendChild(
      el('text', { x: 92, y: 8, fill: 'rgba(255,255,255,0.8)', 'font-size': 12 }, [document.createTextNode('Оборот')])
    );
    svg.appendChild(legend);

    // bars (games)
    const barW = Math.max(6, Math.min(18, (PW / Math.max(1, days.length)) * 0.8));
    const bars = el('g');
    for (let i = 0; i < days.length; i++) {
      const x = sx(i);
      const v = games[i] || 0;
      const y = syGames(v);
      bars.appendChild(
        el('rect', {
          x: x - barW / 2,
          y,
          width: barW,
          height: Math.max(0, Y0 - y),
          rx: 3,
          fill: 'rgba(78, 209, 169, 0.42)',
          stroke: 'rgba(78, 209, 169, 0.75)',
          'stroke-width': 1,
        })
      );
    }
    svg.appendChild(bars);

    // line (turnover)
    let dPath = '';
    for (let i = 0; i < days.length; i++) {
      const x = sx(i);
      const y = syTurn(turnover[i] || 0);
      dPath += (i === 0 ? 'M' : 'L') + `${x.toFixed(2)},${y.toFixed(2)}`;
    }
    svg.appendChild(el('path', { d: dPath, fill: 'none', stroke: 'rgba(10, 132, 255, 0.95)', 'stroke-width': 2 }));

    // hover helpers
    const vLine = el('line', {
      x1: X0,
      y1: Y1,
      x2: X0,
      y2: Y0,
      stroke: 'rgba(255,255,255,0.16)',
      'stroke-width': 1,
      opacity: 0,
    });
    const dot = el('circle', { cx: X0, cy: Y0, r: 4, fill: 'rgba(10, 132, 255, 0.95)', opacity: 0 });
    svg.appendChild(vLine);
    svg.appendChild(dot);

    const hit = el('rect', { x: X0, y: Y1, width: PW, height: PH, fill: 'transparent' });
    svg.appendChild(hit);

    function onMove(ev) {
      const rect = svg.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;

      let idx = 0;
      if (days.length > 1) {
        const t = (mx - X0) / PW;
        idx = Math.round(t * (days.length - 1));
        idx = Math.max(0, Math.min(days.length - 1, idx));
      }

      const x = sx(idx);
      const y = syTurn(turnover[idx] || 0);

      vLine.setAttribute('x1', x);
      vLine.setAttribute('x2', x);
      vLine.setAttribute('opacity', '1');

      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      dot.setAttribute('opacity', '1');

      const html = `
        <div style="font-weight:600;margin-bottom:4px;">${days[idx].date}</div>
        <div>Дуэлей: <b>${fmtInt(games[idx] || 0)}</b></div>
        <div>Оборот: <b>${fmtMoney(turnover[idx] || 0)}</b></div>
        <div style="opacity:.85;">Рейк: <b>${fmtMoney(rake[idx] || 0)}</b></div>
      `;
      setTip(mx, my, html);
    }

    function onLeave() {
      vLine.setAttribute('opacity', '0');
      dot.setAttribute('opacity', '0');
      hideTip();
    }

    hit.addEventListener('mousemove', onMove);
    hit.addEventListener('mouseleave', onLeave);
  }

  async function load() {
    try {
      note.textContent = 'Загрузка…';

      const API = (localStorage.getItem('admin_api') || '').trim();
      const urlBase = (API || '').replace(/\/$/, '');
      if (!urlBase) {
        note.textContent = 'API не задан';
        return;
      }

      const tz = 'Europe/Moscow';
      const qs = new URLSearchParams();
      qs.set('tz', tz);
      if (inpFrom.value) qs.set('from', inpFrom.value);
      if (inpTo.value) qs.set('to', inpTo.value);

      const r = await fetch(urlBase + '/api/admin/duels_range?' + qs.toString(), {
        headers: window.adminHeaders ? window.adminHeaders() : {},
      });
      const j = await r.json().catch(() => null);
      if (!j || !j.ok) {
        note.textContent = 'Ошибка загрузки';
        return;
      }

      // If user clicked "Всё" we clear inputs; server can respond with actual bounds.
      // Fill them back so it is visually obvious that "Всё" worked and so Apply reuses the full range.
      if ((!inpFrom.value || !inpTo.value) && (j.from || j.to)) {
        if (!inpFrom.value && j.from) inpFrom.value = String(j.from).slice(0, 10);
        if (!inpTo.value && j.to) inpTo.value = String(j.to).slice(0, 10);
      }

      const days = Array.isArray(j.days) ? j.days : [];
      draw(days);

      const from = j.from || inpFrom.value || '';
      const to = j.to || inpTo.value || '';
      note.textContent = `Период: ${from} – ${to} • дней: ${days.length || 0}`;
    } catch (e) {
      console.error(e);
      note.textContent = 'Ошибка загрузки';
    }
  }

  function normPreset(p, btnText) {
    const raw = (p || '').toString().trim().toLowerCase();
    if (raw === 'all' || raw === 'alltime' || raw === '*' || raw === '0') return 'all';
    if (!raw) {
      const t = (btnText || '').toString().trim().toLowerCase();
      if (t === 'всё' || t === 'все' || t.startsWith('вс')) return 'all';
      return '';
    }
    return raw;
  }

  function setPreset(days) {
    // Use today's local date; backend applies TZ.
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const p = (days || '').toString().trim().toLowerCase();
    if (p === 'all' || p === 'alltime' || p === '*' || p === '0' || p === 'всё' || p === 'все') {
      inpFrom.value = '';
      inpTo.value = '';
      return;
    }

    const n = Number(p);
    const to = today;
    const from = new Date(to.getTime() - (Math.max(1, n) - 1) * 24 * 60 * 60 * 1000);
    inpFrom.value = ymd(from);
    inpTo.value = ymd(to);
  }

  // Be tolerant: sometimes the "Всё" button gets a different data-attribute after merges.
  document.querySelectorAll('[data-duel-preset],[data-duels-preset]').forEach((b) => {
    b.addEventListener('click', () => {
      const p = normPreset(b.getAttribute('data-duel-preset') || b.getAttribute('data-duels-preset'), b.textContent);
      if (!p) return;
      setPreset(p);
      load();
    });
  });
  btnApply.addEventListener('click', () => load());

  // keep date order sane
  inpFrom.addEventListener('change', () => {
    if (inpTo.value && inpFrom.value > inpTo.value) inpTo.value = inpFrom.value;
  });
  inpTo.addEventListener('change', () => {
    if (inpFrom.value && inpTo.value < inpFrom.value) inpFrom.value = inpTo.value;
  });

  // reload when API saved (admin2 fires this)
  try {
    window.addEventListener('adminApiChanged', load);
  } catch (_) {}

  // default: 30 days
  setPreset('30');
  load();
})();
