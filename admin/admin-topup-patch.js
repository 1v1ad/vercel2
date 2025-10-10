/**
 * Admin manual topup helper (dual-endpoint):
 * 1) Tries POST /api/admin/users/:id/topup  { amount, comment }
 * 2) If 404, falls back to legacy POST /api/admin/topup { user_id, amount, comment }
 */
(function () {
  function $(sel) { return document.querySelector(sel); }
  function toast(msg){ try{ alert(msg); }catch(e){} }
  function getApiBase(){
    if (typeof window.API_BASE === 'string' && window.API_BASE) return window.API_BASE;
    try{ const s = localStorage.getItem('admin_api'); if (s) return s; }catch{}
    const mt = document.querySelector('meta[name="api-base"]'); if (mt?.content) return mt.content;
    return 'https://vercel2pr.onrender.com';
  }
  const API = getApiBase();

  const btn = $("#btnManualTopup") || document.getElementById("btnTopup") || document.querySelector("[data-action='manual-topup']");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      const uidEl = $("#manualTopupUserId") || $("#topupUserId") || $("#user_id");
      const amtEl = $("#manualTopupAmount") || $("#topupAmount") || $("#amount");
      const adminPwdEl = $("#adminPassword") || $("#adminPwd") || $("#pwd");

      const userId = parseInt((uidEl?.value || "").trim(), 10);
      const amount = Math.round(Number((amtEl?.value || "").replace(",", ".") || 0));
      const adminPwd = (adminPwdEl?.value || "").trim();

      if (!adminPwd) { toast("Укажи пароль админа."); return; }
      if (!Number.isFinite(userId) || userId <= 0) { toast("Укажи корректный user_id."); return; }
      if (!Number.isFinite(amount) || amount <= 0) { toast("Укажи сумму (>0)."); return; }

      let comment = window.prompt("Комментарий к пополнению (обязательно):", "");
      if (comment == null) return;
      comment = (comment || "").trim();
      if (!comment) { toast("Комментарий обязателен."); return; }

      let res = await fetch(`${API}/api/admin/users/${userId}/topup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPwd
        },
        body: JSON.stringify({ amount, comment })
      });

      if (res.status === 404) {
        res = await fetch(`${API}/api/admin/topup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Password": adminPwd
          },
          body: JSON.stringify({ user_id: userId, amount, comment })
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        const err = data?.error || res.statusText || `HTTP ${res.status}`;
        toast("Ошибка: " + err);
      } else {
        toast("Готово");
        if (amtEl) amtEl.value = "";
      }
    } catch (e) {
      console.error(e);
      toast("Ошибка: " + (e?.message || e));
    }
  });
})();
