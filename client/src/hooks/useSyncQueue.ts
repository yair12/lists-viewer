/**
 * Custom hook for sync queue management
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../services/api/queryClient';
import {
  getAllSyncItems,
  getPendingSyncCount,
  getSyncQueueStats,
  retryFailedItems,
  clearSyncedItems,
  hasPendingSync,
} from '../services/storage/syncQueue';

/**
 * Hook to get all sync queue items
 */
export const useSyncQueue = () => {
  return useQuery({
    queryKey: queryKeys.sync.queue,
    queryFn: getAllSyncItems,
    // Refetch every 10 seconds while there are pending items
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPending = data?.some((item) => item.status === 'PENDING' || item.status === 'SYNCING');
      return hasPending ? 10000 : false;
    },
  });
};

/**
 * Hook to get sync queue statistics
 */
export const useSyncQueueStats = () => {
  return useQuery({
    queryKey: queryKeys.sync.stats,
    queryFn: getSyncQueueStats,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

/**
 * Hook to get pending sync count
 */
export const usePendingSyncCount = () => {
  return useQuery({
    queryKey: [...queryKeys.sync.stats, 'count'],
    queryFn: getPendingSyncCount,
    refetchInterval: 5000,
  });
};

/**
 * Hook to check if there are pending sync operations
 */
export const useHasPendingSync = () => {
  return useQuery({
    queryKey: [...queryKeys.sync.stats, 'hasPending'],
    queryFn: hasPendingSync,
    refetchInterval: 5000,
  });
};

/**
 * Utility functions for sync queue management
 */
export const syncQueueUtils = {
  retryFailed: retryFailedItems,
  clearSynced: clearSyncedItems,
};

export default useSyncQueue;
