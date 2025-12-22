/**
 * Custom hooks for items data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../services/api/items';
import { queryKeys } from '../services/api/queryClient';
import { isNetworkError } from '../services/api/client';
import { addToSyncQueue } from '../services/storage/syncQueue';
import { 
  cacheItem, 
  cacheItems, 
  getCachedItemsByList, 
  removeCachedItem
} from '../services/storage/cacheManager';
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
        return items;
      } catch (error) {
        // If network error, return cached data (don't throw)
        if (isNetworkError(error)) {
          console.log('[useItems] Network error, returning cached data');
          const cached = await getCachedItemsByList(listId);
          return cached; // Return cached data, don't throw
        }
        // For other errors, still return cache to prevent UI blocking
        console.error('[useItems] Error fetching items, falling back to cache:', error);
        const cached = await getCachedItemsByList(listId);
        return cached;
      }
    },
    enabled: !!listId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: () => {
      // Don't poll if sync is in progress or if mutations are active
      if ((window as any).__syncInProgress || (window as any).__mutationInProgress) {
        return false;
      }
      return 10000; // Poll every 10 seconds otherwise
    },
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
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
    mutationFn: async ({ listId, data }: { listId: string; data: CreateItemRequest }) => {
      try {
        console.log('[useCreateItem] 🌐 Making API call...');
        const newItem = await itemsApi.create(listId, data);
        await cacheItem(newItem);
        console.log('[useCreateItem] ✅ Created online');
        return newItem;
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useCreateItem] 🔴 Network error - creating offline');

          // Create temporary item
          const tempItem: Item = {
            id: `temp-${Date.now()}`,
            listId,
            type: data.type,
            name: data.name,
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'temp',
            updatedBy: 'temp',
            version: 0,
            order: 9999, // Will be reordered later
            quantity: data.quantity,
            quantityType: data.quantityType,
            userIconId: data.userIconId || '',
            description: data.description,
          };

          await cacheItem(tempItem);
          await addToSyncQueue('CREATE', 'ITEM', tempItem.id, data, 0, listId);

          return tempItem;
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      // Directly update cache instead of invalidating to avoid refetch
      const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(data.listId)) || [];
      // Check if item already exists (from offline cache update)
      const exists = currentItems.some(i => i.id === data.id);
      if (!exists) {
        queryClient.setQueryData(queryKeys.items.byList(data.listId), [...currentItems, data]);
      }
      queryClient.setQueryData(queryKeys.items.detail(data.listId, data.id), data);
    },
  });
};

/**
 * Hook to update an item
 */
