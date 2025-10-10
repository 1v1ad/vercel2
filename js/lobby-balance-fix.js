(function (){
  const TAG='[LBAL]';
  function getApiBase(){
    if (typeof window.API_BASE==='string' && window.API_BASE) return window.API_BASE;
    try{ const v=localStorage.getItem('ADMIN_API')||localStorage.getItem('admin_api'); if(v) return v; }catch{}
    const mt=document.querySelector('meta[name="api-base"]'); if(mt?.content) return mt.content;
    return 'https://vercel2pr.onrender.com';
  }
  const API=getApiBase();

  const q=new URLSearchParams(location.search);
  const provider=(q.get('provider')||'').trim();
  const id=Number(q.get('id')||0);

  function setText(node, txt){ if(node) node.textContent=String(txt); }
  function updateBalanceEverywhere(value){
    const targets=[
      document.querySelector('[data-balance]'),
      document.getElementById('balance'),
      document.querySelector('.pill .amount'),
      document.querySelector('.balance-value'),
    ].filter(Boolean);
    targets.forEach(n=>setText(n, value));
    try{
      const walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const rx=/(^|\\s)[₽P]\\s*\\d[\\d\\s]*/;
      const nodes=[];
      while(walker.nextNode()){ const t=walker.currentNode; if(rx.test(t.nodeValue)) nodes.push(t); }
      nodes.forEach(t=> t.nodeValue=t.nodeValue.replace(/\\d[\\d\\s]*/, String(value)));
    }catch{}
  }
  function updateNameAvatar(u){
    const nameNode=document.querySelector('[data-user-name]')||document.querySelector('.user-name');
    const avatarImg=document.querySelector('[data-user-avatar]')||document.querySelector('.user-avatar img, .avatar img');
    const first=u.first_name||''; const last=u.last_name||'';
    if(nameNode && (first||last)) nameNode.textContent=(first+(last?' '+last:''));
    if(avatarImg && u.avatar) avatarImg.src=u.avatar;
  }
  function updateSourceLabel(u){
    const srcNode=document.querySelector('[data-source]')||document.getElementById('data_source');
    if(srcNode) srcNode.textContent=String(u.provider||provider||'').toUpperCase();
  }
  async function run(){
    if(!Number.isFinite(id) || id<=0){ console.warn(TAG,'no id'); return; }
    try{
      const res=await fetch(`${API}/api/user/${id}`,{credentials:'include', cache:'no-store'});
      if(!res.ok){ console.warn(TAG,'bad status', res.status); return; }
      const data=await res.json();
      const u=data.user||data;
      if(!u) return;
      if(typeof u.balance==='number') updateBalanceEverywhere(u.balance);
      updateNameAvatar(u);
      updateSourceLabel(u);
    }catch(e){ console.warn(TAG,e); }
  }
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
