import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserProfile from "@/components/UserProfile";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const Lobby = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Проверяем авторизацию и логируем посещение лобби
    const vkUserData = localStorage.getItem('vk_user');
    const userData = localStorage.getItem('user');
    const currentUser = userData ? JSON.parse(userData) : (vkUserData ? JSON.parse(vkUserData) : null);
    
    if (!currentUser) {
      navigate('/');
      return;
    }
    
    setUser(currentUser);
    logLobbyVisit(currentUser);
  }, [navigate]);

  const logLobbyVisit = async (userData: any) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/log-visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.id,
          action: 'lobby_visit',
          timestamp: new Date().toISOString(),
          userData: userData,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to log lobby visit');
      }
    } catch (error) {
      console.error('Error logging lobby visit:', error);
    }
  };

  const handleLogout = () => {
    // Очищаем все данные пользователя
    localStorage.removeItem('vk_user');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (!user) {
    return null; // Будет перенаправление
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <UserProfile user={user} onLogout={handleLogout} />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <Card className="p-8 bg-white shadow-card">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                <h2 className="text-2xl font-bold text-foreground">Вы успешно авторизованы!</h2>
                <p className="text-muted-foreground">
                  Провайдер: <span className="font-medium">
                    {user?.provider === 'telegram' ? 'Telegram' : 'ВКонтакте'}
                  </span>
                </p>
              </div>
              
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Время авторизации: {new Date().toLocaleString('ru-RU')}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-white shadow-card">
            <h2 className="text-xl font-semibold mb-4">Информация о сессии</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Имя:</span>
                  <p className="text-foreground">{user?.firstName} {user?.lastName}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">ID:</span>
                  <p className="text-foreground font-mono text-xs">{user?.id}</p>
                </div>
                {user?.username && (
                  <div>
                    <span className="font-medium text-muted-foreground">Username:</span>
                    <p className="text-foreground">@{user.username}</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-muted-foreground">Провайдер:</span>
                  <p className="text-foreground capitalize">{user?.provider || 'vk'}</p>
                </div>
              </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Lobby;