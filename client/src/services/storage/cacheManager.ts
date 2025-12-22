/**
 * Cache Manager
 * Handles caching of lists and items in IndexedDB
 */

import { List, Item } from '../../types';
import { STORES, putItem, putItems, getItem, getAllItems, getItemsByIndex, deleteItem } from './indexedDB';

/**
 * Cache a single list
 */
export const cacheList = async (list: List): Promise<void> => {
  await putItem(STORES.LISTS, list);
};

/**
 * Cache multiple lists
 */
export const cacheLists = async (lists: List[]): Promise<void> => {
  await putItems(STORES.LISTS, lists);
};

/**
 * Get cached list by ID
 */
export const getCachedList = async (listId: string): Promise<List | null> => {
  return getItem<List>(STORES.LISTS, listId);
};

/**
 * Get all cached lists
 */
export const getCachedLists = async (): Promise<List[]> => {
  const lists = await getAllItems<List>(STORES.LISTS);
  
  // Sort by updatedAt descending
  return lists.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

/**
 * Remove cached list
 */
export const removeCachedList = async (listId: string): Promise<void> => {
  await deleteItem(STORES.LISTS, listId);
};

/**
 * Cache a single item
 */
export const cacheItem = async (item: Item): Promise<void> => {
  await putItem(STORES.ITEMS, item);
};

/**
 * Cache multiple items
 */
export const cacheItems = async (items: Item[]): Promise<void> => {
  await putItems(STORES.ITEMS, items);
};

/**
 * Get cached item by ID
 */
export const getCachedItem = async (itemId: string): Promise<Item | null> => {
  return getItem<Item>(STORES.ITEMS, itemId);
};

/**
 * Get all cached items for a list
 */
export const getCachedItemsByList = async (listId: string): Promise<Item[]> => {
  const items = await getItemsByIndex<Item>(STORES.ITEMS, 'listId', listId);
  
  // Sort by order
  return items.sort((a, b) => a.order - b.order);
};

/**
 * Get all cached items
 */
export const getCachedItems = async (): Promise<Item[]> => {
  return getAllItems<Item>(STORES.ITEMS);
};

/**
 * Get all cached items of a specific type
 */
export const getCachedItemsByType = async (type: 'item' | 'list'): Promise<Item[]> => {
  return getItemsByIndex<Item>(STORES.ITEMS, 'type', type);
};

/**
 * Remove cached item
 */
export const removeCachedItem = async (itemId: string): Promise<void> => {
  await deleteItem(STORES.ITEMS, itemId);
};

/**
 * Remove all items for a specific list
 */
export const removeCachedItemsByList = async (listId: string): Promise<void> => {
  const items = await getCachedItemsByList(listId);
  
  for (const item of items) {
    await deleteItem(STORES.ITEMS, item.id);
  }
};

/**
 * Cache user preferences
 */
export const cacheUserPreferences = async (key: string, value: unknown): Promise<void> => {
  await putItem(STORES.CACHE, { key, value, timestamp: new Date().toISOString() });
};

/**
 * Get cached user preference
 */
export const getCachedUserPreference = async <T>(key: string): Promise<T | null> => {
  const cached = await getItem<{ key: string; value: T; timestamp: string }>(STORES.CACHE, key);
  return cached?.value || null;
};

/**
 * Cache current user
 */
export const cacheCurrentUser = async (user: { id: string; username: string; iconId: string }): Promise<void> => {
  await putItem(STORES.USER, user);
};

/**
 * Get cached current user
 */
export const getCachedCurrentUser = async (): Promise<{ id: string; username: string; iconId: string } | null> => {
  const users = await getAllItems<{ id: string; username: string; iconId: string }>(STORES.USER);
  return users[0] || null;
};

/**
 * Get cache statistics
 */
export interface CacheStats {
  lists: number;
  items: number;
  regularItems: number;
  nestedLists: number;
}

export const getCacheStats = async (): Promise<CacheStats> => {
  const lists = await getCachedLists();
  const items = await getAllItems<Item>(STORES.ITEMS);
  const regularItems = items.filter((i) => i.type === 'item');
  const nestedLists = items.filter((i) => i.type === 'list');

  return {
    lists: lists.length,
    items: items.length,
    regularItems: regularItems.length,
    nestedLists: nestedLists.length,
  };
};
