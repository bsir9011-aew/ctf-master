import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);

// The packaged Android WebView already contains all static assets. Do not
// register the website PWA service worker over Capacitor's local host.
// The deployed HTTPS PWA keeps its existing offline worker.
const nativeLocalHost = window.location.hostname === 'localhost';
if ('serviceWorker' in navigator && import.meta.env.PROD && !nativeLocalHost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* optional offline support */ });
  });
}
