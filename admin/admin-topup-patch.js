/**
 * Admin manual topup helper
 * - Prompts for a required comment (server requires it)
 * - Sends POST /api/admin/users/:id/topup with JSON { amount, comment }
 * - Uses admin password from the header input on the page
 *
 * Drop this file at /public/admin/admin-topup-patch.js
 * Make sure your admin page includes: <script src="/admin/admin-topup-patch.js"></script>
 */
(function () {
  function $(sel) { return document.querySelector(sel); }
  function toast(msg){ try{ alert(msg); }catch(e){} }

  const btn = $("#btnManualTopup") || document.getElementById("btnTopup") || document.querySelector("[data-action='manual-topup']");
  if (!btn) return; // page doesn't have the control yet

  btn.addEventListener("click", async () => {
    try {
      const apiBase = (window.API_BASE || "").toString() || (window.location.origin.replace(location.host, (document.querySelector("#apiHost")?.value || location.host)));
      const uidEl = $("#manualTopupUserId") || $("#topupUserId") || $("#user_id");
      const amtEl = $("#manualTopupAmount") || $("#topupAmount") || $("#amount");
      const adminPwdEl = $("#adminPassword") || $("#adminPwd") || $("#pwd");

      const userId = parseInt((uidEl?.value || "").trim(), 10);
      const amount = Math.round(Number((amtEl?.value || "").replace(",", ".") || 0));
      const adminPwd = (adminPwdEl?.value || "").trim();

      if (!adminPwd) { toast("Укажите пароль админа."); return; }
      if (!Number.isFinite(userId) || userId <= 0) { toast("Укажите корректный user_id."); return; }
      if (!Number.isFinite(amount) || amount <= 0) { toast("Укажите сумму (>0)."); return; }

      // REQUIRED: comment
      let comment = window.prompt("Комментарий к пополнению (обязательно):", "");
      if (comment == null) return; // cancelled
      comment = (comment || "").trim();
      if (!comment) { toast("Комментарий обязателен."); return; }

      const url = `${apiBase}/api/admin/users/${userId}/topup`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPwd
        },
        body: JSON.stringify({ amount, comment })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        const err = data?.error || res.statusText || `HTTP ${res.status}`;
        toast("Ошибка: " + err);
      } else {
        toast("Готово");
        // optional: clear amount
        if (amtEl) amtEl.value = "";
      }
    } catch (e) {
      console.error(e);
      toast("Ошибка: " + (e?.message || e));
    }
  });
})();
