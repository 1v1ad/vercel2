import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VkLoginButton from "@/components/VkLoginButton";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const anyUser = localStorage.getItem("user");
    if (anyUser) navigate("/lobby");
  }, [navigate]);

  // VK — оставляем как было: редиректим на бэкенд (не трогаем рабочий поток)
  const handleVkLogin = () => {
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/vk/start`;
  };

  // Telegram — нормализуем юзера, сохраняем и СРАЗУ идём в /lobby
  const handleTelegramAuth = (tg: any) => {
    const normalized = {
      id: String(tg.id),
      firstName: tg.first_name || "",
      lastName: tg.last_name || "",
      username: tg.username || "",
      photo: tg.photo_url || "",
      provider: "telegram" as const,
    };

    // 1) сохраняем юзера (то, что читает лобби)
    localStorage.setItem("user", JSON.stringify(normalized));
    // опционально — сырое тело ТГ для отладки
    localStorage.setItem("tg_raw", JSON.stringify(tg));

    // 2) мгновенно уходим в лобби — UX без ожиданий сети
    navigate("/lobby");

    // 3) фоном шлём payload на бэк (обязательно весь объект с hash)
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
          <p className="text-muted-foreground">Выберите способ входа</p>
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
