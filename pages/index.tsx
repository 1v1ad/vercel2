import React from "react";

export default function Home() {
  const handleLogin = () => {
    window.location.href = "/api/vk/auth-check";
  };

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <h1>VK One Tap Login</h1>
      <button onClick={handleLogin} style={{ padding: "10px 20px", fontSize: "16px", marginTop: "20px" }}>
        Войти через ВКонтакте
      </button>
    </main>
  );
}