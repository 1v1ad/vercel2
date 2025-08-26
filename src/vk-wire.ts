// Example bootstrap to wire the #vk-auth button. Import this somewhere after DOM is ready.
import { attachVkLogin } from './lib/vkAuth';

const appId = Number(import.meta.env.VITE_VK_APP_ID || '54008517');
const backend = import.meta.env.VITE_BACKEND_URL || '';

attachVkLogin('#vk-auth', { appId, backendUrl: backend });
