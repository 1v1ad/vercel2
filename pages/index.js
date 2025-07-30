import Script from "next/script";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    if (window.VKIDSDK) {
      const VKID = window.VKIDSDK;

      VKID.Config.init({
        app: 53969710,
        redirectUrl: 'https://vercel2-eight-blue.vercel.app/api/vk/callback',
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: '',
      });

      const oneTap = new VKID.OneTap();

      oneTap
        .render({
          container: document.getElementById("vk-container"),
          showAlternativeLogin: true,
          oauthList: ["mail_ru"],
        })
        .on(VKID.WidgetEvents.ERROR, (error) => {
          console.error("VK ERROR", error);
        })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
          const { code, device_id } = payload;

          VKID.Auth.exchangeCode(code, device_id)
            .then((res) => console.log("VKID Auth success", res))
            .catch((err) => console.error("VKID Auth failed", err));
        });
    }
  }, []);

  return (
    <>
      <Script
        src="https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js"
        strategy="beforeInteractive"
      />
      <h1>VK One Tap Login</h1>
      <div id="vk-container"></div>
    </>
  );
}
