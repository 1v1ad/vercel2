import { useEffect, useRef } from "react";

declare global {
  interface Window {
    TelegramLoginWidget?: any;
  }
}

type Props = { onAuth: (user: any) => void };

export default function TelegramLoginButton({ onAuth }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Загружаем официальный скрипт Telegram-виджета
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", import.meta.env.VITE_TELEGRAM_BOT); // например, GGR00m_bot
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onTelegramAuth");
    script.setAttribute("data-request-access", "write");

    // Хак: публикуем коллбек в window, чтобы widget смог дернуть
    (window as any).onTelegramAuth = (user: any) => {
      // user содержит id, first_name, last_name, username, photo_url, auth_date, hash
      onAuth(user);
    };

    if (containerRef.current) {
      containerRef.current.innerHTML = ""; // на случай повторной инициализации
      containerRef.current.appendChild(script);
    }

    return () => {
      // прибираемся
      if (containerRef.current) containerRef.current.innerHTML = "";
      delete (window as any).onTelegramAuth;
    };
  }, [onAuth]);

  return <div ref={containerRef} className="flex justify-center" />;
}