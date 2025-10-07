// public/admin/routes_admin.v3.1.js
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=(v)=>v==null?'':String(v);
const asInt=(v,d=0)=>{const n=parseInt(v,10);return Number.isFinite(n)?n:d};

const els={
  service:$('#service')||$('input[name=service]'),
  pwd:$('#pwd')||$('input[name=pwd]'),
  mergeAllBtn:$('#btn-merge-all')||$('[data-action="merge-all"]'),
  topupBtn:$('#btn-topup')||$('[data-action="topup"]'),
  topupUser:$('#topup_user')||$('#user_id')||$('input[name="user_id"]'),
  topupAmount:$('#topup_amount')||$('#amount')||$('input[name="amount"]'),
  usersTbody:$('#users_tbody')||$('#usersTable tbody')||$('#users tbody'),
  eventsTbody:$('#events_tbody')||$('#eventsTable tbody')||$('#events tbody'),
  usersSearch:$('#users_search')||$('input[name="user_search"]'),
  usersReload:$('#users_reload')||$('[data-action="reload-users"]'),
  eventsType:$('#events_type')||$('select[name="event_type"]'),
  eventsUserId:$('#events_user_id')||$('input[name="events_user_id"]'),
  eventsReload:$('#events_reload')||$('[data-action="reload-events"]'),
  kUsers:$('#k_users')||$('[data-counter="users"]'),
  kEvents:$('#k_events')||$('[data-counter="events"]'),
  kUniques:$('#k_uniques7')||$('[data-counter="uniques7"]'),
  chartCanvas:$('#chart_daily')||$('canvas[data-chart="daily"]'),
  flash:$('#flash')
};

const LS={service:'adm_service',pwd:'adm_pwd'};
const getService=()=> (els.service?.value||localStorage.getItem(LS.service)||'').trim().replace(/\/+$/,'');
const getPwd=()=> (els.pwd?.value||localStorage.getItem(LS.pwd)||'').trim();
const saveAuth=()=>{ if(els.service) localStorage.setItem(LS.service,els.service.value.trim());
                     if(els.pwd)     localStorage.setItem(LS.pwd,els.pwd.value.trim()); };

async function apiTry(paths,{method='GET',body}={}){
  const base=getService(); if(!base) throw new Error('Не указан URL сервиса');
  let last;
  for(const p of paths){
    try{
      const res=await fetch(base+p,{method,headers:{...(method!=='GET'?{'Content-Type':'application/json'}:{}),'X-Admin-Password':getPwd()},body:method==='GET'?undefined:JSON.stringify(body??{})});
      const ct=res.headers.get('content-type')||'';
      const data=ct.includes('application/json')?await res.json():await res.text();
      if(res.status===204) return {ok:true};
      if(!res.ok){ last=new Error(`HTTP ${res.status} @ ${p}`); continue; }
      return data;
    }catch(e){ last=e; }
  }
  throw last||new Error('Нет доступных эндпоинтов');
}

const API={
  summary:(days=7)=>apiTry([`/admin/summary?days=${days}`, `/api/admin/summary?days=${days}`, `/admin/stats?days=${days}`]),
  users:({take=50,skip=0,search='' }={})=>{
    const qs=`?take=${take}&skip=${skip}&search=${encodeURIComponent(search)}`;
    return apiTry([`/admin/users${qs}`,`/api/admin/users${qs}`]);
  },
  events:({take=50,skip=0,type='',user_id='',search='' }={})=>{
    // отправляем оба ключа — и type, и event_type
    const qs=`?take=${take}&skip=${skip}&type=${encodeURIComponent(type)}&event_type=${encodeURIComponent(type)}&user_id=${encodeURIComponent(user_id)}&search=${encodeURIComponent(search)}`;
    return apiTry([`/admin/events${qs}`,`/api/admin/events${qs}`]);
  },
  daily:(days=7)=>apiTry([`/admin/daily?days=${days}`, `/api/admin/daily?days=${days}`, `/admin/summary/daily?days=${days}`]),
  mergeAll:()=>apiTry(['/admin/merge/apply-all','/api/admin/merge/apply-all','/admin/merge-all'],{method:'POST'}),
  topup:(user_id,amount)=>apiTry(['/admin/topup','/api/admin/topup'],{method:'POST',body:{user_id,amount:asInt(amount)}}),
  health:()=>apiTry(['/admin/health','/api/admin/health']).catch(()=>({ok:false}))
};

