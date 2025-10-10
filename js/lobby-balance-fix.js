/**
 * r4: provider-aware fallback + stronger DOM updates
 */
(function (){
  const TAG='[LBAL]';
  function getApiBase(){
    if (typeof window.API_BASE==='string' && window.API_BASE) return window.API_BASE;
    try{ const v=localStorage.getItem('ADMIN_API')||localStorage.getItem('admin_api'); if(v) return v; }catch{}
    const mt=document.querySelector('meta[name="api-base"]'); if (mt?.content) return mt.content;
    return 'https://vercel2pr.onrender.com';
  }
  const API=getApiBase();

  const q=new URLSearchParams(location.search);
  const provider=(q.get('provider')||'').trim().toLowerCase(); // 'tg' | 'vk'
  const rawId=(q.get('id')||'').trim();
  const idNum=/^\d+$/.test(rawId)? Number(rawId) : NaN;

  function setText(node, txt){ if(node) node.textContent=String(txt); }

  function updateBalanceEverywhere(value){
    const targets=[
      document.querySelector('[data-balance]'),
      document.getElementById('balance'),
      document.querySelector('.pill .amount'),
      document.querySelector('.balance-value')
    ].filter(Boolean);
    targets.forEach(n=>setText(n, value));
    // brute-force fallback: replace ₽ #### in plain text nodes
    try{
      const walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const rx=/(^|\\s)[₽P]\\s*\\d[\\d\\s]*/;
      const nodes=[];
      while (walker.nextNode()){ const t=walker.currentNode; if(rx.test(t.nodeValue)) nodes.push(t); }
      nodes.forEach(t=> t.nodeValue=t.nodeValue.replace(/\\d[\\d\\s]*/, String(value)));
    }catch{}
  }

  function updateNameAvatar(u){
    const nameNode = document.querySelector('[data-user-name]')
       || document.querySelector('.user-name')
       || document.querySelector('.hdr-user .name')
       || document.querySelector('.hdr-user [class*="name"]');
    const avatarImg = document.querySelector('[data-user-avatar]')
       || document.querySelector('.user-avatar img')
       || document.querySelector('.avatar img')
       || document.querySelector('.hdr-user img');
    const first=u.first_name||''; const last=u.last_name||'';
    if (nameNode) nameNode.textContent = (first + (last? ' '+last : '')).trim();
    if (avatarImg && u.avatar) avatarImg.src = u.avatar;
  }

  function updateSourceLabel(u){
    const srcNode=document.querySelector('[data-source]')||document.getElementById('data_source');
    if (srcNode) srcNode.textContent = String(u.provider || provider || '').toUpperCase();
  }

  async function fetchByInternalId(){
    if (!Number.isFinite(idNum)) return null;
    const r = await fetch(`${API}/api/user/${idNum}`, { credentials:'include', cache:'no-store' });
    if (r.ok) return r.json();
    return null;
  }
  async function fetchByProvider(){
    if (!provider || !rawId) return null;
    const pid = encodeURIComponent(rawId);
    const r = await fetch(`${API}/api/user/p/${provider}/${pid}`, { credentials:'include', cache:'no-store' });
    if (r.ok) return r.json();
    return null;
  }

  async function run(){
    try {
      let data = await fetchByInternalId();
      if (!data || data.ok === false) data = await fetchByProvider();
      if (!data || data.ok === false) { console.warn(TAG,'no data'); return; }
      const u = data.user || data;
      if (typeof u.balance === 'number') updateBalanceEverywhere(u.balance);
      updateNameAvatar(u);
      updateSourceLabel(u);
    } catch(e){ console.warn(TAG,e); }
  }

  // linkers
  function wireLinkers(){
    const btnVK=document.getElementById('btnLinkVK')||document.querySelector('[data-link-vk]');
    const btnTG=document.getElementById('btnLinkTG')||document.querySelector('[data-link-tg]');
    const open=(url)=>{ try{ location.href=url; }catch{ window.open(url,'_self'); } };
    if(btnVK) btnVK.addEventListener('click', e=>{ e.preventDefault(); open(`${API}/api/profile/link/start?vk=1`); });
    if(btnTG) btnTG.addEventListener('click', e=>{ e.preventDefault(); open(`${API}/api/profile/link/start?tg=1`); });
  }

  wireLinkers();
  run();
})();
