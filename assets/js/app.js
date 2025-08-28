/* GG ROOM – фронтовые хелперы (статическая выдача Netlify) */

/* ====== конфиг ====== */
// если хочешь — можешь определить window.BACKEND_URL в index.html/lobby.html до подключения app.js
const BACKEND = (window.BACKEND_URL || 'https://vercel2pr.onrender.com').replace(/\/+$/,'');
const FRONT    = location.origin;

/* ====== storage ====== */
function setUser(u){ try{ localStorage.setItem('user', JSON.stringify(u)); }catch(e){} }
function getUser(){ try{ return JSON.parse(localStorage.getItem('user')||'null'); }catch(e){ return null; } }
function clearUser(){ try{ localStorage.removeItem('user'); }catch(e){} }
function logout(){ clearUser(); location.href = '/'; }

/* ====== утилиты ====== */
async function postJSON(url, body){
  const r = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  let data = null;
  try { data = await r.json(); } catch(_) {}
  return { ok: r.ok, status: r.status, data };
}
function $(sel){ return document.querySelector(sel); }

/* ====== Telegram ======
   Виджет вызывает глобальную функцию onTelegramAuth(user)
   user содержит id, first_name, last_name, username, photo_url, auth_date, hash
*/
async function onTelegramAuth(user){
  try {
    const { ok, status, data } = await postJSON(`${BACKEND}/api/auth/telegram`, user);
    if(!ok || !data || data.ok === false){
      alert('Ошибка авторизации Telegram');
      return;
    }
    // нормализуем пользователя
    const u = data.user || user;
    setUser({
      id: String(u.id),
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      username: u.username || '',
      photo: u.photo_url || u.photo || '',
      provider: 'telegram'
    });
    location.href = '/lobby.html';
  } catch (e) {
    alert('Ошибка авторизации Telegram');
  }
}
// делаем доступной глобально для виджета
window.onTelegramAuth = onTelegramAuth;

/* ====== VK ======
   Кнопка "Войти через VK ID" просто редиректит на BACKEND,
   где стартует OAuth, затем нас вернут на FRONT с ?vk=ok или ?vk=error
*/
function bindVkButton(){
  const btn = document.getElementById('btn-vk');
  if(!btn) return;
  btn.addEventListener('click', () => {
    // если на бэке уже задан FRONTEND_URL, достаточно стартовой точки:
    location.href = `${BACKEND}/api/auth/vk/start`;
  });
}

/* ====== обработка query-параметров после возврата с VK ====== */
(function handleVkCallbackFlag(){
  const p = new URLSearchParams(location.search);
  if (p.get('vk') === 'ok'){
    // мы не имеем user access token, поэтому просто пометим авторизацию
    const u = getUser() || {};
    setUser({ ...u, id: u.id || 'vk', first_name: u.first_name || 'VK user', provider: 'vk' });
    // очистим query и уйдём в лобби
    history.replaceState({}, '', '/');
    location.replace('/lobby.html');
  } else if (p.get('vk') === 'error'){
    alert('Ошибка авторизации VK');
    history.replaceState({}, '', '/');
  }
})();

/* ====== инициализация индексной страницы ====== */
function initIndex(){
  bindVkButton();
  // можно показать состояние входа (например, уже авторизован)
  const u = getUser();
  if (u && (u.provider === 'vk' || u.provider === 'telegram')){
    // уже авторизованы — перекидываем в лобби
    // закомментируй, если хочешь всегда оставаться на экране логина
    // location.replace('/lobby.html');
  }
}

/* ====== инициализация лобби ====== */
function initLobby(){
  const u = getUser();
  // простая защита от пустого профиля
  if(!u){
    // возвращаемся на логин, но без зацикливания
    location.replace('/');
    return;
  }
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || (u.username ? '@'+u.username : 'Пользователь');
  const avatar = u.photo || '/assets/avatar-placeholder.png';

  const nameEl = $('#user-name');
  const idEl   = $('#user-id');
  const avEl   = $('#user-avatar');

  if (nameEl) nameEl.textContent = name;
  if (idEl)   idEl.textContent   = `id: ${u.id} • провайдер: ${u.provider}`;
  if (avEl)   avEl.src = avatar;

  // если захочешь логировать посещение — раскомментируй и убедись, что на бэке есть маршрут:
  // fetch(`${BACKEND}/api/log/visit`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: u.id, ts: Date.now() }) }).catch(()=>{});
}

/* ====== точка входа ====== */
document.addEventListener('DOMContentLoaded', () => {
  if (location.pathname.endsWith('/lobby.html')) {
    initLobby();
  } else {
    initIndex();
  }
});
