/**
 * TanStack Query Configuration
 * Sets up QueryClient with default options
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Default options for all queries
 */
const defaultQueryOptions = {
  queries: {
    // Stale time: 30 seconds (reduced for faster updates)
    staleTime: 30 * 1000,
    
    // Cache time: 10 minutes
    gcTime: 10 * 60 * 1000,
    
    // Don't retry - let hooks handle offline fallback
    retry: false,
    
    // Refetch on window focus
    refetchOnWindowFocus: true,
    
    // Refetch on reconnect
    refetchOnReconnect: true,
    
    // Don't refetch on mount if data is fresh
    refetchOnMount: false,
  },
  mutations: {
    // Don't retry mutations - let hooks handle offline fallback
    retry: false,
  },
};

/**
 * Create QueryClient instance
 */
export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});

/**
 * Query keys for different resources
 */
export const queryKeys = {
  lists: {
    all: ['lists'] as const,
    detail: (id: string) => ['lists', id] as const,
  },
  items: {
    all: ['items'] as const,
    byList: (listId: string) => ['items', 'list', listId] as const,
    detail: (listId: string, itemId: string) => ['items', listId, itemId] as const,
  },
  user: {
    current: ['user', 'current'] as const,
    icons: ['user', 'icons'] as const,
  },
  sync: {
    queue: ['sync', 'queue'] as const,
    stats: ['sync', 'stats'] as const,
  },
};

export default queryClient;
