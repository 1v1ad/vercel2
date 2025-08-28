// Shared helpers for GG ROOM static front
const FRONT = location.origin;

function setUser(u){ try{ localStorage.setItem('user', JSON.stringify(u)); }catch(e){} }
function getUser(){ try{ return JSON.parse(localStorage.getItem('user')||'null'); }catch(e){ return null; } }
function logout(){ localStorage.removeItem('user'); location.href = '/'; }

// Telegram callback (from widget)
async function onTelegramAuth(user){
  try {
    const r = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(user)
    });
    const j = await r.json();
    if(!j.ok){ alert('Ошибка авторизации Telegram'); return; }
    setUser({ id: j.user.id, first_name: j.user.first_name, last_name: j.user.last_name, username: j.user.username, photo: j.user.photo_url, provider: 'telegram' });
    location.href = '/lobby.html';
  } catch (e) {
    alert('Ошибка авторизации Telegram');
  }
}

// Handle VK callback flags (?vk=ok / ?vk=error)
(function(){
  const p = new URLSearchParams(location.search);
  if(p.get('vk') === 'ok'){
    // We cannot fetch profile without user token in this demo; just mark as logged-in.
    setUser({ id: 'vk', first_name: 'VK user', provider: 'vk' });
    history.replaceState({}, '', '/lobby.html');
    location.replace('/lobby.html');
  } else if (p.get('vk') === 'error') {
    alert('Ошибка авторизации VK');
    history.replaceState({}, '', '/');
  }
})();
