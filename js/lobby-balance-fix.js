/**
 * FEAT: lobby_balance_fix v6
 * WHY:  корректный провайдер, HUM-баланс; при TG и пустой фамилии — жёстко убираем следы VK-фамилии
 * DATE: 2025-10-11
 */
(function (){
  const TAG='[LBAL]';
  function apiBase(){
    if (typeof window.API_BASE==='string' && window.API_BASE) return window.API_BASE;
    try{ const v=localStorage.getItem('ADMIN_API')||localStorage.getItem('admin_api'); if(v) return v; }catch{}
    const mt=document.querySelector('meta[name="api-base"]'); if (mt?.content) return mt.content;
    return 'https://vercel2pr.onrender.com';
  }
  const API=apiBase();

  const q=new URLSearchParams(location.search);
  const provider=(q.get('provider')||'').trim().toLowerCase(); // 'tg'|'vk'
  const rawId=(q.get('id')||'').trim();
  const idNum=/^\d+$/.test(rawId)? Number(rawId) : NaN;

  function setTxt(n,t){ if(n) n.textContent=String(t); }

  function updateBalance(value){
    const targets=[
      document.querySelector('[data-balance]'),
      document.getElementById('balance'),
      document.querySelector('.pill .amount'),
      document.querySelector('.balance-value')
    ].filter(Boolean);
    targets.forEach(n=>setTxt(n, value));
    try{
      const walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const rx=/(^|\s)[₽P]\s*\d[\d\s]*/;
      const nodes=[];
      while (walker.nextNode()){ const t=walker.currentNode; if(rx.test(t.nodeValue)) nodes.push(t); }
      nodes.forEach(t=> t.nodeValue=t.nodeValue.replace(/\d[\d\s]*/, String(value)));
    }catch{}
  }

  function nukeSurnameArtifacts(){
    // очевидные элементы
    document.querySelectorAll(
      '.user-last,.surname,.family,.fam,[data-lastname],[data-user-last],.hdr-user .surname,.hdr-user .last'
    ).forEach(n=>{ try{ n.textContent=''; }catch{} });

    // в некоторых шаблонах имя и фамилия в разных <span>; оставим только первый текстовый
    const box = document.querySelector('.hdr-user');
    if (box) {
      const texts = Array.from(box.querySelectorAll('span,div,p,strong,em')).filter(
        el => el.childElementCount===0 && (el.textContent||'').trim().length>0
      );
      if (texts.length>1) texts.slice(1).forEach(el=>{ try{ el.textContent=''; }catch{} });
    }
  }

  function updateNameAvatar(u){
    const isTG = (u.provider||provider)==='tg';
    const first = u.first_name || '';
    const last  = isTG ? (u.last_name || '') : (u.last_name || '');
    const full  = (first + (last ? ' ' + last : '')).trim();

    let nameNode = document.querySelector('[data-user-name]')
       || document.querySelector('.user-name')
       || document.querySelector('.hdr-user .name')
       || document.querySelector('.hdr-user [class*="name"]');

    if (!nameNode) {
      // жёсткий fallback: первый «текстовый» элемент в .hdr-user
      const box = document.querySelector('.hdr-user');
      if (box) {
        const candidates = Array.from(box.querySelectorAll('span,div,p,strong,em')).filter(
          el => el.childElementCount===0 && !/img|button|a/i.test(el.tagName) && (el.textContent||'').trim().length>0
        );
        nameNode = candidates[0] || null;
      }
    }

    if (nameNode) setTxt(nameNode, full);
    if (isTG && !last) nukeSurnameArtifacts();

    const avatarImg = document.querySelector('[data-user-avatar]')
       || document.querySelector('.user-avatar img')
       || document.querySelector('.avatar img')
       || document.querySelector('.hdr-user img');
    if (avatarImg && u.avatar) avatarImg.src = u.avatar;
  }

  function updateSource(u){
    const n=document.querySelector('[data-source]')||document.getElementById('data_source');
    if (n) n.textContent = String(u.provider || provider || '').toUpperCase();
    try{ if (window.__setLinkButtons) window.__setLinkButtons(u.provider || provider); }catch{}
  }

  async function fetchUserById(){
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
    try{
      let data = await fetchUserById();
      if (!data || data.ok===false) data = await fetchByProvider();
      if (!data || data.ok===false) return;
      const u = data.user || data;
      if (typeof u.balance === 'number') updateBalance(u.balance);
      updateNameAvatar(u);
      updateSource(u);
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
