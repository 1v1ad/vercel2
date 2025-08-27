import { useEffect, useMemo, useState } from "react";
import VkLoginButton from "@/components/VkLoginButton";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StoredUser = {
  id?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photo?: string;
  provider?: "vk" | "telegram";
};

function readUser(): StoredUser | null {
  try {
    const v = localStorage.getItem("user");
    return v ? (JSON.parse(v) as StoredUser) : null;
  } catch {
    return null;
  }
}

const Index = () => {
  const [authUser, setAuthUser] = useState<StoredUser | null>(() => readUser());

  // Хотим мгновенный переход ТОЛЬКО сразу после VK-коллбэка (?vk=ok),
  // а во всех прочих случаях — НЕ редиректить автоматически.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("vk") === "ok") {
      if (!localStorage.getItem("user")) {
        localStorage.setItem("user", JSON.stringify({ provider: "vk" }));
      }
      window.history.replaceState({}, "", window.location.pathname);
      window.location.replace("/lobby");
    }
  }, []);

  const displayName = useMemo(() => {
    if (!authUser) return "";
    if (authUser.firstName || authUser.lastName) {
      return [authUser.firstName, authUser.lastName].filter(Boolean).join(" ");
    }
    if (authUser.username) return `@${authUser.username}`;
    if (authUser.provider) return authUser.provider === "vk" ? "VK" : "Telegram";
    return "пользователь";
  }, [authUser]);

  const handleVkLogin = () => {
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/vk/start`;
  };

  const handleTelegramAuth = (tg: any) => {
    const normalized: StoredUser = {
      id: String(tg.id),
      firstName: tg.first_name || "",
      lastName: tg.last_name || "",
      username: tg.username || "",
      photo: tg.photo_url || "",
      provider: "telegram",
    };

    // Сохраняем и обновляем локальный стейт (без немедленного редиректа)
    localStorage.setItem("user", JSON.stringify(normalized));
    localStorage.setItem("tg_raw", JSON.stringify(tg));
    setAuthUser(normalized);

    // Фоном — валидация/склейка на бэке
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/log-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider: "telegram", userData: tg }),
    }).catch(() => {});
  };

  const goLobby = () => window.location.replace("/lobby");

  const logoutLocal = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("vk_user");
    localStorage.removeItem("tg_raw");
    setAuthUser(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Добро пожаловать</h1>
          <p className="text-muted-foreground">Выберите способ входа</p>
        </div>

        {/* Если уже есть локальная авторизация — не редиректим.
            Показываем блок "продолжить / сменить аккаунт". */}
        {authUser && (
          <div className="rounded-xl border p-4 space-y-3">
            <div className="text-sm text-muted-foreground">
              Вы уже вошли{displayName ? ` как ${displayName}` : ""}.
            </div>
            <div className="flex gap-2">
              <button
                onClick={goLobby}
                className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Перейти в лобби
              </button>
              <button
                onClick={logoutLocal}
                className="flex-1 rounded-md border px-4 py-2 hover:bg-accent"
              >
                Сменить аккаунт
              </button>
            </div>
          </div>
        )}

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
