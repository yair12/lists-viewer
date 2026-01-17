/**
 * Custom hooks for checking sync status of items
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getPendingSyncItems } from '../services/storage/syncQueue';
import { syncManager } from '../services/offline/syncManager';
import { queryKeys } from '../services/api/queryClient';

/**
 * Hook to check if a specific item has pending sync operations
 */
export const useItemPendingSync = (itemId: string) => {
  const queryClient = useQueryClient();

  // Listen to sync events and invalidate when this item is synced
  useEffect(() => {
    const unsubscribe = syncManager.addItemSyncedListener((syncedItemId, resourceType) => {
      console.log(`[useSyncStatus] 📢 Item synced event: ${syncedItemId}, type: ${resourceType}`);
      if (syncedItemId === itemId && resourceType === 'ITEM') {
        console.log(`[useSyncStatus] ✅ Invalidating queries for item: ${itemId}`);
        // Invalidate this specific query so it refetches
        queryClient.invalidateQueries({ queryKey: ['sync-status', 'item', itemId] });
        
        // Also invalidate the items cache to refresh the item data and clear pending flag
        // We don't know the listId here, so invalidate all items queries
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      }
    });

    return unsubscribe;
  }, [itemId, queryClient]);

  return useQuery({
    queryKey: ['sync-status', 'item', itemId],
    queryFn: async () => {
      const pendingItems = await getPendingSyncItems();
      const hasPending = pendingItems.some(item => 
        item.resourceType === 'ITEM' && item.resourceId === itemId
      );
      console.log(`[useSyncStatus] Query result for ${itemId}: hasPending=${hasPending}, queueLength=${pendingItems.length}`);
      return hasPending;
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
