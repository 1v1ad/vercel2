import Script from "next/script";

export default function Home() {
  return (
    <div>
      <h1>VK One Tap Login</h1>
      <div id="vk_ontap_auth" />
      <Script
        strategy="afterInteractive"
        src="https://vk.com/js/api/openapi.js?169"
        onLoad={() => {
          // @ts-ignore
          if (window.VK) {
            // @ts-ignore
            window.VK.Widgets.Auth("vk_ontap_auth", {
              onAuth: function(userData) {
                alert("Добро пожаловать, " + userData.first_name);
              }
            });
          }
        }}
      />
    </div>
  );
}