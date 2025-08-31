// GG ROOM static helpers
const FRONT = location.origin;
const DEFAULT_BACKEND = (FRONT.includes('netlify.app') || FRONT.includes('localhost'))
  ? 'https://vercel2pr.onrender.com'
  : FRONT; // на проде бек может быть тем же доменом

const BACKEND_URL = (window.BACKEND_URL || DEFAULT_BACKEND).replace(/\/+$/, '');

// storage helpers
function setUser(u){ try{ localStorage.setItem('user', JSON.stringify(u)); }catch(e){} }
function getUser(){ try{ return JSON.parse(localStorage.getItem('user')||'null'); }catch(e){ return null; } }
function logout(){ localStorage.removeItem('user'); location.href = '/'; }

// Telegram callback (from widget)
async function onTelegramAuth(user){
  try {
    const r = await fetch(BACKEND_URL + '/api/auth/telegram', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(user)
    });
    const j = await r.json();
    if(!r.ok || !j || j.ok === false){
      alert('Ошибка авторизации Telegram');
      return;
    }
    const u = {
      id: j.user?.id?.toString?.() || user.id?.toString?.() || 'tg',
      first_name: j.user?.first_name || user.first_name || '',
      last_name: j.user?.last_name || user.last_name || '',
      username: j.user?.username || user.username || '',
      photo: j.user?.photo_url || user.photo_url || '',
      provider: 'telegram'
    };
    setUser(u);
    location.href = '/lobby.html';
  } catch (e) {
    alert('Ошибка авторизации Telegram');
  }
}

// VK button
document.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('#vkBtn');
  if(!btn) return;
  // дергаем старт на бэке
  const next = encodeURIComponent(FRONT);
  location.href = BACKEND_URL + '/api/auth/vk/start?next=' + next;
});

// VK callback (?vk=ok / ?vk=error)
(function(){
  const p = new URLSearchParams(location.search);
  if(p.get('vk') === 'ok'){
    // Бэкенд редиректнул нас после обмена кода на токен. Для MVP просто
    // помечаем пользователя заглушкой: реальный профиль можно запросить
    // дополнительно, если нужен.
    const stub = { id:'vk', first_name:'VK user', provider:'vk' };
    setUser(stub);
    history.replaceState({}, '', '/lobby.html');
    location.replace('/lobby.html');
  } else if(p.get('vk') === 'error'){
    alert('Ошибка авторизации VK');
    history.replaceState({}, '', '/');
  }
})();
