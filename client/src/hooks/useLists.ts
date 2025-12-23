/**
 * Custom hooks for lists data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listsApi } from '../services/api/lists';
import { queryKeys } from '../services/api/queryClient';
import { isNetworkError } from '../services/api/client';
import { addToSyncQueue, getResourcesWithPendingDelete } from '../services/storage/syncQueue';
import { cacheList, cacheLists, getCachedLists, removeCachedList } from '../services/storage/cacheManager';
import type { List, CreateListRequest, UpdateListRequest } from '../types';

/**
 * Hook to fetch all lists
 */
export const useLists = () => {
  return useQuery({
    queryKey: queryKeys.lists.all,
    queryFn: async () => {
      try {
        const lists = await listsApi.getAll();
        // Cache the lists in IndexedDB
        await cacheLists(lists);
        
        // Filter out lists with pending DELETE operations
        const pendingDeletes = await getResourcesWithPendingDelete('LIST');
        const filteredLists = lists.filter(list => !pendingDeletes.includes(list.id));
        return filteredLists;
      } catch (error) {
        // If network error, return cached data (don't throw)
        if (isNetworkError(error)) {
          console.log('[useLists] Network error, returning cached data');
          const cached = await getCachedLists();
          // Filter out lists with pending DELETE operations
          const pendingDeletes = await getResourcesWithPendingDelete('LIST');
          const filteredLists = cached.filter(list => !pendingDeletes.includes(list.id));
          return filteredLists;
        }
        // For other errors, still return cache to prevent UI blocking
        console.error('[useLists] Error fetching lists, falling back to cache:', error);
        const cached = await getCachedLists();
        // Filter out lists with pending DELETE operations
        const pendingDeletes = await getResourcesWithPendingDelete('LIST');
        const filteredLists = cached.filter(list => !pendingDeletes.includes(list.id));
        return filteredLists;
      }
    },
    staleTime: 0, // Always consider data stale to ensure fresh fetch on mount
    refetchInterval: () => {
      // Don't poll if sync is in progress or if mutations are active
      if ((window as any).__syncInProgress || (window as any).__mutationInProgress) {
        return false;
      }
      return 10000; // Poll every 10 seconds otherwise
    },
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when window gains focus
    retry: false, // Don't retry failed requests
  });
};

/**
 * Hook to fetch a single list
 */
export const useList = (listId: string | null) => {
  return useQuery({
    queryKey: listId ? queryKeys.lists.detail(listId) : ['lists', 'null'],
    queryFn: async () => {
      if (!listId) {
        return null;
      }
      
      try {
        const list = await listsApi.getById(listId);
        // Cache the list
        await cacheList(list);
        return list;
      } catch (error) {
        // If network error, try to get from cache
        if (isNetworkError(error)) {
          console.log('[useList] Network error, checking cache');
          const cachedList = await getCachedLists().then(lists => 
            lists.find(l => l.id === listId) || null
          );
          if (cachedList) {
            return cachedList;
          }
        }
        throw error;
      }
    },
    enabled: !!listId,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
};

/**
 * Hook to create a new list
 */
export const useCreateList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateListRequest) => {
      try {
        console.log('[useCreateList] 🌐 Making API call...');
        const newList = await listsApi.create(data);
        await cacheList(newList);
        console.log('[useCreateList] ✅ Created online');
        return newList;
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useCreateList] 🔴 Network error - creating offline');
          
          // Create temporary list with pending status
          const tempList: List = {
            id: `temp-${Date.now()}`,
            name: data.name,
            description: data.description,
            color: data.color,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'temp',
            updatedBy: 'temp',
            version: 0,
            itemCount: 0,
            completedItemCount: 0,
          };

          // Cache temporary list
          await cacheList(tempList);

          // Add to sync queue
          await addToSyncQueue('CREATE', 'LIST', tempList.id, data, 0);

          return tempList;
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate lists query to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
    },
  });
};

/**
 * Hook to update a list
 */
export const useUpdateList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, data }: { listId: string; data: UpdateListRequest }) => {
      (window as any).__mutationInProgress = true;
      try {
        console.log('[useUpdateList] 🌐 Making API call...');
        const updatedList = await listsApi.update(listId, data);
        await cacheList(updatedList);
        console.log('[useUpdateList] ✅ Updated online');
        return updatedList;
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useUpdateList] 🔴 Network error - updating offline');
          
          // Optimistically update cache
          const cachedLists = await getCachedLists();
          const existingList = cachedLists.find(l => l.id === listId);
          
          if (existingList) {
            const updatedList: List = {
              ...existingList,
              name: data.name,
              description: data.description,
              color: data.color,
              updatedAt: new Date().toISOString(),
              version: data.version,
            };
            
            await cacheList(updatedList);
            await addToSyncQueue('UPDATE', 'LIST', listId, data, data.version);
            
            return updatedList;
          }
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('[useUpdateList] ✅ onSuccess - updating queries with:', data);
      // Update cached queries immediately with the returned data
      queryClient.setQueryData(queryKeys.lists.detail(data.id), data);
      queryClient.setQueryData(queryKeys.lists.all, (old: List[] | undefined) => {
        if (!old) return [data];
        return old.map(list => list.id === data.id ? data : list);
      });
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.lists.detail(data.id) });
    },
    onSettled: () => {
      // Clear mutation flag after mutation completes (success or error)
      (window as any).__mutationInProgress = false;
    },
  });
};

/**
 * Hook to delete a list
 */
export const useDeleteList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, version }: { listId: string; version: number }) => {
      try {
        await listsApi.delete(listId, version);
        // Only remove from cache after successful API call
        await removeCachedList(listId);
        console.log('[useDeleteList] ✅ Deleted from server and removed from cache:', listId);
        return { success: true, listId };
      } catch (error) {
        // If network error, add to sync queue but DON'T remove from cache yet
        if (isNetworkError(error)) {
          console.log('[useDeleteList] Network error, adding to sync queue (keeping in cache)');
          await addToSyncQueue('DELETE', 'LIST', listId, { version }, version);
          return { success: false, listId };
        }
        throw error;
      }
    },
    onSuccess: async (_, variables) => {
      // Remove from cache and invalidate queries immediately
      queryClient.removeQueries({ queryKey: queryKeys.lists.detail(variables.listId) });
      // Also remove all items for this list
      queryClient.removeQueries({ queryKey: queryKeys.items.byList(variables.listId) });
      // Invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
      await queryClient.refetchQueries({ queryKey: queryKeys.lists.all });
      console.log('[useDeleteList] ✅ Queries removed, invalidated and refetched');
    },
  });
};
