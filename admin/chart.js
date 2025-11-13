// admin/chart.js — безопасный график посещений за 7 дней
(function(){
  var svg = document.getElementById('chart');
  if (!svg) return;

  function api(){ return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,''); }
  function pwd(){ return (localStorage.getItem('ADMIN_PWD') || ''); }
  function addDays(iso,k){ var d=new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+k); return d.toISOString().slice(0,10); }
  function today(){ return new Date().toISOString().slice(0,10); }

  function fetchJSON(url, init){ return fetch(url, init).then(r=>{ if(!r.ok) throw new Error('http_'+r.status); return r.json(); }); }

  function draw(xDates, y1){
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W=Math.max(320, svg.clientWidth||820), H=Math.max(160, 240);
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    var pad={l:42,r:12,t:12,b:26}, X0=pad.l, X1=W-pad.r, Y0=H-pad.b, Y1=pad.t;
    var n=xDates.length, maxY=Math.max(1, Math.max.apply(null, y1.length?y1:[0]));
    function scaleX(i){ return (n<=1?X0:X0+i*(X1-X0)/(n-1)); }
    function scaleY(v){ return Y0 - (v*(Y0-Y1)/maxY); }
    // оси
    for(var g=0; g<=4; g++){ var val=Math.round(maxY*g/4), y=scaleY(val); line(X0,y,X1,y,'#1b2737'); text(X0-6,y+4,String(val),'end'); }
    var ticks=Math.min(6, Math.max(2,n||2));
    for(var i=0;i<ticks;i++){ var idx=n?Math.round(i*(n-1)/(ticks-1)):0; text(scaleX(idx),H-6,(xDates[idx]||''), (i===0?'start':(i===ticks-1?'end':'middle'))); }
    // линия
    var d=''; for(var j=0;j<y1.length;j++){ var x=scaleX(j), y=scaleY(y1[j]||0); d+=(j?' L ':'M ')+x+' '+y; }
    var p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d',d); p.setAttribute('stroke','#8ea2ff'); p.setAttribute('stroke-width','2'); p.setAttribute('fill','none'); svg.appendChild(p);

    function line(x1,y1,x2,y2,c){ var l=document.createElementNS('http://www.w3.org/2000/svg','line'); l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2); l.setAttribute('stroke',c); l.setAttribute('stroke-width','1'); svg.appendChild(l); }
    function text(x,y,txt,a){ var t=document.createElementNS('http://www.w3.org/2000/svg','text'); t.setAttribute('x',x); t.setAttribute('y',y); t.setAttribute('fill','#8fa4c6'); t.setAttribute('font-size','11'); if(a) t.setAttribute('text-anchor',a); t.appendChild(document.createTextNode(txt)); svg.appendChild(t); }
  }

  function run(){
    var base=api(); if(!base) return;
    var to=today(), from=addDays(to,-6);
    var qs=new URLSearchParams({ tz:'Europe/Moscow', from:from, to:to });
    fetchJSON(base+'/api/admin/range?'+qs.toString(), { headers:{'X-Admin-Password':pwd()}, cache:'no-store' })
      .then(function(j){
        var xs=(j.days||[]).map(function(d){ return d.date||d.day; });
        var total=(j.days||[]).map(function(d){ return Number(d.auth_total||0); });
        draw(xs, total);
      })
      .catch(function(e){ console.error('chart error', e); });
  }

  if (document.readyState==='complete' || document.readyState==='interactive') setTimeout(run,50);
  else document.addEventListener('DOMContentLoaded', function(){ setTimeout(run,50); });
})();
