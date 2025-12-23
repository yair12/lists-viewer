// Service Worker Update Manager
export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;

  async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully');

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('New service worker available');
              this.notifyUpdate();
            }
          });
        }
      });

      // Check for updates periodically
      this.scheduleUpdateChecks();

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'CACHE_UPDATED') {
          console.log('Cache updated:', event.data.url);
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  private scheduleUpdateChecks(): void {
    // Check for updates every hour
    setInterval(() => {
      this.registration?.update();
    }, 60 * 60 * 1000);

    // Check on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.registration?.update();
      }
    });
  }

  private notifyUpdate(): void {
    // You can dispatch a custom event here to show a notification to the user
    const event = new CustomEvent('sw-update-available');
    window.dispatchEvent(event);
  }

  async skipWaiting(): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  async unregister(): Promise<void> {
    if (this.registration) {
      await this.registration.unregister();
      console.log('Service Worker unregistered');
    }
  }
}

// Cache helper functions
export const cacheManager = {
  async cacheResources(resources: string[]): Promise<void> {
    if (!('caches' in window)) return;

    const cache = await caches.open('manual-cache-v1');
    await cache.addAll(resources);
  },

  async getCachedResource(url: string): Promise<Response | undefined> {
    if (!('caches' in window)) return undefined;

    return await caches.match(url);
  },

  async clearCache(cacheName?: string): Promise<void> {
    if (!('caches' in window)) return;

    if (cacheName) {
      await caches.delete(cacheName);
    } else {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  },

  async getCacheSize(): Promise<number> {
    if (!('caches' in window)) return 0;

    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return totalSize;
  }
};

// Initialize service worker
export const initServiceWorker = async (): Promise<ServiceWorkerManager> => {
  const swManager = new ServiceWorkerManager();
  await swManager.register();
  return swManager;
};
