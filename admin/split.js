(function(){
  const $ = sel => document.querySelector(sel);

  function saveCreds(){
    const api = $('#api').value.trim().replace(/\/$/,'');
    const pwd = $('#pwd').value;
    if (api) localStorage.setItem('ADMIN_API', api);
    if (pwd) localStorage.setItem('ADMIN_PWD', pwd);
    return api || location.origin;
  }

  function getApi(){ return (localStorage.getItem('ADMIN_API') || $('#api').value || location.origin).replace(/\/$/,''); }
  function getPwd(){ return (localStorage.getItem('ADMIN_PWD') || $('#pwd').value || ''); }

  async function apiFetch(path, init){
    const base = getApi();
    const url = base + path;
    const headers = (init && init.headers) ? init.headers : {};
    headers['X-Admin-Password'] = getPwd();
    const resp = await fetch(url, { ...init, headers });
    const data = await resp.json().catch(_=>({ ok:false, error:'bad_json' }));
    if (!resp.ok || data.ok===false) throw new Error(data.error || ('HTTP '+resp.status));
    return data;
  }

  function renderCluster(data){
    $('#cluster').style.display = '';
    $('#humTitle').textContent = String(data.hum_id);
    const users = data.users || [];
    const rows = users.map(u=>{
      const acc = (u.accounts||[]).map(a=>`${a.provider}:${a.provider_user_id}`).join(', ');
      return `
        <tr>
          <td><input type="checkbox" class="chk" value="${u.id}"></td>
          <td>${u.id}</td>
          <td>${u.first_name||''} ${u.last_name||''}</td>
          <td class="acc">${acc}</td>
          <td>${u.country_code||''}</td>
          <td>${u.balance}</td>
        </tr>
      `;
    }).join('');
    $('#users').innerHTML = `
      <table>
        <thead><tr>
          <th></th><th>User ID</th><th>Имя</th><th>Аккаунты</th><th>Страна</th><th>Баланс</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  async function loadCluster(){
    const api = saveCreds();
    const humId = Number($('#hum').value || 0);
    if (!Number.isFinite(humId) || humId<=0) { alert('Укажите HUM ID'); return; }
    const data = await apiFetch(`/api/admin/cluster?hum_id=${humId}`, { method:'GET' });
    renderCluster(data);
  }

  async function doUnmerge(){
    const humId = Number($('#hum').value || 0);
    const reason = $('#reason').value;
    const ids = Array.from(document.querySelectorAll('.chk:checked')).map(x=>Number(x.value));
    if (!ids.length) { alert('Отметьте хотя бы одного пользователя для расклейки'); return; }
    const data = await apiFetch('/api/admin/unmerge', {
      method:'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hum_id: humId, user_ids: ids, reason })
    });
    $('#unmergeResult').textContent = 'Готово: ' + JSON.stringify(data);
    await loadCluster();
  }

  function renderSug(data){
    const list = data.suggestions || [];
    if (!list.length) { $('#sug').innerHTML = '<div class="muted">Нет предложений</div>'; return; }
    const html = list.map(s=>{
      return `
        <div class="card">
          <div class="row">
            <div><b>primary_id:</b> ${s.primary_id} &nbsp;&nbsp; <b>secondary_id:</b> ${s.secondary_id}</div>
            <button data-p="${s.primary_id}" data-s="${s.secondary_id}" class="mergeBtn">Склеить</button>
          </div>
          <div class="muted">${JSON.stringify(s)}</div>
        </div>
      `;
    }).join('');
    $('#sug').innerHTML = html;
    document.querySelectorAll('.mergeBtn').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const p = Number(btn.getAttribute('data-p'));
        const s = Number(btn.getAttribute('data-s'));
        try {
          const data = await apiFetch('/api/admin/merge_apply', {
            method:'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ primary_id: p, secondary_id: s })
          });
          alert('Склеено: ' + JSON.stringify(data));
        } catch(err){
          alert('Ошибка: '+err.message);
        }
      });
    });
  }

  async function loadSug(){
    const limit = Number($('#limit').value || 20);
    const data = await apiFetch(`/api/admin/merge_suggestions?limit=${limit}`, { method:'GET' });
    renderSug(data);
  }

  $('#load').addEventListener('click', loadCluster);
  $('#unmerge').addEventListener('click', doUnmerge);
  $('#loadSug').addEventListener('click', loadSug);

  // auto init from localStorage
  $('#api').value = localStorage.getItem('ADMIN_API') || '';
  $('#pwd').value = localStorage.getItem('ADMIN_PWD') || '';
})();
