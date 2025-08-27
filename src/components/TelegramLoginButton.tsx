import { useEffect, useRef } from "react";

type Props = { onAuth: (user: any) => void };

export default function TelegramLoginButton({ onAuth }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", import.meta.env.VITE_TELEGRAM_BOT); // GGR00m_bot
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "true"); // аватар на кнопке
    script.setAttribute("data-onauth", "onTelegramAuth");
    script.setAttribute("data-request-access", "write");

    (window as any).onTelegramAuth = (user: any) => onAuth(user);

    if (ref.current) {
      ref.current.innerHTML = "";
      ref.current.appendChild(script);
    }
    return () => {
      if (ref.current) ref.current.innerHTML = "";
      delete (window as any).onTelegramAuth;
    };
  }, [onAuth]);

  return <div ref={ref} className="flex justify-center" />;
}
