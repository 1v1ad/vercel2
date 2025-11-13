// admin/chart-range.js - SVG chart with retries and explicit X-Admin-Password
(function(){
  var svg = document.getElementById('chart-range');
  if (!svg) return;
  var note = document.getElementById('range-note');
  if (!note) {
    note = document.createElement('div');
    note.id = 'range-note';
    note.className = 'muted';
    (svg.parentNode || document.body).appendChild(note);
  }

  function api(){ return (localStorage.getItem('ADMIN_API') || '').replace(/\/+$/,''); }
  function pwd(){ return (localStorage.getItem('ADMIN_PWD') || ''); }
  function addDays(iso, k){ var d=new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+k); return d.toISOString().slice(0,10); }
  function today(){ return new Date().toISOString().slice(0,10); }

  function fetchJSON(url, init, retries){
    if (retries == null) retries = 2;
    return fetch(url, init).then(function(r){
      if (!r.ok) {
        if (retries>0 && (r.status>=500 || r.status===502 || r.status===504)) {
          return new Promise(function(res){ setTimeout(res,800); }).then(function(){
            return fetchJSON(url, init, retries-1);
          });
        }
        return r.text().then(function(t){ throw new Error('http_'+r.status+' '+t.slice(0,160)); });
      }
      return r.json();
    }).catch(function(e){
      if (retries>0) {
        return new Promise(function(res){ setTimeout(res,800); }).then(function(){
          return fetchJSON(url, init, retries-1);
        });
      }
      throw e;
    });
  }

  function draw(xDates, y1, y2){
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = Math.max(320, svg.clientWidth || 820);
    var H = Math.max(180, (parseInt(svg.getAttribute('height')||'0',10) || 260));
    svg.setAttribute('viewBox', '0 0 '+W+' '+H);

    var pad = { l:42, r:12, t:12, b:26 };
    var X0 = pad.l, X1 = W - pad.r;
    var Y0 = H - pad.b, Y1 = pad.t;
    var n  = xDates.length;

    function safeMax(a){ return a && a.length ? Math.max.apply(null,a) : 1; }
    var maxY = Math.max(1, safeMax(y1||[]), safeMax(y2||[]));
    function scaleX(i){ return (n<=1 ? X0 : X0 + (i*(X1-X0)/(n-1))); }
    function scaleY(v){ return (Y0 - (v * (Y0-Y1) / maxY)); }

    // grid Y
    for (var g=0; g<=4; g++){
      var val = Math.round(maxY * g / 4);
      var y = scaleY(val);
      line(X0,y,X1,y,'#1b2737'); text(X0-6,y+4,String(val),'end');
    }
    // axis X (up to 6 ticks)
    var ticks = Math.min(6, Math.max(2, n||2));
    for (var i=0;i<ticks;i++){
      var idx = n ? Math.round(i*(n-1)/(ticks-1)) : 0;
      var x = scaleX(idx);
      text(x, H-6, xDates[idx]||'', (i===0?'start':(i===ticks-1?'end':'middle')));
    }

    path(y1||[], '#0a84ff', 2);
    path(y2||[], '#4ed1a9', 2);

    function path(arr, color, width){
      var d='', i;
      for (i=0;i<arr.length;i++){
        var x=scaleX(i), y=scaleY(arr[i]||0);
        d += (i===0?'M '+x+' '+y:' L '+x+' '+y);
      }
      var p = document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d', d); p.setAttribute('stroke', color); p.setAttribute('stroke-width', width); p.setAttribute('fill','none');
      svg.appendChild(p);
    }
    function line(x1,y1,x2,y2,color){
      var l = document.createElementNS('http://www.w3.org/2000/svg','line');
      l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
      l.setAttribute('stroke',color); l.setAttribute('stroke-width','1');
      svg.appendChild(l);
    }
    function text(x,y,txt,anchor){
      var t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x',x); t.setAttribute('y',y); t.setAttribute('fill','#8fa4c6'); t.setAttribute('font-size','11');
      if (anchor) t.setAttribute('text-anchor', anchor);
      t.appendChild(document.createTextNode(txt));
      svg.appendChild(t);
    }
  }

  function run(){
    note.textContent = 'Загрузка…';
    draw([],[]);

    var base = api();
    if (!base) { note.textContent='Укажи API и пароль вверху и нажми "Сохранить"'; return; }

    var to   = today();
    var from = addDays(to, -30);
    var qs = new URLSearchParams({ tz:'Europe/Moscow', from: from, to: to });
    var chk = document.getElementById('range-analytics');
    if (chk && chk.checked) qs.set('analytics','1');

    fetchJSON(base + '/api/admin/range?' + qs.toString(), {
      headers: { 'X-Admin-Password': pwd() }, cache:'no-store'
    }).then(function(j){
      if (!j || !j.ok || !Array.isArray(j.days)) { note.textContent='Нет данных'; return; }
      var xs = j.days.map(function(d){ return d.date || d.day; });
      var sTotal  = j.days.map(function(d){ return Number(d.auth_total  || 0); });
      var sUnique = j.days.map(function(d){ return Number(((d.auth_unique_analytics!=null)?d.auth_unique_analytics:d.auth_unique) || 0); });
      draw(xs, sTotal, sUnique);
      note.textContent = 'Период: '+j.from+' – '+j.to+' • дней: '+j.days.length+(qs.get('analytics')?' • учет аналитики: да':'');
    }).catch(function(e){
      note.textContent = 'Ошибка: ' + (e && e.message ? e.message : 'network');
    });
  }

  if (document.readyState==='complete' || document.readyState==='interactive') setTimeout(run, 50);
  else document.addEventListener('DOMContentLoaded', function(){ setTimeout(run,50); });
})();
