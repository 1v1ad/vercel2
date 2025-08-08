const PKCE = {
  async generate() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const codeVerifier = PKCE.base64Url(bytes);
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(codeVerifier));
    const codeChallenge = PKCE.base64Url(new Uint8Array(digest));
    return { codeVerifier, codeChallenge };
  },
  deviceId() {
    let id = localStorage.getItem('device_id');
    if (!id) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      id = PKCE.base64Url(bytes);
      localStorage.setItem('device_id', id);
    }
    return id;
  },
  base64Url(bytes) {
    let binary = '';
    const len = bytes.length;
    for (let i=0; i<len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
  }
};
