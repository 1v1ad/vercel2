import Script from "next/script"

export default function Home() {
  return (
    <div>
      <h1>VK One Tap Login</h1>
      <div id="vk_ontap_auth"></div>
      <Script
        src="https://vk.com/js/api/openapi.js?169"
        strategy="afterInteractive"
        onLoad={() => {
          // @ts-ignore
          if (window.VK) {
            // @ts-ignore
            window.VK.init({ apiId: parseInt(process.env.NEXT_PUBLIC_VK_APP_ID || "0") });
            // @ts-ignore
            window.VK.Widgets.Auth("vk_ontap_auth", { width: "280px" });
          }
        }}
      />
    </div>
  );
}