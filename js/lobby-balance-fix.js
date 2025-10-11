/**
 * lobby-balance-fix.js — r5
 * Правило: если в ссылке есть provider=vk|tg — СНАЧАЛА пробуем по внешнему id,
 * а попытку /api/user/<число> (внутренний id) делаем только если явный internal uid передан как uid=...
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

  const qs=new URLSearchParams(location.search);
  const provider=(qs.get('provider')||'').trim().toLowerCase(); // 'tg'|'vk'|''
  const extId=(qs.get('id')||'').trim();                         // внешний id провайдера
  const internalUid=(qs.get('uid')||'').trim();                  // явный внутренний id (если передаём)

  function setText(node, txt){ if(node) node.textContent=String(txt); }
  function updateBalanceEverywhere(value){
    const targets=[
      document.querySelector('[data-balance]'),
      document.getElementById('balance'),
      document.querySelector('.pill .amount'),
      document.querySelector('.balance-value')
    ].filter(Boolean);
    targets.forEach(n=>setText(n, value));
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
  function updateSource(u){
    const src=document.querySelector('[data-source]')||document.getElementById('data_source');
    if (src) src.textContent = String(u.provider || provider || '').toUpperCase();
  }

  async function fetchMe(){
    const r = await fetch(`${API}/api/me`, { credentials:'include', cache:'no-store' });
    return r.ok ? r.json() : null;
  }
  async function fetchByProvider(){
    if (!provider || !extId) return null;
    const r = await fetch(`${API}/api/user/p/${provider}/${encodeURIComponent(extId)}`, { credentials:'include', cache:'no-store' });
    return r.ok ? r.json() : null;
  }
  async function fetchByInternal(){
    if (!internalUid) return null; // важно: БОЛЬШЕ не гадаем из id (чтобы tg id не путать с внутренним)
    const r = await fetch(`${API}/api/user/${encodeURIComponent(internalUid)}`, { credentials:'include', cache:'no-store' });
    return r.ok ? r.json() : null;
  }

  async function run(){
    try{
      let data = null;

      // 1) есть провайдер — сначала внешний id
      if (provider) data = await fetchByProvider();

      // 2) явно передан внутренний uid — пробуем его
      if (!data) data = await fetchByInternal();

      // 3) на крайний — /api/me
      if (!data) data = await fetchMe();

      if (!data || data.ok === false) return;

      const u = data.user || data;
      if (typeof u.balance === 'number') updateBalanceEverywhere(u.balance);
      updateNameAvatar(u);
      updateSource(u);
    }catch(e){ console.warn(TAG, e); }
  }

  run();
})();
