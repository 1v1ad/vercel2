// admin/chart.js — 7-дневный бар-чарт с подписями и осью Y.
// Сегодня — всегда справа. Авто-трекинг API/пароля из localStorage.

(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";

  function getAPI() {
    return (window.API || localStorage.getItem("ADMIN_API") || "")
      .toString()
      .trim()
      .replace(/\/+$/, "");
  }
  function adminHeaders() {
    return { "X-Admin-Password": (localStorage.getItem("ADMIN_PWD") || "").toString() };
  }

  // Аккуратные «приятные» деления по оси Y (1–2–5…)
  function niceMax(m) {
    if (m <= 5) return 5;
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    const base = Math.ceil(m / p);
    return (base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10) * p;
  }

  function text(el, attrs, content) {
    const t = document.createElementNS(SVG_NS, "text");
    for (const k in attrs) t.setAttribute(k, attrs[k]);
    if (content != null) t.textContent = content;
    el.appendChild(t);
    return t;
  }
  function line(el, attrs) {
    const l = document.createElementNS(SVG_NS, "line");
    for (const k in attrs) l.setAttribute(k, attrs[k]);
    el.appendChild(l);
    return l;
  }
  function rect(el, attrs) {
    const r = document.createElementNS(SVG_NS, "rect");
    for (const k in attrs) r.setAttribute(k, attrs[k]);
    el.appendChild(r);
    return r;
  }

  function drawChart(series) {
    const svg =
      document.getElementById("chart") ||
      document.getElementById("daily") ||
      document.querySelector("svg[data-chart]");

    if (!svg) return;

    const W = svg.clientWidth || svg.parentNode.clientWidth || 740;
    const H = svg.clientHeight || 300;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Отступы и рисовальная область
    const pad = { l: 52, r: 16, t: 28, b: 30 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    // Оси/сетка/легенда
    const gAxis = document.createElementNS(SVG_NS, "g");
    const gBars = document.createElementNS(SVG_NS, "g");
    svg.appendChild(gAxis);
    svg.appendChild(gBars);

    const maxVal = niceMax(
      Math.max(1, ...series.map((d) => Math.max(d.auth || 0, d.unique || 0)))
    );
    const baseY = pad.t + innerH;
    const y = (v) => pad.t + innerH - (v / maxVal) * innerH;

    // Горизонтальные линии + подписи по оси Y
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = Math.round((maxVal * i) / ticks);
      const yy = y(v);
      line(gAxis, {
        x1: pad.l,
        y1: yy,
        x2: W - pad.r,
        y2: yy,
        stroke: "#263445",
        "stroke-width": 1,
        opacity: i === ticks ? 1 : 0.4,
      });
      text(gAxis, { x: pad.l - 8, y: yy + 4, "text-anchor": "end", "font-size": 11, fill: "#9fb3c8" }, String(v));
    }

    // Группы столбцов (по два: авторизации / уникальные)
    const n = series.length;
    const groupW = innerW / Math.max(1, n);
    const gap = Math.min(12, groupW * 0.12);
    const barW = Math.min(18, (groupW - gap) / 2);

    series.forEach((d, i) => {
      const x0 = pad.l + i * groupW + (groupW - (barW * 2 + gap)) / 2;

      const auth = Math.max(0, d.auth || 0);
      const uniq = Math.max(0, d.unique || 0);

      const yA = y(auth);
      const hA = baseY - yA;
      const yU = y(uniq);
      const hU = baseY - yU;

      // авторизации (синий)
      rect(gBars, { x: x0, y: yA, width: barW, height: hA, rx: 3, fill: "#4aa8ff" });
      text(gBars, { x: x0 + barW / 2, y: Math.max(pad.t + 12, yA - 6), "text-anchor": "middle", "font-size": 11, fill: "#cfe6ff" }, String(auth));

      // уникальные (зелёный)
      rect(gBars, { x: x0 + barW + gap, y: yU, width: barW, height: hU, rx: 3, fill: "#57d28c" });
      text(gBars, { x: x0 + barW + gap + barW / 2, y: Math.max(pad.t + 12, yU - 6), "text-anchor": "middle", "font-size": 11, fill: "#d6f7e6" }, String(uniq));

      // подпись по X
      text(gAxis, { x: pad.l + i * groupW + groupW / 2, y: H - 8, "text-anchor": "middle", "font-size": 11, fill: "#9fb3c8" }, d.label);
    });

    // Легенда
    const lgY = pad.t - 10;
    const lgX = pad.l + 6;
    rect(gAxis, { x: lgX, y: lgY, width: 10, height: 10, rx: 2, fill: "#4aa8ff" });
    text(gAxis, { x: lgX + 16, y: lgY + 9, "font-size": 11, fill: "#9fb3c8" }, "Авторизации");
    rect(gAxis, { x: lgX + 120, y: lgY, width: 10, height: 10, rx: 2, fill: "#57d28c" });
    text(gAxis, { x: lgX + 136, y: lgY + 9, "font-size": 11, fill: "#9fb3c8" }, "Уникальные");
  }

  function toLabelUTC(iso) {
    // iso: YYYY-MM-DD (UTC). Делаем «пн.01.09»
    const [Y, M, D] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(Y, (M || 1) - 1, D || 1));
    const wd = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][dt.getUTCDay()];
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    return `${wd}.${dd}.${mm}`;
  }

  async function refreshDailyChart() {
    const api = getAPI();
    if (!api) return;

    try {
      const r = await fetch(api + "/api/admin/daily?days=7", {
        headers: adminHeaders(),
        cache: "no-store",
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "bad_response");

      const arr = j.days || j.series || j.data || [];
      // приводим к { label, auth, unique }
      const series = arr.map((d) => ({
        label: toLabelUTC(d.day || d.date),
        auth: Number(d.auth || d.count || 0),
        unique: Number(d.unique || d.uq || 0),
      }));

      drawChart(series);
    } catch (e) {
      console.error("daily chart error:", e);
    }
  }

  // Первая отрисовка и реакции на смену API/пароля
  document.addEventListener("DOMContentLoaded", refreshDailyChart);
  window.addEventListener("storage", (e) => {
    if (e.key === "ADMIN_API" || e.key === "ADMIN_PWD") {
      setTimeout(refreshDailyChart, 150);
    }
  });

  // Экспорт на всякий случай
  window.refreshDailyChart = refreshDailyChart;
})();
