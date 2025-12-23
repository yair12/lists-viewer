import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initServiceWorker } from './utils/serviceWorker'

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await initServiceWorker();
      
      // Listen for service worker updates
      window.addEventListener('sw-update-available', () => {
        console.log('New version available! Please reload the page.');
        // You can show a toast notification here
      });

      // Log cache status
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('Active caches:', cacheNames);
      }
    } catch (error) {
      console.error('Failed to initialize service worker:', error);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
