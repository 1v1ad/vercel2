// admin/chart-range.js — линейный график по произвольному диапазону дат
// Синим — всего авторизаций, зелёным — уникальные HUM.

(function () {
  const SVG = document.getElementById('chart-range');
  if (!SVG) return;

  const fromEl = document.getElementById('range-from');
  const toEl = document.getElementById('range-to');
  const noteEl = document.getElementById('range-note');
  const includeHumEl = document.getElementById('range-include-hum');
  const applyBtn = document.getElementById('range-apply');

  let lastPreset = null; // 'all' | number | null

  // ===== helpers =====

  function apiBase() {
    return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/, '');
  }

  function headers() {
    return window.adminHeaders ? window.adminHeaders() : {};
  }

  function today(tz) {
    const d = new Date();
    if (!tz) return d.toISOString().slice(0, 10);
    try {
      const s = d.toLocaleString('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return s.slice(0, 10);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function addDays(iso, delta) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  function clearSvg() {
    while (SVG.firstChild) SVG.removeChild(SVG.firstChild);
  }

  function svgSize() {
    // Берём размеры из viewBox, если он есть, иначе — из клиентской области
    const vb = SVG.viewBox && SVG.viewBox.baseVal;
    const W = (vb && vb.width) || SVG.clientWidth || 600;
    const H = (vb && vb.height) || SVG.clientHeight || 240;
    SVG.setAttribute('viewBox', `0 0 ${W} ${H}`);
    return { W, H };
  }

  function sEl(tag, attrs, text) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      for (const k in attrs) el.setAttribute(k, attrs[k]);
    }
    if (text != null) el.textContent = text;
    return el;
  }

  // ===== основной запрос + отрисовка =====

  async function run() {
    const API = apiBase();
    if (!API) return;

    const qs = new URLSearchParams({ tz: 'Europe/Moscow' });
    if (fromEl && fromEl.value) qs.set('from', fromEl.value);
    if (toEl && toEl.value) qs.set('to', toEl.value);
    if (includeHumEl)
      qs.set('include_hum', includeHumEl.checked ? '1' : '0');
    if (lastPreset === 'all') qs.set('preset', 'all');

    let data;
    try {
      const res = await fetch(
        API + '/api/admin/range?' + qs.toString(),
        { headers: headers(), cache: 'no-store' },
      );
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!data || !data.ok || !Array.isArray(data.days)) {
      draw([], [], []);
      if (noteEl) noteEl.textContent = 'Нет данных';
      return;
    }

    const days = data.days;
    const labels = days.map((d) => d.date);
    const totals = days.map((d) => Number(d.total) || 0);
    const uniques = days.map((d) => Number(d.unique) || 0);

    draw(labels, totals, uniques);

    if (noteEl) {
      if (days.length) {
        const first = days[0].date;
        const last = days[days.length - 1].date;
        noteEl.textContent = `Показано ${days.length} дней: ${first} — ${last}`;

        // Для пресета "Все" заполняем поля дат из ответа сервера
        if (lastPreset === 'all') {
          if (fromEl) fromEl.value = first;
          if (toEl) toEl.value = last;
        }
      } else {
        noteEl.textContent = 'Нет данных';
      }
    }
  }

  function draw(labels, total, unique) {
    clearSvg();
    const n = labels.length;
    const { W, H } = svgSize();
    const padL = 40;
    const padR = 12;
    const padT = 10;
    const padB = 26;

    // Даже при отсутствии данных оставим оси
    SVG.appendChild(
      sEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }),
    );
    SVG.appendChild(
      sEl('line', {
        x1: padL,
        y1: padT,
        x2: padL,
        y2: H - padB,
        stroke: '#23324a',
        'stroke-width': 1,
      }),
    );
    SVG.appendChild(
      sEl('line', {
        x1: padL,
        y1: H - padB,
        x2: W - padR,
        y2: H - padB,
        stroke: '#23324a',
        'stroke-width': 1,
      }),
    );

    if (!n) return;

    const maxY = Math.max(
      1,
      Math.max(...total),
      Math.max(...unique),
    );
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const scaleX = (i) =>
      padL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
    const scaleY = (v) =>
      padT + (maxY === 0 ? plotH : plotH - (v / maxY) * plotH);

    // горизонтальная сетка + подписи по Y
    const gridSteps = 4;
    for (let i = 1; i <= gridSteps; i++) {
      const v = (maxY * i) / gridSteps;
      const y = scaleY(v);
      SVG.appendChild(
        sEl('line', {
          x1: padL,
          y1: y,
          x2: W - padR,
          y2: y,
          stroke: '#1b2738',
          'stroke-width': 1,
          'stroke-dasharray': '3 3',
        }),
      );
      SVG.appendChild(
        sEl(
          'text',
          {
            x: padL - 4,
            y: y + 4,
            'text-anchor': 'end',
            fill: '#8fa4c6',
            'font-size': '10',
          },
          String(Math.round(v)),
        ),
      );
    }

    // подписи по X
    const ticks = Math.min(6, Math.max(2, n));
    for (let i = 0; i < ticks; i++) {
      const idx = Math.round((i * (n - 1)) / (ticks - 1));
      const x = scaleX(idx);
      SVG.appendChild(
        sEl(
          'text',
          {
            x,
            y: H - 6,
            fill: '#8fa4c6',
            'font-size': '10',
            'text-anchor':
              i === 0 ? 'start' : i === ticks - 1 ? 'end' : 'middle',
          },
          labels[idx] || '',
        ),
      );
    }

    function pathFor(arr) {
      let d = '';
      for (let i = 0; i < n; i++) {
        const x = scaleX(i);
        const y = scaleY(arr[i] || 0);
        d += (i ? 'L' : 'M') + x + ' ' + y + ' ';
      }
      return d;
    }

    // линии
    SVG.appendChild(
      sEl('path', {
        d: pathFor(total),
        fill: 'none',
        stroke: '#4b7bec',
        'stroke-width': 2,
      }),
    );
    SVG.appendChild(
      sEl('path', {
        d: pathFor(unique),
        fill: 'none',
        stroke: '#20bf6b',
        'stroke-width': 2,
      }),
    );

    // точки
    function drawDots(arr, color) {
      for (let i = 0; i < n; i++) {
        const x = scaleX(i);
        const y = scaleY(arr[i] || 0);
        SVG.appendChild(
          sEl('circle', {
            cx: x,
            cy: y,
            r: 3,
            fill: color,
            stroke: '#0b1020',
            'stroke-width': 1,
          }),
        );
      }
    }
    drawDots(total, '#4b7bec');
    drawDots(unique, '#20bf6b');
  }

  // ===== обработчики кнопок и инпутов =====

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset');
      if (p === 'all') {
        lastPreset = 'all';
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';
        run();
      } else {
        const days = Number(p) || 0;
        lastPreset = days || null;
        const tz = 'Europe/Moscow';
        const t = today(tz);
        if (fromEl) fromEl.value = addDays(t, -days);
        if (toEl) toEl.value = t;
        run();
      }
    });
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      lastPreset = null;
      run();
    });
  }

  if (includeHumEl) {
    includeHumEl.addEventListener('change', () => {
      lastPreset = null;
      run();
    });
  }

  if (fromEl) {
    fromEl.addEventListener('change', () => {
      if (toEl && toEl.value && fromEl.value > toEl.value) {
        toEl.value = fromEl.value;
      }
      lastPreset = null;
    });
  }

  if (toEl) {
    toEl.addEventListener('change', () => {
      if (fromEl && fromEl.value && toEl.value < fromEl.value) {
        fromEl.value = toEl.value;
      }
      lastPreset = null;
    });
  }

  // старт: 30 дней от «сегодня»
  (function init() {
    const tz = 'Europe/Moscow';
    const t = today(tz);
    if (fromEl) fromEl.value = addDays(t, -30);
    if (toEl) toEl.value = t;
    lastPreset = 30;
    run();
  })();
})();
