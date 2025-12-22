/**
 * Custom hook for network status monitoring
 */

import { useState, useEffect } from 'react';
import { networkStatus } from '../services/offline/networkStatus';

/**
 * Hook to monitor network online/offline status
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(networkStatus.isOnline);

  useEffect(() => {
    // Subscribe to network status changes
    const unsubscribe = networkStatus.addListener((online) => {
      setIsOnline(online);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    testConnectivity: networkStatus.testConnectivity.bind(networkStatus),
    waitForOnline: networkStatus.waitForOnline.bind(networkStatus),
  };
};

export default useNetworkStatus;
