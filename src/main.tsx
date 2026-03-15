import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App';

// ── Global error safety net ─────────────────────────────────────────────────
// Prevent unhandled promise rejections from crashing/reloading the page.
// React Error Boundaries only catch synchronous render errors — async errors
// (API calls, Zustand persist, setTimeout callbacks) bypass them entirely.
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  console.error('Unhandled promise rejection (caught globally):', event.reason);
});

// Prevent uncaught errors from crashing/reloading the page.
window.addEventListener('error', (event) => {
  event.preventDefault();
  console.error('Uncaught error (caught globally):', event.error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
