// Универсальный клиент пополнения для админки.
// Берём API/пароль из инпутов или из localStorage так же, как админка.
(function () {
  function $(sel){ return document.querySelector(sel); }
  function toast(m){ try{ alert(m); }catch{} }

  function getApiBase(){
    const fromInput = $('#apiHost')?.value || $('#api')?.value;
    if (fromInput && fromInput.trim()) return fromInput.trim();
    if (typeof window.API_BASE==='string' && window.API_BASE) return window.API_BASE;
    try{
      const s=localStorage.getItem('ADMIN_API')||localStorage.getItem('admin_api');
      if(s) return s;
    }catch{}
    const mt=document.querySelector('meta[name="api-base"]'); if(mt?.content) return mt.content;
    return 'https://vercel2pr.onrender.com';
  }
  function getAdminPwd(){
    const inp = $('#adminPassword')||$('#adminPwd')||$('#pwd');
    if (inp && inp.value && inp.value.trim()) return inp.value.trim();
    try{
      // читаем те же ключи, что использует админка
      const p = localStorage.getItem('ADMIN_PASSWORD') || localStorage.getItem('admin_password');
      if (p) return p;
    }catch{}
    return '';
  }

  const btn=$("#btnManualTopup")||document.getElementById("btnTopup")||document.querySelector("[data-action='manual-topup']");
  if(!btn) return;

  btn.addEventListener("click", async ()=>{
    try{
      const API=getApiBase();
      const uidEl=$("#manualTopupUserId")||$("#topupUserId")||$("#user_id");
      const amtEl=$("#manualTopupAmount")||$("#topupAmount")||$("#amount");
      const cmtEl=$("#manualTopupComment")||$("#comment");

      const userId=parseInt((uidEl?.value||"").trim(),10);
      const amountNum=Math.round(Number((amtEl?.value||"").toString().replace(",", ".")||0));
      const adminPwd=getAdminPwd();
      const comment=(cmtEl?.value||'admin_topup').trim();

      if(!adminPwd){ toast("Пароль админа пуст. Введите его сверху и сохраните."); return; }
      if(!Number.isFinite(userId)||userId<=0){ toast("Укажи корректный user_id."); return; }
      if(!Number.isFinite(amountNum)||amountNum<=0){ toast("Укажи сумму (>0)."); return; }

      const payload={ user_id:userId, amount:amountNum, comment,
        value:amountNum, sum:amountNum, delta:amountNum,
        note:comment, reason:comment, description:comment };

      async function call(url){
        const res=await fetch(url,{
          method:"POST",
          headers:{ "Content-Type":"application/json","X-Admin-Password":adminPwd },
          body: JSON.stringify(payload)
        });
        let data={}; try{ data=await res.json(); }catch{}
        return {res,data};
      }

      let {res,data}=await call(`${API}/api/admin/users/${userId}/topup`);
      if(res.status===404){ ({res,data}=await call(`${API}/api/admin/topup`)); }

      if(!res.ok || data?.ok===false){
        const err=data?.error || res.statusText || `HTTP ${res.status}`;
        toast("Ошибка: "+err);
      } else {
        toast("Готово");
        if(amtEl) amtEl.value="";
        if(cmtEl) cmtEl.value="";
      }
    }catch(e){ console.error(e); toast("Ошибка: "+(e?.message||e)); }
  });
})();
