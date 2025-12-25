/**
 * Custom hooks for items data fetching and mutations
 */

import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../services/api/items';
import { queryKeys } from '../services/api/queryClient';
import { isNetworkError } from '../services/api/client';
import { addToSyncQueue, getResourcesWithPendingDelete } from '../services/storage/syncQueue';
import { 
  cacheItem, 
  cacheItems, 
  getCachedItemsByList, 
  removeCachedItem
} from '../services/storage/cacheManager';
import { STORES, putItem } from '../services/storage/indexedDB';
import type { 
  Item, 
  CreateItemRequest, 
  UpdateItemRequest,
  ReorderItemsRequest,
  MoveItemRequest 
} from '../types';

/**
 * Hook to fetch items for a list
 */
export const useItems = (listId: string | null, includeArchived = false) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: listId ? queryKeys.items.byList(listId) : ['items', 'null'],
    queryFn: async () => {
      if (!listId) {
        return [];
      }

      try {
        const items = await itemsApi.getByListId(listId, includeArchived);
        // Cache the items
        await cacheItems(items);
        
        // Filter out items with pending DELETE operations
        const pendingDeletes = await getResourcesWithPendingDelete('ITEM');
        const filteredItems = items.filter(item => !pendingDeletes.includes(item.id));
        return filteredItems;
      } catch (error) {
        // If network error, return cached data (don't throw)
        if (isNetworkError(error)) {
          console.log('[useItems] Network error, returning cached data');
          const cached = await getCachedItemsByList(listId);
          // Filter out items with pending DELETE operations
          const pendingDeletes = await getResourcesWithPendingDelete('ITEM');
          const filteredItems = cached.filter(item => !pendingDeletes.includes(item.id));
          
          // Merge with existing React Query cache to preserve optimistic updates
          const existingCache = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId)) || [];
          const cachedIds = new Set(filteredItems.map((i: Item) => i.id));
          const optimisticItems = existingCache.filter((i: Item) => !cachedIds.has(i.id) && i.pending);
          
          return [...filteredItems, ...optimisticItems];
        }
        // For other errors, still return cache to prevent UI blocking
        console.error('[useItems] Error fetching items, falling back to cache:', error);
        const cached = await getCachedItemsByList(listId);
        // Filter out items with pending DELETE operations
        const pendingDeletes = await getResourcesWithPendingDelete('ITEM');
        const filteredItems = cached.filter(item => !pendingDeletes.includes(item.id));
        
        // Merge with existing cache to preserve optimistic updates
        const existingCache = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId)) || [];
        const cachedIds = new Set(filteredItems.map((i: Item) => i.id));
        const optimisticItems = existingCache.filter((i: Item) => !cachedIds.has(i.id) && i.pending);
        
        return [...filteredItems, ...optimisticItems];
      }
    },
    enabled: !!listId,
    staleTime: 0, // Always consider data stale to ensure fresh fetch
    refetchInterval: () => {
      // Don't poll if sync is in progress or if mutations are active
      if ((window as any).__syncInProgress || (window as any).__mutationInProgress) {
        return false;
      }
      return 10000; // Poll every 10 seconds otherwise
    },
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
    refetchOnMount: 'always', // Always refetch on mount
    refetchOnWindowFocus: false, // Don't refetch on focus to preserve optimistic updates
    retry: false, // Don't retry failed requests
  });
};

/**
 * Hook to fetch a single item
 */
export const useItem = (listId: string | null, itemId: string | null) => {
  return useQuery({
    queryKey: listId && itemId ? queryKeys.items.detail(listId, itemId) : ['items', 'null', 'null'],
    queryFn: async () => {
      if (!listId || !itemId) {
        return null;
      }

      try {
        const item = await itemsApi.getById(listId, itemId);
        await cacheItem(item);
        return item;
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useItem] Network error, checking cache');
          const cachedItems = await getCachedItemsByList(listId);
          const cached = cachedItems.find(i => i.id === itemId) || null;
          return cached; // Return cached data, don't throw
        }
        // For other errors, still try cache
        console.error('[useItem] Error fetching item, falling back to cache:', error);
        const cachedItems = await getCachedItemsByList(listId);
        const cached = cachedItems.find(i => i.id === itemId) || null;
        return cached;
      }
    },
    enabled: !!listId && !!itemId,
    staleTime: 30000,
    retry: false,
  });
};

/**
 * Hook to create a new item
 */