export const useUpdateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      listId, 
      itemId, 
      data 
    }: { 
      listId: string; 
      itemId: string; 
      data: UpdateItemRequest 
    }) => {
      console.log('[useUpdateItem] Starting update...', { listId, itemId });
      
      // Always try API call first, fall back to offline on error
      try {
        console.log('[useUpdateItem] 🌐 Making API call...');
        const updatedItem = await itemsApi.update(listId, itemId, data);
        await cacheItem(updatedItem);
        console.log('[useUpdateItem] ✅ API call successful', updatedItem);
        return updatedItem;
      } catch (error) {
        console.error('[useUpdateItem] ❌ API call failed', error);
        if (isNetworkError(error)) {
          console.log('[useUpdateItem] 🔴 Network error - working offline');

          // Try React Query cache first, then IndexedDB
          let existingItem: Item | undefined;
          const reactQueryItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId));
          if (reactQueryItems) {
            existingItem = reactQueryItems.find(i => i.id === itemId);
            console.log('[useUpdateItem] Found in React Query cache');
          }
          
          if (!existingItem) {
            const cachedItems = await getCachedItemsByList(listId);
            existingItem = cachedItems.find(i => i.id === itemId);
            console.log('[useUpdateItem] Found in IndexedDB:', !!existingItem);
          }

          if (existingItem) {
            const updatedItem: Item = {
              ...existingItem,
              name: data.name,
              completed: data.completed ?? existingItem.completed,
              quantity: data.quantity,
              quantityType: data.quantityType,
              order: data.order ?? existingItem.order,
              description: data.description,
              updatedAt: new Date().toISOString(),
              version: data.version,
            };

            await cacheItem(updatedItem);
            await addToSyncQueue('UPDATE', 'ITEM', itemId, data, data.version, listId);

            // Update React Query cache immediately to show pending state
            const currentCachedItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId)) || [];
            const updatedCache = currentCachedItems.map(i => i.id === itemId ? updatedItem : i);
            queryClient.setQueryData(queryKeys.items.byList(listId), updatedCache);
            console.log('[useUpdateItem] ✅ Updated React Query cache with pending item:', updatedItem);
            
            // Invalidate sync status to show pending indicator
            queryClient.invalidateQueries({ queryKey: ['sync-status', 'item', itemId] });

            console.log('[useUpdateItem] ✅ Cached and queued for sync');
            return updatedItem;
          }
        }
        // For any error, try to return something from cache to prevent UI blocking
        console.error('[useUpdateItem] Fallback: returning original item from cache');
        const cachedItems = await getCachedItemsByList(listId);
        const fallbackItem = cachedItems.find(i => i.id === itemId);
        if (fallbackItem) return fallbackItem;
        
        throw error; // Only throw if we have no fallback
      }
    },
    onSuccess: (data) => {
      // Update both detail and list caches directly
      queryClient.setQueryData(queryKeys.items.detail(data.listId, data.id), data);
      const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(data.listId)) || [];
      const updatedItems = currentItems.map(item => item.id === data.id ? data : item);
      queryClient.setQueryData(queryKeys.items.byList(data.listId), updatedItems);
      
      // Invalidate sync status to update UI indicators
      queryClient.invalidateQueries({ queryKey: ['sync-status', 'item', data.id] });
    },
  });
};

/**
 * Hook to delete an item
 */
export const useDeleteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      listId, 
      itemId, 
      version 
    }: { 
      listId: string; 
      itemId: string; 
      version: number 
    }) => {
      // If it's a temp item (created offline), just remove it from cache
      if (itemId.startsWith('temp-')) {
        console.log('[useDeleteItem] Deleting temp item locally only');
        await removeCachedItem(itemId);
        
        // Also remove from sync queue if it was queued for creation
        const pendingItems = await import('../services/storage/syncQueue').then(m => m.getPendingSyncItems());
        const queueItem = (await pendingItems).find(
          item => item.resourceType === 'ITEM' && item.resourceId === itemId
        );
        if (queueItem) {
          await import('../services/storage/syncQueue').then(m => m.removeSyncItem(queueItem.id));
        }
        
        return;
      }

      try {
        await itemsApi.delete(listId, itemId, version);
        await removeCachedItem(itemId);
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useDeleteItem] Network error, adding to sync queue');

          await removeCachedItem(itemId);
          await addToSyncQueue('DELETE', 'ITEM', itemId, { version }, version, listId);

          return;
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.removeQueries({ queryKey: queryKeys.items.detail(variables.listId, variables.itemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(variables.listId) });
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
      try {
        const reorderedItems = await itemsApi.reorder(listId, data);
        await cacheItems(reorderedItems);
        return reorderedItems;
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useReorderItems] Network error, updating cache optimistically');

          const cachedItems = await getCachedItemsByList(listId);
          const orderMap = new Map(data.items.map(item => [item.id, item.order]));

          const reorderedItems = cachedItems.map(item => ({
            ...item,
            order: orderMap.get(item.id) ?? item.order,
          }));

          await cacheItems(reorderedItems);
          await addToSyncQueue('UPDATE', 'ITEM', 'reorder', data, 0, listId);

          return reorderedItems;
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(variables.listId) });
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
