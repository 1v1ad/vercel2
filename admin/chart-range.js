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

  // ---- helpers ----

  function apiBase() {
    const raw = (localStorage.getItem('ADMIN_API') || '').toString().trim();
    if (raw) return raw.replace(/\/+$/, '');
    return location.origin;
  }

  function headers() {
    return window.adminHeaders ? window.adminHeaders() : {};
  }

  function clearSvg() {
    while (SVG.firstChild) SVG.removeChild(SVG.firstChild);
  }

  function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }

  function addDays(iso, delta) {
    if (!iso) return todayIso();
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    dt.setUTCDate(dt.getUTCDate() + delta);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  function parseDays(data) {
    if (!Array.isArray(data)) return [];
    return data
      .map(row => {
        const dateStr = row.date || row.day || row.d;
        if (!dateStr) return null;
        const t = Date.parse(dateStr);
        if (!isFinite(t)) return null;
        const total = Number(row.total ?? row.auth_total ?? row.auth ?? 0) || 0;
        const unique = Number(row.unique ?? row.unique_hum ?? row.unique_users ?? 0) || 0;
        return { t, date: dateStr.slice(0, 10), total, unique };
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
  }

  function createSvg(tag, attrs, text) {
    const el = document.createElementNS(NS, tag);
    if (attrs) {
      for (const k in attrs) el.setAttribute(k, String(attrs[k]));
    }
    if (text != null) el.appendChild(document.createTextNode(text));
    return el;
  }

  function draw(daysRaw) {
    clearSvg();

    const days = parseDays(daysRaw);
    SVG.setAttribute('viewBox', '0 0 640 320');
    SVG.setAttribute('preserveAspectRatio', 'none');

    if (!days.length) {
      if (noteEl) noteEl.textContent = 'Нет данных за выбранный период';
      return;
    }

    const padding = { left: 50, right: 10, top: 10, bottom: 30 };
    const innerW = 640 - padding.left - padding.right;
    const innerH = 320 - padding.top - padding.bottom;

    const xs = days.map(d => d.t);
    const ys = days.map(d => Math.max(d.total, d.unique));

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = 0;
    const maxY = Math.max(1, Math.max(...ys));

    function xPix(t) {
      if (maxX === minX) return padding.left + innerW / 2;
      return padding.left + (innerW * (t - minX)) / (maxX - minX);
    }

    function yPix(v) {
      if (maxY === minY) return padding.top + innerH / 2;
      return padding.top + innerH - (innerH * (v - minY)) / (maxY - minY);
    }

    const axis = createSvg('g', { class: 'axis' });
    // X-axis
    axis.appendChild(
      createSvg('line', {
        x1: padding.left,
        y1: padding.top + innerH,
        x2: padding.left + innerW,
        y2: padding.top + innerH,
        stroke: '#6c7a89',
        'stroke-width': 1
      })
    );
    // Y-axis
    axis.appendChild(
      createSvg('line', {
        x1: padding.left,
        y1: padding.top,
        x2: padding.left,
        y2: padding.top + innerH,
        stroke: '#6c7a89',
        'stroke-width': 1
      })
    );

    const maxTicks = 5;
    for (let i = 1; i <= maxTicks; i++) {
      const v = (maxY * i) / maxTicks;
      const y = yPix(v);
      axis.appendChild(
        createSvg('line', {
          x1: padding.left,
          y1: y,
          x2: padding.left + innerW,
          y2: y,
          stroke: '#2c3e50',
          'stroke-width': 0.5,
          'stroke-dasharray': '4 4'
        })
      );
      axis.appendChild(
        createSvg(
          'text',
          {
            x: padding.left - 6,
            y: y + 4,
            'text-anchor': 'end',
            'font-size': 10,
            fill: '#b0bac8'
          },
          String(Math.round(v))
        )
      );
    }

    SVG.appendChild(axis);

    function buildPath(getY) {
      let d = '';
      days.forEach((row, idx) => {
        const x = xPix(row.t);
        const y = getY(row);
        d += `${idx === 0 ? 'M' : 'L'}${x},${y}`;
      });
      return d;
    }

    const pathTotal = createSvg('path', {
      d: buildPath(r => yPix(r.total)),
      fill: 'none',
      stroke: '#2e86de',
      'stroke-width': 2
    });
    const pathUnique = createSvg('path', {
      d: buildPath(r => yPix(r.unique)),
      fill: 'none',
      stroke: '#2ecc71',
      'stroke-width': 2
    });

    SVG.appendChild(pathTotal);
    SVG.appendChild(pathUnique);

    const pointsGroup = createSvg('g', { class: 'points' });
    const pointPixels = [];

    days.forEach(row => {
      const x = xPix(row.t);
      const yTotal = yPix(row.total);
      const yUnique = yPix(row.unique);
      pointPixels.push({ x, yTotal, yUnique, row });

      const c1 = createSvg('circle', {
        cx: x,
        cy: yTotal,
        r: 3,
        fill: '#2e86de'
      });
      c1.appendChild(
        createSvg('title', null, `${row.date}: всего ${row.total}`)
      );

      const c2 = createSvg('circle', {
        cx: x,
        cy: yUnique,
        r: 3,
        fill: '#2ecc71'
      });
      c2.appendChild(
        createSvg('title', null, `${row.date}: уникальных HUM ${row.unique}`)
      );

      pointsGroup.appendChild(c1);
      pointsGroup.appendChild(c2);
    });

    SVG.appendChild(pointsGroup);

    const hoverGroup = createSvg('g', { class: 'hover' });
    const hoverLine = createSvg('line', {
      x1: 0,
      y1: padding.top,
      x2: 0,
      y2: padding.top + innerH,
      stroke: '#ffffff',
      'stroke-width': 1,
      'stroke-dasharray': '4 2',
      opacity: 0
    });
    const hoverTotal = createSvg('circle', {
      r: 4,
      fill: '#ffffff',
      stroke: '#2e86de',
      'stroke-width': 2,
      opacity: 0
    });
    const hoverUnique = createSvg('circle', {
      r: 4,
      fill: '#ffffff',
      stroke: '#2ecc71',
      'stroke-width': 2,
      opacity: 0
    });

    hoverGroup.appendChild(hoverLine);
    hoverGroup.appendChild(hoverTotal);
    hoverGroup.appendChild(hoverUnique);
    SVG.appendChild(hoverGroup);

    const hitRect = createSvg('rect', {
      x: padding.left,
      y: padding.top,
      width: innerW,
      height: innerH,
      fill: 'transparent',
      'pointer-events': 'all'
    });
    SVG.appendChild(hitRect);

    function findNearestPoint(x) {
      if (!pointPixels.length) return null;
      let best = pointPixels[0];
      let bestDist = Math.abs(best.x - x);
      for (let i = 1; i < pointPixels.length; i++) {
        const p = pointPixels[i];
        const d = Math.abs(p.x - x);
        if (d < bestDist) {
          best = p;
          bestDist = d;
        }
      }
      return best;
    }

    hitRect.addEventListener('mousemove', function (e) {
      const rect = SVG.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const p = findNearestPoint(x);
      if (!p) return;

      hoverLine.setAttribute('x1', p.x);
      hoverLine.setAttribute('x2', p.x);
      hoverLine.setAttribute('opacity', '0.8');

      hoverTotal.setAttribute('cx', p.x);
      hoverTotal.setAttribute('cy', p.yTotal);
      hoverTotal.setAttribute('opacity', '1');

      hoverUnique.setAttribute('cx', p.x);
      hoverUnique.setAttribute('cy', p.yUnique);
      hoverUnique.setAttribute('opacity', '1');
    });

    hitRect.addEventListener('mouseleave', function () {
      hoverLine.setAttribute('opacity', '0');
      hoverTotal.setAttribute('opacity', '0');
      hoverUnique.setAttribute('opacity', '0');
    });
  }

  // ===== fetch & draw =====
  async function run(){
    const API = apiBase();
    if (!API) return;

    const qs = new URLSearchParams({ tz: TZ });
    if (fromEl.value) qs.set('from', fromEl.value);
    if (toEl.value)   qs.set('to',   toEl.value);

    const humFlag = window.getAdminHumFlag ? (window.getAdminHumFlag() ? '1' : '0') : '1';
    qs.set('include_hum', humFlag);

    if (noteEl) noteEl.textContent = 'Загружаем...';
    clearSvg();

    let payload;
    try {
      const r = await fetch(API + '/api/admin/range?' + qs.toString(), {
        headers: headers(),
        cache: 'no-store'
      });
      payload = await r.json();
    } catch (e) {
      if (noteEl) noteEl.textContent = 'Ошибка загрузки';
      return;
    }

    if (!payload || payload.ok === false) {
      if (noteEl) noteEl.textContent = (payload && payload.error) || 'Нет данных';
      return;
    }

    const days = Array.isArray(payload.days)
      ? payload.days
      : (Array.isArray(payload.range) ? payload.range : []);

    draw(days);

    if (noteEl) {
      if (payload.range_note) {
        noteEl.textContent = payload.range_note;
      } else {
        const fromText = fromEl.value || '—';
        const toText = toEl.value || '—';
        noteEl.textContent = `Период: ${fromText} — ${toText}, дней: ${days.length}`;
      }
    }
  }

  // кнопка "Применить"
  applyBtn?.addEventListener('click', (ev) => {
    ev.preventDefault();
    run();
  });

  // контроль, чтобы from <= to
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
