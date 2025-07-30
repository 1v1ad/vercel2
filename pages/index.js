import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js';
    script.async = true;
    script.onload = () => {
      if ('VKIDSDK' in window) {
        const VKID = window.VKIDSDK;

        VKID.Config.init({
          app: 53969710,
          redirectUrl: 'https://vercel2-eight-blue.vercel.app/api/vk/callback',
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
        });

        const oneTap = new VKID.OneTap();
        oneTap.render({
          container: document.getElementById('vk-button'),
          showAlternativeLogin: true,
          oauthList: ['mail_ru'],
        })
        .on(VKID.WidgetEvents.ERROR, console.error)
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
          const { code, device_id } = payload;
          VKID.Auth.exchangeCode(code, device_id)
            .then(console.log)
            .catch(console.error);
        });
      }
    };
    document.body.appendChild(script);
  }, []);

  return (
    <div>
      <h1>VK One Tap Login</h1>
      <div id="vk-button" />
    </div>
  );
}
