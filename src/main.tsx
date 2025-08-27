// ВАЖНО: прогрев — самым первым импортом
import './warmup';

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
