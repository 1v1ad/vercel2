/**
 * Lobby balance fix:
 * If query has provider & id, fetch exact user profile by ID,
 * NOT the cluster primary, to show the correct balance for that account.
 * Requires backend route GET /api/user/:id returning safe fields.
 */
(async function (){
  function getQS(){
    const q = new URLSearchParams(location.search);
    return Object.fromEntries(q.entries());
  }
  const qs = getQS();
  const provider = (qs.provider || "").trim();  // 'vk' or 'tg' or 'vk:id123'
  const rawId = (qs.id || "").trim();
  const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  const balanceNode = document.querySelector("[data-balance]") || document.getElementById("balance") || document.querySelector(".balance-value");

  if (!balanceNode) return;

  try {
    if (provider && Number.isFinite(id)) {
      const res = await fetch(`/api/user/${id}`);
      if (res.ok) {
        const u = await res.json();
        if (u && typeof u.balance === "number") {
          balanceNode.textContent = u.balance.toString();
          const srcNode = document.querySelector("[data-source]") || document.getElementById("data_source");
          if (srcNode && u.provider) srcNode.textContent = u.provider.toUpperCase();
        }
      }
    }
  } catch (e) {
    console.warn("lobby-balance-fix:", e);
  }
})();
