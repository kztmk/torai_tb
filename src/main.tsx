import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App';

console.log('appKey', import.meta.env.VITE_APP_MODE);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