const sanitize=(x)=>txt(x).replace(/[<>&]/g,m=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[m]));
function normalizeDailyPayload(p){
  const rows = Array.isArray(p) ? p
             : Array.isArray(p?.days) ? p.days
             : Array.isArray(p?.daily) ? p.daily
             : Array.isArray(p?.rows) ? p.rows
             : Array.isArray(p?.data) ? p.data : [];
  return rows.map(r=>{
    const d=r.date||r.day||r.d||r.ts||r.t;
    const c=r.count??r.c??r.auth??r.value??r.n??r.v??0;
    return d?{date:String(d),count:Number(c)}:null;
  }).filter(Boolean);
}
function normalizeUsersPayload(p){
  const rows = Array.isArray(p)?p : p?.rows ?? p?.users ?? [];
  return rows.map(u=>({
    HUMid: u.HUMid ?? u.humid ?? u.hum_id ?? u.hid ?? u.id ?? '',
    user_id: u.user_id ?? u.id ?? '',
    vk_tg: u.provider ?? u.vk_tg ?? u.src ?? (Array.isArray(u.providers)?u.providers.join(','): (u.vk_id ? 'vk' : 'tg')) ?? '',
    first_name: u.first_name ?? u.name ?? '',
    last_name: u.last_name ?? '',
    balance: u.balance ?? 0,
    country: u.country ?? u.cc ?? u.country_code ?? u.country_name ?? '',
    created_at: u.created_at ?? u.createdAt ?? u.created ?? '',
    providers: Array.isArray(u.providers)?u.providers.join(',') : txt(u.providers ?? (u.vk_id?'vk':'tg'))
  }));
}
function normalizeEventsPayload(p){
  const rows = Array.isArray(p)?p : p?.rows ?? p?.events ?? [];
  return rows.map(e=>({
    id: e.id ?? e.event_id ?? '',
    HUMid: e.HUMid ?? e.humid ?? e.hid ?? '',
    user_id: e.user_id ?? e.uid ?? '',
    type: e.type ?? e.event_type ?? '',
    ip: e.ip ?? '',
    ua: e.ua ?? e.UA ?? e.user_agent ?? '',
    created_at: e.created_at ?? e.ts ?? e.time ?? ''
  }));
}

function setCounter(el,v){ if(el) el.textContent = txt(v); }
function flash(msg,kind='info',ms=2500){ console[kind==='error'?'error':'log']('[flash]',msg); if(!els.flash) return; els.flash.textContent=txt(msg); els.flash.dataset.kind=kind; els.flash.hidden=false; clearTimeout(els.flash._t); els.flash._t=setTimeout(()=>els.flash.hidden=true,ms); }

function renderUsers(rows){
  if(!els.usersTbody) return;
  els.usersTbody.innerHTML = rows.map(u=>`
    <tr>
      <td>${sanitize(u.HUMid)}</td>
      <td>${sanitize(u.user_id)}</td>
      <td>${sanitize(u.vk_tg)}</td>
      <td>${sanitize(u.first_name)}</td>
      <td>${sanitize(u.last_name)}</td>
      <td class="num">${sanitize(u.balance)}</td>
      <td>${sanitize(u.country)}</td>
      <td>${sanitize(u.created_at)}</td>
      <td>${sanitize(u.providers)}</td>
    </tr>`).join('') || `<tr><td colspan="9" class="muted">Пусто</td></tr>`;
}
function renderEvents(rows){
  if(!els.eventsTbody) return;
  els.eventsTbody.innerHTML = rows.map(e=>`
    <tr>
      <td>${sanitize(e.id)}</td>
      <td>${sanitize(e.HUMid)}</td>
      <td>${sanitize(e.user_id)}</td>
      <td>${sanitize(e.type)}</td>
      <td>${sanitize(e.ip)}</td>
      <td>${sanitize(e.ua)}</td>
      <td>${sanitize(e.created_at)}</td>
    </tr>`).join('') || `<tr><td colspan="7" class="muted">Нет событий</td></tr>`;
}

