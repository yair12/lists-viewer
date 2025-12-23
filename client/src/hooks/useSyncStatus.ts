/**
 * Custom hooks for checking sync status of items
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getPendingSyncItems } from '../services/storage/syncQueue';
import { syncManager } from '../services/offline/syncManager';

/**
 * Hook to check if a specific item has pending sync operations
 */
export const useItemPendingSync = (itemId: string) => {
  const queryClient = useQueryClient();

  // Listen to sync events and invalidate when this item is synced
  useEffect(() => {
    const unsubscribe = syncManager.addItemSyncedListener((syncedItemId, resourceType) => {
      if (syncedItemId === itemId && resourceType === 'ITEM') {
        // Invalidate this specific query so it refetches
        queryClient.invalidateQueries({ queryKey: ['sync-status', 'item', itemId] });
      }
    });

    return unsubscribe;
  }, [itemId, queryClient]);

  return useQuery({
    queryKey: ['sync-status', 'item', itemId],
    queryFn: async () => {
      const pendingItems = await getPendingSyncItems();
      return pendingItems.some(item => 
        item.resourceType === 'ITEM' && item.resourceId === itemId
      );
    },
    refetchInterval: 2000, // Check every 2 seconds as fallback
    staleTime: 0, // Always consider stale to refetch
  });
};

/**
 * Hook to get all pending sync items (for displaying sync indicator)
 */
export const usePendingSyncCount = () => {
  return useQuery({
    queryKey: ['sync-status', 'pending-count'],
    queryFn: async () => {
      const pendingItems = await getPendingSyncItems();
      return pendingItems.length;
    },
    refetchInterval: 2000, // Check every 2 seconds
  });
};
