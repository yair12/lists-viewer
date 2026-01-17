/**
 * Network Status Service
 * Monitors online/offline status and provides network-related utilities
 */

type NetworkStatusListener = (isOnline: boolean) => void;

const HEALTH_CHECK_INTERVAL = 10000; // Check every 10 seconds when offline
const HEALTH_CHECK_URL = '/api/v1/health'; // Backend health endpoint

class NetworkStatusService {
  private listeners: Set<NetworkStatusListener> = new Set();
  private _isOnline: boolean = navigator.onLine;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private isChecking: boolean = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize network status listeners
   */
  private init(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Initial check
    this.checkServerHealth();
    
    // Set up periodic checks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.checkServerHealth();
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Check if server is actually reachable
   */
  private async checkServerHealth(): Promise<void> {
    if (this.isChecking) return;
    
    this.isChecking = true;
    
    try {
      const response = await fetch(HEALTH_CHECK_URL, {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      
      const isHealthy = response.ok;
      
      // Only notify if status changed
      if (isHealthy !== this._isOnline) {
        console.log(`[Network] Server health check: ${isHealthy ? 'ONLINE' : 'OFFLINE'}`);
        this._isOnline = isHealthy;
        this.notifyListeners(isHealthy);
      }
    } catch (error) {
      // Server unreachable
      if (this._isOnline) {
        console.log('[Network] Server unreachable, going offline');
        this._isOnline = false;
        this.notifyListeners(false);
      }
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Handle online event from browser
   */
  private handleOnline = () => {
    console.log('[Network] Browser detected connection');
    // Don't trust browser event alone, check server health
    this.checkServerHealth();
  };

  /**
   * Handle offline event from browser
   */
  private handleOffline = () => {
    console.log('[Network] Browser detected disconnection');
    this._isOnline = false;
    this.notifyListeners(false);
  };

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach((listener) => {
      try {
        listener(isOnline);
      } catch (error) {
        console.error('[Network] Error in listener:', error);
      }
    });
  }

  /**
   * Get current online status
   */
  public get isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Add a listener for network status changes
   */
  public addListener(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Remove a listener
   */
  public removeListener(listener: NetworkStatusListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Test network connectivity by making a request
   */
  public async testConnectivity(): Promise<boolean> {
    await this.checkServerHealth();
    return this._isOnline;
  }

  /**
   * Wait for online connection
   */
  public async waitForOnline(timeout?: number): Promise<boolean> {
    if (this._isOnline) {
      return true;
    }

    return new Promise((resolve) => {
      const listener = (isOnline: boolean) => {
        if (isOnline) {
          this.removeListener(listener);
          resolve(true);
        }
      };

      this.addListener(listener);

      // Optional timeout
      if (timeout) {
        setTimeout(() => {
          this.removeListener(listener);
          resolve(false);
        }, timeout);
      }
    });
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners.clear();
  }
}

// Export singleton instance
export const networkStatus = new NetworkStatusService();

// Expose for dev/test access
if (typeof window !== 'undefined') {
  (window as any).__networkStatus = networkStatus;
}

export default networkStatus;
