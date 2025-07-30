// pages/index.js

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@vkid/sdk@2.7.3/dist-sdk/umd/index.js';
    script.onload = () => {
      if ('VKIDSDK' in window) {
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
            container: document.getElementById('vk_button'),
            showAlternativeLogin: true,
            oauthList: ['mail_ru'],
          })
          .on(VKID.WidgetEvents.ERROR, (err) => console.error('VKID error', err))
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, function (payload) {
            const code = payload.code;
            const deviceId = payload.device_id;

            VKID.Auth.exchangeCode(code, deviceId)
              .then((res) => {
                console.log('VKID auth success', res);
                alert('Успешно вошли! Смотри консоль');
              })
              .catch((err) => {
                console.error('VKID exchange error', err);
              });
          });
      }
    };
    document.body.appendChild(script);
  }, []);

  return (
    <div>
      <h1>VK One Tap Login</h1>
      <div id="vk_button"></div>
    </div>
  );
}
