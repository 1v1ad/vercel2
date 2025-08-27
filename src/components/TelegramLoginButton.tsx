import { useEffect, useRef } from "react";

type Props = { onAuth: (user: any) => void };

export default function TelegramLoginButton({ onAuth }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (window as any).onTelegramAuth = (user: any) => onAuth(user);

    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", import.meta.env.VITE_TELEGRAM_BOT); // GGR00m_bot
    s.setAttribute("data-size", "large");
    s.setAttribute("data-userpic", "true"); // показать аватар на кнопке
    s.setAttribute("data-onauth", "onTelegramAuth");
    s.setAttribute("data-request-access", "write");

    if (ref.current) {
      ref.current.innerHTML = "";
      ref.current.appendChild(s);
    }
    return () => {
      if (ref.current) ref.current.innerHTML = "";
      delete (window as any).onTelegramAuth;
    };
  }, [onAuth]);

  return <div ref={ref} className="flex justify-center" />;
}
