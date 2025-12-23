/**
 * Custom hooks for lists data fetching and mutations
 */

import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listsApi } from '../services/api/lists';
import { queryKeys } from '../services/api/queryClient';
import { isNetworkError } from '../services/api/client';
import { addToSyncQueue, getResourcesWithPendingDelete } from '../services/storage/syncQueue';
import { cacheList, cacheLists, getCachedLists, removeCachedList } from '../services/storage/cacheManager';
import { STORES, putItem } from '../services/storage/indexedDB';
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
    networkMode: 'offlineFirst',
    mutationFn: async (data: CreateListRequest) => {
      console.log('[useCreateList] Creating list offline-first');
      
      // Generate unique ID for optimistic list
      const tempId = uuidv4();
      const optimisticList: List = {
        id: tempId,
        name: data.name,
        description: data.description,
        color: data.color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'pending',
        updatedBy: 'pending',
        version: 1,
        itemCount: 0,
        completedItemCount: 0,
        pending: true, // Mark as pending sync
      };

      // 1. Save to IndexedDB
      await putItem(STORES.LISTS, optimisticList);

      // 2. Add to sync queue
      await addToSyncQueue('CREATE', 'LIST', tempId, data, 1);

      // 3. Optimistic update in React Query cache
      const currentLists = queryClient.getQueryData<List[]>(queryKeys.lists.all) || [];
      queryClient.setQueryData(queryKeys.lists.all, [...currentLists, optimisticList]);
      queryClient.setQueryData(queryKeys.lists.detail(tempId), optimisticList);

      console.log('[useCreateList] ✅ List queued for sync:', tempId);
      return optimisticList;
    },
    // No onSuccess needed - optimistic update already done
  });
};

/**
 * Hook to update a list
 */
export const useUpdateList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async ({ listId, data }: { listId: string; data: UpdateListRequest }) => {
      console.log('[useUpdateList] Updating list offline-first');
      
      // Get existing list from React Query cache or IndexedDB
      let existingList = queryClient.getQueryData<List>(queryKeys.lists.detail(listId));
      
      if (!existingList) {
        const cachedLists = await getCachedLists();
        existingList = cachedLists.find(l => l.id === listId);
      }
      
      if (!existingList) {
        throw new Error(`List ${listId} not found in cache`);
      }

      // Create updated list with pending flag
      const updatedList: List = {
        ...existingList,
        name: data.name ?? existingList.name,
        description: data.description ?? existingList.description,
        color: data.color ?? existingList.color,
        updatedAt: new Date().toISOString(),
        version: data.version,
        pending: true, // Mark as pending sync
      };
      
      // 1. Save to IndexedDB
      await putItem(STORES.LISTS, updatedList);
      
      // 2. Add to sync queue
      await addToSyncQueue('UPDATE', 'LIST', listId, data, data.version);
      
      // 3. Optimistic update in React Query cache
      queryClient.setQueryData(queryKeys.lists.detail(listId), updatedList);
      const currentLists = queryClient.getQueryData<List[]>(queryKeys.lists.all) || [];
      const updatedLists = currentLists.map(list => list.id === listId ? updatedList : list);
      queryClient.setQueryData(queryKeys.lists.all, updatedLists);
      
      console.log('[useUpdateList] ✅ List queued for sync');
      return updatedList;
    },
    // No onSuccess needed - optimistic update already done
  });
};

/**
 * Hook to delete a list
 */
export const useDeleteList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async ({ listId, version }: { listId: string; version: number }) => {
      console.log('[useDeleteList] Deleting list offline-first');
      
      // 1. Add to sync queue (delete will happen when synced)
      await addToSyncQueue('DELETE', 'LIST', listId, { version }, version);
      
      // 2. Remove from IndexedDB and caches immediately
      await removeCachedList(listId);
      
      // 3. Optimistically remove from React Query cache
      const currentLists = queryClient.getQueryData<List[]>(queryKeys.lists.all) || [];
      const filteredLists = currentLists.filter(list => list.id !== listId);
      queryClient.setQueryData(queryKeys.lists.all, filteredLists);
      queryClient.removeQueries({ queryKey: queryKeys.lists.detail(listId) });
      queryClient.removeQueries({ queryKey: queryKeys.items.byList(listId) });
      
      console.log('[useDeleteList] ✅ List queued for deletion');
      return { listId };
    },
    // No onSuccess needed - optimistic update already done
  });
};
