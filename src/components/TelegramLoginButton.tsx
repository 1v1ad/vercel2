import { useEffect } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  onAuth: (user: TelegramUser) => void;
}

const TelegramLoginButton = ({ onAuth }: TelegramLoginButtonProps) => {
  useEffect(() => {
    // Создаем глобальную функцию для callback
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };

    // Создаем скрипт для Telegram Login Widget
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'GGR00m_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    
    const container = document.getElementById('telegram-login-container');
    if (container) {
      container.appendChild(script);
    }

    return () => {
      // Очистка при размонтировании
      if (container && script.parentNode) {
        container.removeChild(script);
      }
      delete (window as any).onTelegramAuth;
    };
  }, [onAuth]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div id="telegram-login-container" className="telegram-login-widget" />
      <p className="text-sm text-muted-foreground text-center">
        Нажмите кнопку выше для входа через Telegram
      </p>
    </div>
  );
};

export default TelegramLoginButton;