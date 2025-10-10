(function () {
  function $(sel){ return document.querySelector(sel); }
  function toast(msg){ try{ alert(msg); }catch(e){} }
  function getApiBase(){
    if (typeof window.API_BASE==='string' && window.API_BASE) return window.API_BASE;
    try{ const s=localStorage.getItem('ADMIN_API')||localStorage.getItem('admin_api'); if(s) return s; }catch{}
    const mt=document.querySelector('meta[name="api-base"]'); if(mt?.content) return mt.content;
    return 'https://vercel2pr.onrender.com';
  }
  const API=getApiBase();
  const btn=$("#btnManualTopup")||document.getElementById("btnTopup")||document.querySelector("[data-action='manual-topup']");
  if(!btn) return;

  btn.addEventListener("click", async ()=>{
    try{
      const uidEl=$("#manualTopupUserId")||$("#topupUserId")||$("#user_id");
      const amtEl=$("#manualTopupAmount")||$("#topupAmount")||$("#amount");
      const adminPwdEl=$("#adminPassword")||$("#adminPwd")||$("#pwd");

      const userId=parseInt((uidEl?.value||"").trim(),10);
      const amountNum=Math.round(Number((amtEl?.value||"").toString().replace(",", ".")||0));
      const adminPwd=(adminPwdEl?.value||"").trim();

      if(!adminPwd){ toast("Укажи пароль админа."); return; }
      if(!Number.isFinite(userId)||userId<=0){ toast("Укажи корректный user_id."); return; }
      if(!Number.isFinite(amountNum)||amountNum<=0){ toast("Укажи сумму (>0)."); return; }

      let comment=window.prompt("Комментарий к пополнению (обязательно):","");
      if(comment==null) return;
      comment=(comment||"").trim();
      if(!comment){ toast("Комментарий обязателен."); return; }

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
      }
    }catch(e){ console.error(e); toast("Ошибка: "+(e?.message||e)); }
  });
})();
