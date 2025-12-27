// admin/user-card.js — user card (step 2: header via /api/admin/user-card)
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);

  function api(){
    const raw = (window.API || localStorage.getItem('ADMIN_API') || localStorage.getItem('admin_api') || '').toString().trim();
    return raw ? raw.replace(/\/+$/,'') : location.origin;
  }

  function scope(){
    return (localStorage.getItem('ADMIN_INCLUDE_HUM') === '1') ? 'hum' : 'user';
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function fmtProvider(p){
    const v = (p||'').toString().toLowerCase();
    if (!v) return '—';
    if (v === 'vk') return 'VK';
    if (v === 'tg' || v === 'telegram') return 'TG';
    return v.toUpperCase();
  }

  function deviceFromUA(ua){
    const s = (ua||'').toString();
    if (!s) return { os:'—', client:'—', type:'—' };

    const lower = s.toLowerCase();

    // OS
    let os = '—';
    if (lower.includes('windows')) os = 'Windows';
    else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
    else if (lower.includes('android')) os = 'Android';
    else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) os = 'iOS';
    else if (lower.includes('linux')) os = 'Linux';

    // Client / container
    let client = 'Browser';
    if (lower.includes('telegram')) client = 'Telegram WebView';
    else if (lower.includes('yabrowser')) client = 'Yandex Browser';
    else if (lower.includes('edg/')) client = 'Edge';
    else if (lower.includes('chrome/')) client = 'Chrome';
    else if (lower.includes('safari/') && !lower.includes('chrome/')) client = 'Safari';
    else if (lower.includes('firefox/')) client = 'Firefox';

    // Device type
    let type = 'Desktop';
    if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) type = 'Mobile';
    if (lower.includes('ipad') || lower.includes('tablet')) type = 'Tablet';

    return { os, client, type };
  }

  function badge(label, kind=''){
    return `<span class="uc-badge ${kind}">${esc(label)}</span>`;
  }

  function chip(label, valueHtml){
    return `<div class="uc-chip"><span class="uc-chip-l">${esc(label)}</span><span class="uc-chip-v">${valueHtml ?? '—'}</span></div>`;
  }

  function summarizeEvent(ev){
    if (!ev || !ev.event_type) return '—';
    const t = String(ev.event_type);
    const amt = (ev.amount != null && ev.amount !== '') ? ` · ${esc(ev.amount)} ₽` : '';
    return esc(t) + amt;
  }

  async function load(){
    const qs = new URLSearchParams(location.search);
    const userId = (qs.get('user_id') || qs.get('id') || '').toString().trim();

    const topRight = $('#uc-top-right');
    if (topRight) topRight.textContent = userId ? `user_id: ${userId}` : '';

    if (!userId) {
      $('#uc-note').textContent = 'Не указан user_id в URL.';
      return;
    }

    const url = api() + `/api/admin/user-card?user_id=${encodeURIComponent(userId)}&scope=${encodeURIComponent(scope())}`;

    let j = null;
    try{
      const r = await fetch(url, { headers: (window.adminHeaders ? window.adminHeaders() : {}) });
      j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
    }catch(e){
      const msg = 'Ошибка загрузки карточки: ' + String(e?.message || e);
      $('#uc-note').textContent = msg;
      return;
    }

    render(j);
  }

  function render(data){
    const p = data.profile || {};
    const prov = data.providers || {};
    const la = data.last_auth || null;
    const le = data.last_event || null;

    // avatar
    const hdr = $('#uc-header');
    const avaBox = hdr?.querySelector('.uc-avatar');
    if (avaBox){
      const src = p.avatar || p.avatar_url || '';
      avaBox.innerHTML = src
        ? `<img class="uc-avatar-img" src="${esc(src)}" alt="avatar" referrerpolicy="no-referrer" />`
        : `<div class="uc-avatar-empty">—</div>`;
    }

    // name
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
    const nameEl = hdr?.querySelector('.uc-name');
    if (nameEl) nameEl.innerHTML = esc(name);

    // ids
    const idsEl = hdr?.querySelector('.uc-ids');
    if (idsEl) idsEl.innerHTML = `user_id: <b>${esc(p.user_id ?? '—')}</b> · HUM: <b>${esc(p.hum_id ?? '—')}</b>`;

    // badges
    const badgesEl = hdr?.querySelector('.uc-badges');
    if (badgesEl){
      const b = [];
      if (prov.vk) b.push(badge('VK', 'vk'));
      if (prov.tg) b.push(badge('TG', 'tg'));
      if (!prov.vk && !prov.tg && p.provider) b.push(badge(fmtProvider(p.provider)));
      if (p.merged_via_proof) b.push(badge('manual/proof link', 'proof'));
      badgesEl.innerHTML = b.join(' ') || '—';
    }

    // meta chips
    const metaEl = hdr?.querySelector('.uc-meta');
    if (metaEl){
      const chips = [];

      // last auth
      const authAt = la?.at ? esc(la.at) : '—';
      const cc = (la?.country_code || p.country_code || '').toString().trim();
      const flag = cc ? `<span class="uc-flag" data-cc="${esc(cc)}"></span>` : '';
      const ip = la?.ip ? esc(la.ip) : '—';
      chips.push(chip('Последний вход', `${authAt} · ${flag} ${ip}`));

      // device
      const d = deviceFromUA(la?.ua || le?.ua || '');
      chips.push(chip('Устройство', `${esc(d.os)} · ${esc(d.client)} · ${esc(d.type)}`));

      // last activity
      chips.push(chip('Последняя активность', le?.at ? `${esc(le.at)} · ${summarizeEvent(le)}` : '—'));

      // registration
      const regVia = data.registered_via ? fmtProvider(data.registered_via) : (p.provider ? fmtProvider(p.provider) : '—');
      chips.push(chip('Регистрация', `${p.created_at ? esc(p.created_at) : '—'} · ${esc(regVia)}`));

      metaEl.innerHTML = chips.join('');
    }

    // decorate flags (stable)
    try{ if (window.decorateFlags) window.decorateFlags(document); }catch(_){}

    // note section
    const note = $('#uc-note');
    if (note){
      // show quick link info
      const links = [];
      links.push(`VK linked: <b>${data.is_vk_linked ? 'да' : 'нет'}</b>`);
      links.push(`TG linked: <b>${data.is_tg_linked ? 'да' : 'нет'}</b>`);
      note.innerHTML = links.join(' · ');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
