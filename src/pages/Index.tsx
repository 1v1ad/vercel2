import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VkLoginButton from "@/components/VkLoginButton";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем, авторизован ли уже пользователь (VK или Telegram)
    const vkUserData = localStorage.getItem('vk_user');
    const userData = localStorage.getItem('user');
    if (vkUserData || userData) {
      navigate('/lobby');
    }
  }, [navigate]);

  const handleVkLogin = async () => {
    try {
      // Инициализируем VK SDK
      if (typeof window !== 'undefined' && window.VK) {
        window.VK.init({
          apiId: 54008517, // ID из вашего скриншота
        });

        // Авторизация через VK
        window.VK.Auth.login((response: any) => {
          if (response.session) {
            const user = response.session.user;
            
            // Сохраняем данные пользователя
            const userData = {
              id: user.id,
              firstName: user.first_name,
              lastName: user.last_name,
              photo: user.photo,
            };
            
            localStorage.setItem('vk_user', JSON.stringify(userData));
            localStorage.setItem('user', JSON.stringify({...userData, provider: 'vk'}));
            
            // Отправляем данные авторизации на backend
            logAuthAction(userData, 'vk');
            
            // Переходим в lobby
            navigate('/lobby');
          } else {
            console.error('VK Auth failed');
          }
        });
      } else {
        console.error('VK SDK not loaded');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Обработка авторизации через Telegram
  const handleTelegramAuth = async (user: any) => {
    try {
      const userData = {
        id: user.id.toString(),
        firstName: user.first_name,
        lastName: user.last_name || '',
        username: user.username || '',
        photo: user.photo_url || '',
        authDate: user.auth_date,
        provider: 'telegram'
      };

      // Сохраняем данные пользователя
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Логируем авторизацию
      await logAuthAction(userData, 'telegram');
      
      // Перенаправляем в лобби
      navigate('/lobby');
    } catch (error) {
      console.error('Telegram auth error:', error);
    }
  };

  // Логирование авторизации в бэкенд
  const logAuthAction = async (userData: any, provider: 'vk' | 'telegram') => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/log-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.id,
          action: `${provider}_login`,
          timestamp: new Date().toISOString(),
          userData: {
            ...userData,
            provider
          }
        }),
      });
      
      const result = await response.json();
      console.log('Auth logged:', result);
    } catch (error) {
      console.error('Error logging auth:', error);
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
