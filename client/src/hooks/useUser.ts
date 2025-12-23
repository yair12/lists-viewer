/**
 * Custom hooks for user management
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { usersApi } from '../services/api/users';
import { queryKeys } from '../services/api/queryClient';
import { cacheCurrentUser, getCachedCurrentUser } from '../services/storage/cacheManager';
import { isNetworkError } from '../services/api/client';
import type { InitUserRequest, User, Icon } from '../types';

const USER_STORAGE_KEY = 'currentUser';

/**
 * Hook to get current user from localStorage
 */
export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.user.current,
    queryFn: async () => {
      // Try localStorage first
      const userStr = localStorage.getItem(USER_STORAGE_KEY);
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          return user as User;
        } catch (error) {
          console.error('Failed to parse user from localStorage:', error);
        }
      }

      // Try IndexedDB cache
      return getCachedCurrentUser();
    },
    staleTime: Infinity, // User data doesn't become stale
  });
};

/**
 * Hook to initialize/get user
 */
export const useInitUser = () => {
  return useMutation({
    mutationFn: async (data: InitUserRequest) => {
      try {
        const user = await usersApi.init(data);
        
        // Save to localStorage
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        
        // Cache in IndexedDB
        await cacheCurrentUser({
          id: user.id,
          username: user.username,
          iconId: user.iconId,
        });

        return user;
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useInitUser] Network error, creating local user');

          // Create a temporary local user
          const localUser: User = {
            id: `local-${Date.now()}`,
            username: data.username,
            iconId: data.iconId,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            preferences: {
              theme: 'dark',
              language: 'en',
            },
          };

          // Save to localStorage
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(localUser));

          // Cache in IndexedDB
          await cacheCurrentUser({
            id: localUser.id,
            username: localUser.username,
            iconId: localUser.iconId,
          });

          return localUser;
        }
        throw error;
      }
    },
  });
};

/**
 * Hook to get available icons
 */
export const useIcons = () => {
  return useQuery({
    queryKey: queryKeys.user.icons,
    queryFn: async () => {
      try {
        return await usersApi.getIcons();
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('[useIcons] Network error, returning default icons');
          
          // Return some default icons
          return getDefaultIcons();
        }
        throw error;
      }
    },
  });
};

/**
 * Get default icons when offline
 */
const getDefaultIcons = (): Icon[] => {
  return [
    { id: 'icon1', name: 'Avatar 1', url: '/icons/avatar1.svg' },
    { id: 'icon2', name: 'Avatar 2', url: '/icons/avatar2.svg' },
    { id: 'icon3', name: 'Avatar 3', url: '/icons/avatar3.svg' },
    { id: 'icon4', name: 'Avatar 4', url: '/icons/avatar4.svg' },
    { id: 'icon5', name: 'Avatar 5', url: '/icons/avatar5.svg' },
  ];
};

/**
 * Hook to logout user (clear local data)
 */
export const useLogout = () => {
  return useMutation({
    mutationFn: async () => {
      // Clear localStorage
      localStorage.removeItem(USER_STORAGE_KEY);
      
      // Note: We don't clear IndexedDB cache as it might contain offline data
      // that needs to be synced later
    },
  });
};
