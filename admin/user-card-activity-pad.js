// admin/user-card-activity-pad.js
// Cosmetic fix: add left padding inside the activity SVG so X labels don't clip/overlap.
(function(){
  const PAD_X = 16; // viewBox units (acts like left padding)

  function ensureViewBox(svg){
    let vb = svg.getAttribute('viewBox');
    if (vb) return vb;
    // fallback: derive a sane viewBox
    const w = parseFloat(svg.getAttribute('width')) || svg.clientWidth || 360;
    const h = parseFloat(svg.getAttribute('height')) || svg.clientHeight || 180;
    vb = `0 0 ${Math.round(w)} ${Math.round(h)}`;
    svg.setAttribute('viewBox', vb);
    return vb;
  }

  function adjust(svg){
    if (!svg) return;
    // allow drawing outside svg bounds (text labels)
    svg.style.overflow = 'visible';

    const vb = ensureViewBox(svg);
    const parts = vb.trim().split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return;

    let [x,y,w,h] = parts;

    // If we already have enough left padding, skip.
    // x is usually 0; we want x <= -PAD_X.
    if (x <= -PAD_X) return;

    const dx = PAD_X + x; // how much we need to move the left edge to -PAD_X
    const nx = x - dx;    // becomes -PAD_X
    const nw = w + dx;    // expand width so the right side doesn't get clipped
    svg.setAttribute('viewBox', `${nx} ${y} ${nw} ${h}`);
  }

  function init(){
    const svg = document.getElementById('uc-activity-chart');
    if (!svg) return;

    // Re-apply after re-render (the chart SVG gets rebuilt).
    const obs = new MutationObserver(() => adjust(svg));
    obs.observe(svg, { childList: true, subtree: true });

    adjust(svg);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
