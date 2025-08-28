// assets/js/app.js
(function () {
  // === БАЗОВЫЕ НАСТРОЙКИ ===
  // если меняешь бэкенд — поменяй только эту строку
  const API = 'https://vercel2pr.onrender.com';
  const TG_BOT = 'GGR00m_bot'; // ник без @

  // Общие хелперы доступны глобально
  window.__GG = {
    API,

    // VK -> редирект на бэкенд
    vkLogin() {
      window.location.href = `${API}/api/auth/vk/start`;
    },

    // Telegram -> подтверждение на бэкенд
    async tgFinish(user) {
      try {
        const r = await fetch(`${API}/api/auth/telegram`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(user),
        });
        if (r.ok) {
          window.location.href = '/lobby';
        } else {
          alert('Ошибка авторизации Telegram');
        }
      } catch (e) {
        console.error(e);
        alert('Сбой сети при авторизации Telegram');
      }
    },

    // Получить текущего юзера (для лобби)
    async me() {
      try {
        const r = await fetch(`${API}/api/me`, { credentials: 'include' });
        return r.ok ? r.json() : { ok: false };
      } catch {
        return { ok: false };
      }
    },
  };

  // Колбэк, который дергает Telegram-виджет
  window.onTelegramAuth = function (user) {
    window.__GG.tgFinish(user);
  };

  // Автовставка Telegram-виджета, если есть контейнер #tg-login
  document.addEventListener('DOMContentLoaded', () => {
    const tg = document.getElementById('tg-login');
    if (tg && !tg.dataset.inited) {
      tg.dataset.inited = '1';
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      s.setAttribute('data-telegram-login', TG_BOT);
      s.setAttribute('data-size', 'large');
      s.setAttribute('data-userpic', 'true');
      s.setAttribute('data-request-access', 'write');
      s.setAttribute('data-onauth', 'onTelegramAuth(user)');
      tg.appendChild(s);
    }
  });
})();
