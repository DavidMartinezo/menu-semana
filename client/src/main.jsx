import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AuthGate from './components/AuthGate.jsx';
import './index.css';
import { initAnalytics } from './lib/analytics.js';

initAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>
);