let dailyChart;
function renderDaily(norm){
  if(!els.chartCanvas) return;
  const labels=norm.map(r=>r.date); const data=norm.map(r=>r.count);
  try{
    if(dailyChart){ dailyChart.data.labels=labels; dailyChart.data.datasets[0].data=data; dailyChart.update(); return; }
    dailyChart=new Chart(els.chartCanvas.getContext('2d'),{
      type:'bar',
      data:{ labels, datasets:[{ label:'Авторизации/день', data }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });
  }catch(e){ console.warn('chart init failed',e); flash('График недоступен', 'error', 4000); }
}

async function loadSummary(){ try{
  const s=await API.summary(7);
  setCounter(els.kUsers,  s.users ?? s.total_users ?? s.k_users ?? s.total ?? 0);
  setCounter(els.kEvents, s.events ?? s.total_events ?? s.k_events ?? 0);
  setCounter(els.kUniques, s.unique7 ?? s.uniques7 ?? s.unique_7d ?? s.uniques ?? 0);
}catch(e){}}
async function loadUsers(){ const search=els.usersSearch?.value?.trim()||''; try{
  const raw=await API.users({take:100,skip:0,search});
  renderUsers(normalizeUsersPayload(raw));
}catch(e){ console.error(e); renderUsers([]); flash('Ошибка загрузки пользователей','error'); }}
async function loadEvents(){ const type=els.eventsType?.value?.trim()||''; const user_id=els.eventsUserId?.value?.trim()||''; try{
  const raw=await API.events({take:100,skip:0,type,user_id});
  renderEvents(normalizeEventsPayload(raw));
}catch(e){ console.error(e); renderEvents([]); }}
async function loadDaily(){ try{
  const raw=await API.daily(7);
  const norm=normalizeDailyPayload(raw);
  if(norm.length) renderDaily(norm);
}catch(e){ console.warn('daily error',e); }}

function wire(){
  if(els.service && !els.service.value) els.service.value=localStorage.getItem(LS.service)||'';
  if(els.pwd && !els.pwd.value)         els.pwd.value=localStorage.getItem(LS.pwd)||'';
  els.service?.addEventListener('change',saveAuth);
  els.pwd?.addEventListener('change',saveAuth);
  els.usersReload?.addEventListener('click',e=>{e.preventDefault(); saveAuth(); loadUsers();});
  els.eventsReload?.addEventListener('click',e=>{e.preventDefault(); saveAuth(); loadEvents();});
  els.mergeAllBtn?.addEventListener('click',e=>{e.preventDefault(); saveAuth(); API.mergeAll().then(()=>{flash('Склейка выполнена'); loadUsers(); loadSummary(); loadEvents();}).catch(err=>{console.error(err); flash('Склейка: ошибка','error',4000);});});
  els.topupBtn?.addEventListener('click',e=>{e.preventDefault(); saveAuth(); const uid=els.topupUser?.value?.trim(); const amt=asInt(els.topupAmount?.value,NaN); if(!uid||!Number.isFinite(amt)) return flash('Укажите user_id и сумму','error'); API.topup(uid,amt).then(()=>{flash('Пополнение выполнено'); loadUsers(); loadSummary();}).catch(err=>{console.error(err); flash('Пополнение: ошибка','error',4000);});});
}
(async function boot(){ try{ wire(); await API.health().catch(()=>null); await Promise.all([loadSummary(),loadUsers(),loadEvents(),loadDaily()]); }catch(e){ console.error('boot',e); }})();
