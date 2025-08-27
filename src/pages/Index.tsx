import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VkLoginButton from "@/components/VkLoginButton";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startVkLogin } from "@/lib/vkCodeflow";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем реальную авторизацию через бек (+aid cookie), а не localStorage
    const check = async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/me`, { credentials: 'include' });
        const json = await resp.json();
        if (json?.data?.user) navigate('/lobby');
      } catch {}
    };
    check();
  }, [navigate]);

  const handleVkLogin = () => {
    // Полный редирект на наш бекенд (OAuth code flow). Никакого openapi.js
    startVkLogin('/lobby');
  };

  // Обработка авторизации через Telegram
  const handleTelegramAuth = async (user: any) => {
    try {
      const userData = {
        id: String(user.id),
        firstName: user.first_name,
        lastName: user.last_name || '',
        username: user.username || '',
        photo: user.photo_url || '',
        authDate: user.auth_date,
        provider: 'telegram'
      };

      // Логируем авторизацию (параллельно бэк ставит aid для склейки)
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/log-auth`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData.id,
          action: 'telegram_login',
          timestamp: new Date().toISOString(),
          userData
        }),
      });

      navigate('/lobby');
    } catch (error) {
      console.error('Telegram auth error:', error);
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
