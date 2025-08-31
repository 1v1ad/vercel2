// admin/app.js — add adminHeaders() and auto-attach X-Admin-Password to all /api/admin requests.
(function(){
  function getApi() {
    const api = (window.API || localStorage.getItem('ADMIN_API') || '').toString().trim();
    return api.replace(/\/+$/,''); // strip trailing /
  }
  function getPwd() {
    return (localStorage.getItem('ADMIN_PWD') || '').toString();
  }

  // 1) Headers helper
  window.adminHeaders = function adminHeaders(){
    return { 'X-Admin-Password': getPwd() };
  };

  // 2) Patch fetch: auto-inject X-Admin-Password for {API}/api/admin/*
  const _fetch = window.fetch;
  window.fetch = function patchedFetch(input, init){
    init = init || {};
    let url = '';
    try { url = (typeof input === 'string') ? input : input.url; } catch(_){ url = ''; }

    try {
      const api = getApi();
      if (api && url && url.indexOf(api + '/api/admin') === 0) {
        let headers = init.headers || {};
        const h = new Headers(headers);
        if (!h.has('X-Admin-Password')) h.set('X-Admin-Password', getPwd());
        const obj = {};
        h.forEach((v,k) => { obj[k] = v; });
        init.headers = obj;
      }
    } catch(_){}

    return _fetch(input, init);
  };

  // 4) Small safe helper
  window.toArrayOrEmpty = function(x){ return Array.isArray(x) ? x : []; };
})();
