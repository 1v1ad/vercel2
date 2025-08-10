(function(){
  const apiBase = window.BACKEND_BASE; // зашит
  const LS_KEY = 'gg_admin_token';
  const $ = (sel)=>document.querySelector(sel);

  const loginCard = $('#loginCard');
  const app = $('#app');
  const password = $('#password');
  const loginBtn = $('#loginBtn');
  const loginError = $('#loginError');
  const refreshBtn = $('#refreshBtn');
  const logoutBtn = $('#logoutBtn');
  const usersTbody = $('#usersTbody');
  const txTbody = $('#txTbody');
  const reloadUsers = $('#reloadUsers');
  const reloadTx = $('#reloadTx');
  const txType = $('#txType');
  const userSearch = $('#userSearch');

  function setToken(t){ localStorage.setItem(LS_KEY,t) }
  function getToken(){ return localStorage.getItem(LS_KEY) }
  function clearToken(){ localStorage.removeItem(LS_KEY) }
  function authHeader(){ const t=getToken(); return t?{'Authorization':'Bearer '+t}:{ }; }

  async function api(path, opts={}){
    const url = apiBase.replace(/\/+$/,'') + path;
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type':'application/json', ...(opts.headers||{}), ...authHeader() }
    });
    if(res.status === 401){ showLogin(); throw new Error('unauthorized'); }
    if(!res.ok){ const text = await res.text(); throw new Error(text || ('HTTP '+res.status)); }
    return await res.json();
  }

  function showLogin(){ app.style.display='none'; loginCard.style.display='block'; }
  function showApp(){ loginCard.style.display='none'; app.style.display='block'; }

  async function loadAll(){ await Promise.all([loadMetrics(), loadUsers(), loadTx()]); }

  function money(v){ return (Number(v||0)/100).toFixed(2)+' ₽'; }
  function fmt(s){ return new Date(s).toLocaleString(); }
  function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function metricEl(label, value){ const d=document.createElement('div'); d.className='metric'; d.innerHTML=`<div class="label">${label}</div><div class="value">${value}</div>`; return d; }

  async function loadMetrics(){
    const data = await api('/api/admin/metrics');
    const box = document.querySelector('#metrics');
    box.innerHTML = '';
    [
      ['Пользователи', data.usersCount],
      ['Новые за 7д', data.newUsers7d],
      ['Активные 24ч', data.active24h],
      ['Сумма балансов', money(data.totalBalance)],
      ['Операций', data.txCount],
      ['Депозиты', money(data.depositsSum)],
      ['Выводы', money(data.withdrawsSum)],
      ['Выигрыши', money(data.winSum)],
      ['Проигрыши', money(data.loseSum)],
    ].forEach(([l,v])=>box.appendChild(metricEl(l,v)));
  }

  async function loadUsers(){
    const q = userSearch.value?.trim();
    const data = await api('/api/admin/users?limit=100' + (q?('&q='+encodeURIComponent(q)):''));
    usersTbody.innerHTML = data.items.map(u=>`
      <tr>
        <td>${u.id}</td>
        <td>${u.vk_id}</td>
        <td>${escapeHtml(u.firstName||'')}</td>
        <td>${escapeHtml(u.lastName||'')}</td>
        <td>${money(u.balance)}</td>
        <td>${fmt(u.createdAt)}</td>
        <td>${fmt(u.updatedAt)}</td>
      </tr>`).join('');
  }

  async function loadTx(){
    const type = txType.value;
    const data = await api('/api/admin/transactions?limit=200' + (type?('&type='+encodeURIComponent(type)):''));
    txTbody.innerHTML = data.items.map(t=>`
      <tr>
        <td>${t.id}</td>
        <td>${t.userId}</td>
        <td>${t.type}</td>
        <td>${money(t.amount)}</td>
        <td>${escapeHtml(t.meta||'')}</td>
        <td>${fmt(t.createdAt)}</td>
      </tr>`).join('');
  }

  // events
  loginBtn.addEventListener('click', async ()=>{
    loginError.style.display='none';
    try{
      const res = await api('/api/admin/login', { method:'POST', body: JSON.stringify({ password: password.value }) });
      setToken(res.token);
      await loadAll();
      showApp();
    }catch(e){
      loginError.textContent = 'Ошибка входа: ' + (e.message||e);
      loginError.style.display = 'block';
    }
  });
  refreshBtn.addEventListener('click', loadAll);
  logoutBtn.addEventListener('click', ()=>{ clearToken(); showLogin(); });
  reloadUsers.addEventListener('click', loadUsers);
  reloadTx.addEventListener('click', loadTx);
  txType.addEventListener('change', loadTx);

  // init
  (async ()=>{
    if(getToken()){
      try{ await loadAll(); showApp(); return; }catch(e){}
    }
    showLogin();
  })();
})();