export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async ({ listId, data }: { listId: string; data: CreateItemRequest }) => {
      // Generate unique ID for optimistic item
      const tempId = uuidv4();
      const optimisticItem: Item = {
        id: tempId,
        listId,
        type: data.type,
        name: data.name,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'pending',
        updatedBy: 'pending',
        version: 1,
        order: data.order ?? 9999,
        quantity: data.quantity,
        quantityType: data.quantityType,
        userIconId: data.userIconId || '',
        description: data.description,
        pending: true,
      };
      
      // Save to IndexedDB
      await putItem(STORES.ITEMS, optimisticItem);
      
      // Add to sync queue
      await addToSyncQueue('CREATE', 'ITEM', tempId, data, 1, listId);
      
      // Optimistic update in React Query cache
      const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId)) || [];
      queryClient.setQueryData(queryKeys.items.byList(listId), [...currentItems, optimisticItem]);
      queryClient.setQueryData(queryKeys.items.detail(listId, tempId), optimisticItem);
      
      return optimisticItem;
    },
  });
};

/**
 * Hook to update an item
 */
export const useUpdateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async ({ 
      listId, 
      itemId, 
      data 
    }: { 
      listId: string; 
      itemId: string; 
      data: UpdateItemRequest 
    }) => {
      console.log('[useUpdateItem] Updating item offline-first', { listId, itemId });
      
      // Get existing item from React Query cache or IndexedDB
      let existingItem: Item | undefined;
      const reactQueryItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId));
      if (reactQueryItems) {
        existingItem = reactQueryItems.find(i => i.id === itemId);
      }
      
      if (!existingItem) {
        const cachedItems = await getCachedItemsByList(listId);
        existingItem = cachedItems.find(i => i.id === itemId);
      }

      if (!existingItem) {
        throw new Error(`Item ${itemId} not found in cache`);
      }

      // Create updated item with pending flag
      const updatedItem: Item = {
        ...existingItem,
        name: data.name ?? existingItem.name,
        completed: data.completed ?? existingItem.completed,
        quantity: data.quantity ?? existingItem.quantity,
        quantityType: data.quantityType ?? existingItem.quantityType,
        order: data.order ?? existingItem.order,
        description: data.description ?? existingItem.description,
        updatedAt: new Date().toISOString(),
        version: data.version,
        pending: true, // Mark as pending sync
      };

      // 1. Save to IndexedDB
      await putItem(STORES.ITEMS, updatedItem);
      
      // 2. Add to sync queue
      await addToSyncQueue('UPDATE', 'ITEM', itemId, data, data.version, listId);

      // 3. Optimistic update in React Query cache
      const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId)) || [];
      const updatedCache = currentItems.map(i => i.id === itemId ? updatedItem : i);
      queryClient.setQueryData(queryKeys.items.byList(listId), updatedCache);
      queryClient.setQueryData(queryKeys.items.detail(listId, itemId), updatedItem);
      
      console.log('[useUpdateItem] ✅ Item queued for sync');
      return updatedItem;
    },
    // No onSuccess needed - optimistic update already done
  });
};

/**
 * Hook to delete an item
 */
export const useDeleteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async ({ 
      listId, 
      itemId, 
      version 
    }: { 
      listId: string; 
      itemId: string; 
      version: number 
    }) => {
      console.log('[useDeleteItem] Deleting item offline-first');
      
      // 1. Add to sync queue (delete will happen when synced)
      await addToSyncQueue('DELETE', 'ITEM', itemId, { version }, version, listId);
      
      // 2. Remove from IndexedDB and caches immediately
      await removeCachedItem(itemId);
      
      // 3. Optimistically remove from React Query cache
      const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId)) || [];
      const filteredItems = currentItems.filter(item => item.id !== itemId);
      queryClient.setQueryData(queryKeys.items.byList(listId), filteredItems);
      queryClient.removeQueries({ queryKey: queryKeys.items.detail(listId, itemId) });
      
      console.log('[useDeleteItem] ✅ Item queued for deletion');
      return { itemId };
    },
    onSuccess: () => {
      // Invalidate lists to update item counts
      queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
    },
  });
};

/**
 * Hook to reorder items
 */
