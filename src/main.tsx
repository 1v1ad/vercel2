// IMPORTANT: keep this very first to warm the backend on Render
import './warmup';

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
