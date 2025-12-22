/**
 * Custom hooks for lists data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listsApi } from '../services/api/lists';
import { queryKeys } from '../services/api/queryClient';
import { isNetworkError } from '../services/api/client';
import { addToSyncQueue } from '../services/storage/syncQueue';
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
        return lists;
      } catch (error) {
        // If network error, return cached data (don't throw)
        if (isNetworkError(error)) {
          console.log('[useLists] Network error, returning cached data');
          const cached = await getCachedLists();
          return cached; // Return cached data, don't throw
        }
        // For other errors, still return cache to prevent UI blocking
        console.error('[useLists] Error fetching lists, falling back to cache:', error);
        const cached = await getCachedLists();
        return cached;
      }
    },
    // Load from cache immediately while fetching
    placeholderData: () => {
      getCachedLists().then(cached => {
        if (cached.length > 0) {
          console.log('[useLists] Loaded', cached.length, 'lists from cache');
        }
      });
      return [];
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
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
      // Update cached queries
      queryClient.setQueryData(queryKeys.lists.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
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
        // Remove from cache
        await removeCachedList(listId);
      } catch (error) {
        // If network error, add to sync queue
        if (isNetworkError(error)) {
          console.log('[useDeleteList] Network error, adding to sync queue');
          
          // Optimistically remove from cache
          await removeCachedList(listId);
          await addToSyncQueue('DELETE', 'LIST', listId, { version }, version);
          
          return;
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      // Remove from cache and invalidate queries
      queryClient.removeQueries({ queryKey: queryKeys.lists.detail(variables.listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
    },
  });
};
