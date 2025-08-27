// 1) прогрев бэка — самым первым
import './warmup'

// 2) если используешь мой хелпер для ВК — подключи его после прогрева
import './vk-wire'  // можно убрать, если не нужен

// дальше — как у тебя было
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(<App />)

