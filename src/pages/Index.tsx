import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VkLoginButton from "@/components/VkLoginButton";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * ВАЖНО:
 * - Для Telegram передаём на бэкенд ПОЛНЫЙ payload виджета (id, first_name, last_name, username, photo_url, auth_date, hash).
 *   Бэкенд валидирует hash — без него будет 400.
 * - Для VK используем редирект на /api/auth/vk/start (на бэкенде строится URL под VK ID OAuth 2.1).
 */
const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const vkUserData = localStorage.getItem("vk_user");
    const userData = localStorage.getItem("user");
    if (vkUserData || userData) {
      navigate("/lobby");
    }
  }, [navigate]);

  // Старт VK-логина — просто редиректим на бэкенд-роут
  const handleVkLogin = () => {
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/vk/start`;
  };

  // Получаем ПОЛНЫЙ объект из Telegram виджета и шлём на бэкенд как есть
  const handleTelegramAuth = async (tgUser: any) => {
    try {
      // Сохраним "как есть" для последующей склейки аккаунтов
      localStorage.setItem("user", JSON.stringify({ ...tgUser, provider: "telegram" }));

      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/log-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "telegram",
          // Передаём payload без переименований — бэкенд проверит подпись:
          userData: tgUser,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Telegram /log-auth failed", res.status, text);
        return;
      }

      navigate("/lobby");
    } catch (e) {
      console.error("Telegram auth error", e);
    }
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