export const useReorderItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, data }: { listId: string; data: ReorderItemsRequest }) => {
      // Always add to sync queue first (offline-first approach)
      await addToSyncQueue('UPDATE', 'ITEM', 'reorder', data, 0, listId);
      
      try {
        // Try to sync immediately if online
        const reorderedItems = await itemsApi.reorder(listId, data);
        await cacheItems(reorderedItems);
        return { items: reorderedItems, listId };
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useReorderItems] Network error, will sync later');

          // Update local cache optimistically
          const cachedItems = await getCachedItemsByList(listId);
          const orderMap = new Map(data.items.map(item => [item.id, item.order]));

          const reorderedItems = cachedItems.map(item => ({
            ...item,
            order: orderMap.get(item.id) ?? item.order,
          }));

          await cacheItems(reorderedItems);
          
          return { items: reorderedItems, listId };
        }
        throw error;
      }
    },
    onMutate: async ({ listId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.items.byList(listId) });

      // Snapshot the previous value
      const previousItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId));

      // Optimistically update to the new value
      if (previousItems && previousItems.length > 0) {
        console.log('[useReorderItems] onMutate - updating cache with', data.items.length, 'items');
        const orderMap = new Map(data.items.map(item => [item.id, item.order]));
        
        // Update orders, then sort ONLY open items, keep completed items separate
        const openItems = previousItems
          .filter(item => !item.completed)
          .map(item => {
            const newOrder = orderMap.get(item.id);
            if (newOrder !== undefined) {
              console.log(`[useReorderItems] Item ${item.name}: order ${item.order} -> ${newOrder}`);
            }
            return newOrder !== undefined ? { ...item, order: newOrder } : item;
          })
          .sort((a, b) => a.order - b.order);
        
        const completedItems = previousItems.filter(item => item.completed);
        
        console.log('[useReorderItems] Setting new order:', openItems.map(i => i.name));
        queryClient.setQueryData(queryKeys.items.byList(listId), [...openItems, ...completedItems]);
      } else {
        console.warn('[useReorderItems] onMutate - no previous items found in cache');
      }

      // Return context with the snapshotted value
      return { previousItems };
    },
    onError: (_err, variables, context) => {
      // If the mutation fails, rollback to the previous value
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.items.byList(variables.listId), context.previousItems);
      }
    },
    onSuccess: ({ items, listId }) => {
      // Server response only contains {id, order} pairs, not full item data
      // The optimistic update in onMutate already updated the UI correctly
      // Just ensure IndexedDB is updated with the new orders
      const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId));
      if (currentItems) {
        const orderMap = new Map(items.map(item => [item.id, item.order]));
        const updatedItems = currentItems.map(item => {
          const newOrder = orderMap.get(item.id);
          return newOrder !== undefined ? { ...item, order: newOrder } : item;
        });
        
        // Update IndexedDB cache
        cacheItems(updatedItems);
        
        // No need to update React Query cache again - onMutate already did it
      }
    },
  });
};

/**
 * Hook to bulk complete items
 */
export const useBulkCompleteItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, itemIds }: { listId: string; itemIds: string[] }) => {
      try {
        const result = await itemsApi.bulkComplete(listId, itemIds);
        await cacheItems(result.data);
        return result;
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useBulkCompleteItems] Network error, updating cache optimistically');

          const cachedItems = await getCachedItemsByList(listId);
          const updatedItems = cachedItems.map(item =>
            itemIds.includes(item.id) ? { ...item, completed: true } : item
          );

          await cacheItems(updatedItems);
          await addToSyncQueue('UPDATE', 'ITEM', 'bulk-complete', { itemIds }, 0, listId);

          return { completedCount: itemIds.length, data: updatedItems.filter(i => itemIds.includes(i.id)) };
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(variables.listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
    },
  });
};

/**
 * Hook to move item to another list
 */
export const useMoveItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      sourceListId, 
      itemId, 
      data 
    }: { 
      sourceListId: string; 
      itemId: string; 
      data: MoveItemRequest 
    }) => {
      try {
        const movedItem = await itemsApi.move(sourceListId, itemId, data);
        await cacheItem(movedItem);
        return { movedItem, sourceListId };
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useMoveItem] Network error, updating cache optimistically');

          const cachedItems = await getCachedItemsByList(sourceListId);
          const itemToMove = cachedItems.find(i => i.id === itemId);

          if (itemToMove) {
            const movedItem: Item = {
              ...itemToMove,
              listId: data.targetListId,
              order: data.order,
              version: data.version,
              updatedAt: new Date().toISOString(),
            };

            await cacheItem(movedItem);
            await addToSyncQueue('UPDATE', 'ITEM', itemId, data, data.version, sourceListId);

            return { movedItem, sourceListId };
          }
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate both source and target list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(data.sourceListId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(data.movedItem.listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
    },
  });
};
