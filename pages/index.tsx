
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://vk.com/js/api/openapi.js?169';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.VK) {
        // @ts-ignore
        window.VK.init({
          apiId: 53969710,
          onlyWidgets: true,
        });

        // @ts-ignore
        window.VK.Widgets.Auth("vk_auth", {});
      }
    };
    document.body.appendChild(script);
  }, []);

  return (
    <div>
      <h1>VK One Tap Login</h1>
      <div id="vk_auth"></div>
    </div>
  );
}
