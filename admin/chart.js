// admin/chart.js — explicit colors and split bars
(function(){
  const ctx = document.getElementById('visits-chart');
  if (!ctx || !window.Chart) return;

  const labels = (window.dailyData || []).map(d => d.date);
  const totals = (window.dailyData || []).map(d => d.auth_total || 0);
  const uniques = (window.dailyData || []).map(d => d.auth_unique || 0);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Авторизации',
          data: totals,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Уникальные HUM',
          data: uniques,
          backgroundColor: 'rgba(46, 204, 113, 0.7)',
          borderColor: 'rgba(46, 204, 113, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: false },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { mode: 'index', intersect: false }
      }
    }
  });
})();
