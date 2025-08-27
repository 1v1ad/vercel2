import { useEffect } from "react";
import VkLoginButton from "@/components/VkLoginButton";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const goLobby = () => window.location.replace("/lobby"); // full reload — обходит строгие гварды

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Возврат из VK: "/?vk=ok" — сохраняем минимальный флаг и уходим в лобби
    if (params.get("vk") === "ok") {
      if (!localStorage.getItem("user")) {
        localStorage.setItem("user", JSON.stringify({ provider: "vk" }));
      }
      window.history.replaceState({}, "", window.location.pathname);
      goLobby();
      return;
    }

    // Уже авторизован? Сразу в лобби
    if (localStorage.getItem("user")) goLobby();
  }, []);

  const handleVkLogin = () => {
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/vk/start`;
  };

  const handleTelegramAuth = (tg: any) => {
    const normalized = {
      id: String(tg.id),
      firstName: tg.first_name || "",
      lastName: tg.last_name || "",
      username: tg.username || "",
      photo: tg.photo_url || "",
      provider: "telegram" as const,
    };

    // Сохраняем минимальный профиль — этого хватает, чтобы пропустить в /lobby
    localStorage.setItem("user", JSON.stringify(normalized));
    localStorage.setItem("tg_raw", JSON.stringify(tg));

    // Сразу переходим в лобби (бэкграундом пойдёт валидация/склейка)
    goLobby();

    // Бэкграунд: валидация подписи TG + фоновая склейка на бэке
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
