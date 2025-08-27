import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VkLoginButton from "@/components/VkLoginButton";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 1) Возврат с VK: /?vk=ok -> пускаем в лобби
    const params = new URLSearchParams(window.location.search);
    if (params.get("vk") === "ok") {
      if (!localStorage.getItem("user")) {
        // кладём минимальную метку, чтобы роутер не выпихивал
        localStorage.setItem("user", JSON.stringify({ provider: "vk" }));
      }
      // чистим query, чтобы не мешал
      window.history.replaceState({}, "", window.location.pathname);
      navigate("/lobby");
      return;
    }

    // 2) Уже есть пользователь? Сразу в лобби
    const anyUser = localStorage.getItem("user");
    if (anyUser) navigate("/lobby");
  }, [navigate]);

  // VK — не трогаем бэк, просто отправляем на старт
  const handleVkLogin = () => {
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/vk/start`;
  };

  // Telegram — нормализуем, сохраняем, мгновенно идём в лобби; лог на бэк — фоном
  const handleTelegramAuth = (tg: any) => {
    const normalized = {
      id: String(tg.id),
      firstName: tg.first_name || "",
      lastName: tg.last_name || "",
      username: tg.username || "",
      photo: tg.photo_url || "",
      provider: "telegram" as const,
    };

    // 1) сохраняем то, что ожидает твой лобби-guard
    localStorage.setItem("user", JSON.stringify(normalized));
    // опционально — сырое тело виджета для отладки
    localStorage.setItem("tg_raw", JSON.stringify(tg));

    // 2) мгновенно уходим в лобби — UX без ожиданий сети
    navigate("/lobby");

    // 3) фоновая валидация подписи + склейка на бэке
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/log-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider: "telegram", userData: tg }),
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Добро пожаловать</h1>
        </div>

        <Tabs defaultValue="vk" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vk">ВКонтакте</TabsTrigger>
            <TabsTrigger value="telegram">Telegram</TabsTrigger>
          </TabsList>

          <TabsContent value="vk" className="space-y-4">
            <VkLoginButton onLogin={handleVkLogin} />
          </TabsContent>

          <TabsContent value="telegram" className="space-y-4">
            <TelegramLoginButton onAuth={handleTelegramAuth} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
