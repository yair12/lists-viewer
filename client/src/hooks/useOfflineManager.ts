import { useState, useEffect } from 'react';
import { getPendingSyncCount } from '../services/storage/syncQueue';

export function useOfflineManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Network: Online');
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      console.log('🔴 Network: Offline');
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Poll queue for pending count
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const pending = await getPendingSyncCount();
        setPendingCount(pending);
      } catch (error) {
        console.error('Error fetching pending count:', error);
      }
    };

    // Update immediately
    updatePendingCount();

    // Then poll every 2 seconds
    const interval = setInterval(updatePendingCount, 2000);
    
    return () => clearInterval(interval);
  }, []);

  return { 
    isOnline, 
    pendingCount, 
    syncInProgress,
    setSyncInProgress 
  };
}
