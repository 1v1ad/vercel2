// admin/user-card-activity-cosmetic.js
// Cosmetic fix for Activity(90 days): avoid overlapping date labels at the left edge.
(function(){
  function fix(){
    const svg = document.getElementById('uc-activity-chart');
    if (!svg) return;

    const texts = Array.from(svg.querySelectorAll('text.uc-activity-axis'));
    if (!texts.length) return;

    // In current viewBox (0..80), x-axis labels are at y ~= 78 (H-2).
    const xLabels = texts.filter(t => {
      const y = parseFloat(t.getAttribute('y') || '0');
      return y >= 74;
    });

    if (xLabels.length < 2) return;

    // Reset visibility + anchors
    xLabels.forEach(t => { t.style.display = ''; });

    xLabels.sort((a,b) =>
      parseFloat(a.getAttribute('x') || '0') - parseFloat(b.getAttribute('x') || '0')
    );

    // Set anchors to avoid clipping
    xLabels[0].setAttribute('text-anchor', 'start');
    xLabels[xLabels.length - 1].setAttribute('text-anchor', 'end');
    for (let i=1; i<xLabels.length-1; i++){
      xLabels[i].setAttribute('text-anchor', 'middle');
    }

    // Hide overlapping labels (prefer month starts: MM-01)
    const minDx = 26; // SVG units (tuned for width=300, ~90 days)
    let lastKept = xLabels[0];

    for (let i=1; i<xLabels.length; i++){
      const prev = lastKept;
      const cur = xLabels[i];

      const px = parseFloat(prev.getAttribute('x') || '0');
      const cx = parseFloat(cur.getAttribute('x') || '0');

      if (cx - px < minDx){
        const p = (prev.textContent || '').trim();
        const c = (cur.textContent || '').trim();
        const prevMonth = p.endsWith('-01');
        const curMonth = c.endsWith('-01');

        if (curMonth && !prevMonth){
          prev.style.display = 'none';
          lastKept = cur;
        } else if (prevMonth && !curMonth){
          cur.style.display = 'none';
          // keep prev
        } else {
          // default: hide older one
          prev.style.display = 'none';
          lastKept = cur;
        }
      } else {
        lastKept = cur;
      }
    }
  }

  const svg = document.getElementById('uc-activity-chart');
  if (!svg) return;

  // Run now and after each re-render
  fix();
  const obs = new MutationObserver(() => {
    // Next frame to allow DOM to settle
    requestAnimationFrame(fix);
  });
  obs.observe(svg, { childList: true, subtree: true });
})();
