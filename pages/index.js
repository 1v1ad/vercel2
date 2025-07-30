export default function Home() {
  return (
    <div>
      <h1>VK One Tap Login</h1>
      <script src="https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `
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

          oneTap.render({
            container: document.body,
            showAlternativeLogin: true,
            oauthList: ['mail_ru']
          })
          .on(VKID.WidgetEvents.ERROR, console.error)
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, function (payload) {
            const code = payload.code;
            const deviceId = payload.device_id;
            VKID.Auth.exchangeCode(code, deviceId)
              .then(console.log)
              .catch(console.error);
          });
        }
      `}} />
    </div>
  );
}
