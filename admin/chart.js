// admin/chart.js — график за 7 дней, сегодня справа, с подписями над столбцами

(function () {
  const API = (window.API || localStorage.getItem('ADMIN_API') || '').replace(/\/+$/, '');
  const getHeaders = (window.adminHeaders ? window.adminHeaders : () => ({}));

  // Плагин: вывод чисел над столбиками
  const valueLabelPlugin = {
    id: 'valueLabel',
    afterDatasetsDraw(chart, args, pluginOptions) {
      const { ctx, data } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = (pluginOptions && pluginOptions.color) || '#aeb6c2';
      ctx.font =
        (pluginOptions && pluginOptions.font) ||
        '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, "Noto Sans", sans-serif';

      data.datasets.forEach((ds, dsIndex) => {
        const meta = chart.getDatasetMeta(dsIndex);
        meta.data.forEach((bar, i) => {
          const val = ds.data[i];
          if (!val || !isFinite(val)) return;
          const x = bar.x;
          const y = bar.y - 6; // отступ над столбиком
          ctx.fillText(String(val), x, y);
        });
      });
      ctx.restore();
    },
  };

  // Регистрируем плагин один раз
  try {
    if (!Chart.registry.plugins.get('valueLabel')) {
      Chart.register(valueLabelPlugin);
    }
  } catch (_) {
    // Если Chart ещё не загружен — просто не падаем
  }

  let visitsChart = null;

  async function fetchDaily(days = 7) {
    const url = `${API}/api/admin/summary/daily?days=${days}`;
    const r = await fetch(url, { headers: getHeaders(), cache: 'no-store' });
    if (!r.ok) throw new Error(`daily fetch failed: ${r.status}`);
    const json = await r.json();
    if (!json.ok) throw new Error(json.error || 'bad response');
    return json.days || [];
  }

  function formatLabel(isoDate) {
    // 'YYYY-MM-DD' -> 'пн.01.09'
    try {
      const [y, m, d] = isoDate.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const wd = dt
        .toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'Europe/Moscow' })
        .replace('.', '');
      const ddmm = dt.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Moscow',
      });
      return `${wd}.${ddmm}`;
    } catch {
      return isoDate;
    }
  }

  async function renderChart() {
    try {
      const rows = await fetchDaily(7);
      const labels = rows.map((r) => formatLabel(r.date));
      const auth = rows.map((r) => Number(r.auth || 0));
      const unique = rows.map((r) => Number(r.unique || 0));

      const canvas = document.getElementById('visits');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const data = {
        labels,
        datasets: [
          {
            label: 'Авторизации',
            data: auth,
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.7,
          },
          {
            label: 'Уникальные',
            data: unique,
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.7,
          },
        ],
      };

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', boxWidth: 14, usePointStyle: true, pointStyle: 'rect' },
          },
          tooltip: { mode: 'index', intersect: false },
          valueLabel: {
            color: '#cbd5e1',
            font:
              '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, "Noto Sans", sans-serif',
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148,163,184,0.15)' },
            ticks: { color: '#cbd5e1', maxRotation: 0, minRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.15)' },
            ticks: { color: '#cbd5e1', precision: 0 },
          },
        },
      };

      if (visitsChart) {
        visitsChart.data = data;
        visitsChart.options = options;
        visitsChart.update();
      } else {
        visitsChart = new Chart(ctx, { type: 'bar', data, options });
      }
    } catch (e) {
      console.error('renderChart error:', e);
    }
  }

  // Загружаем график
  renderChart();
  // На всякий — экспорт ручного рефреша
  window.refreshVisitsChart = renderChart;
})();
