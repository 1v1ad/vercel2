import Head from 'next/head'
import Script from 'next/script'
import { useEffect } from 'react'

export default function Home() {
  useEffect(() => {
    window.VKID?.Config.init({
      app: 53969710,
      responseMode: window.VKID?.ConfigResponseMode.JWT,
      source: window.VKID?.ConfigSource.LOWCODE,
    });

    const oneTap = new window.VKID?.OneTap();
    oneTap?.render({
      container: document.getElementById('vk_button'),
      showAlternativeLogin: true,
      oauthList: []
    })
    .on(window.VKID.WidgetEvents.ERROR, console.error)
    .on(window.VKID.OneTapInternalEvents.LOGIN_SUCCESS, function (payload) {
      const jwt = payload.token;
      console.log("VK JWT Token:", jwt);
    });
  }, []);

  return (
    <>
      <Head>
        <title>VK One Tap Login</title>
      </Head>
      <h1>VK One Tap Login</h1>
      <div id="vk_button"></div>
      <Script src="https://unpkg.com/@vkid/sdk@3.0.0/dist/sdk.umd/index.js" strategy="afterInteractive" />
    </>
  )
}
