import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AuthGate from './components/AuthGate.jsx';
import { LanguageProvider } from './lib/i18n/LanguageContext.jsx';
import './index.css';
import { initAnalytics } from './lib/analytics.js';

initAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <AuthGate />
    </LanguageProvider>
  </StrictMode>
);
