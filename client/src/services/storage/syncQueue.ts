/**
 * Sync Queue Management
 * Handles offline operation queuing and processing
 */

import { v4 as uuidv4 } from 'uuid';
import { STORES, getItemsByIndex, putItem, deleteItem, getAllItems } from './indexedDB';

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type ResourceType = 'LIST' | 'ITEM';
export type SyncStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';

export interface SyncQueueItem {
  id: string;
  timestamp: string;
  operationType: OperationType;
  resourceType: ResourceType;
  resourceId: string;
  parentId?: string; // For items (listId)
  payload: unknown;
  version: number;
  retryCount: number;
  status: SyncStatus;
  error?: string;
  lastAttempt?: string;
}

/**
 * Add an operation to the sync queue
 */
export const addToSyncQueue = async (
  operationType: OperationType,
  resourceType: ResourceType,
  resourceId: string,
  payload: unknown,
  version: number,
  parentId?: string
): Promise<SyncQueueItem> => {
  const queueItem: SyncQueueItem = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    operationType,
    resourceType,
    resourceId,
    parentId,
    payload,
    version,
    retryCount: 0,
    status: 'PENDING',
  };

  await putItem(STORES.SYNC_QUEUE, queueItem);
  return queueItem;
};

/**
 * Get all pending items from sync queue (sorted by timestamp)
 */
export const getPendingSyncItems = async (): Promise<SyncQueueItem[]> => {
  const items = await getItemsByIndex<SyncQueueItem>(
    STORES.SYNC_QUEUE,
    'status',
    'PENDING'
  );
  
  // Sort by timestamp (FIFO)
  return items.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

/**
 * Get all failed items from sync queue
 */
export const getFailedSyncItems = async (): Promise<SyncQueueItem[]> => {
  return getItemsByIndex<SyncQueueItem>(
    STORES.SYNC_QUEUE,
    'status',
    'FAILED'
  );
};

/**
 * Get all sync queue items
 */
export const getAllSyncItems = async (): Promise<SyncQueueItem[]> => {
  return getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE);
};

/**
 * Update sync queue item status
 */
export const updateSyncItemStatus = async (
  id: string,
  status: SyncStatus,
  error?: string
): Promise<void> => {
  const items = await getAllSyncItems();
  const item = items.find((i) => i.id === id);
  
  if (!item) {
    throw new Error(`Sync queue item ${id} not found`);
  }

  item.status = status;
  item.lastAttempt = new Date().toISOString();
  
  if (error) {
    item.error = error;
  }

  if (status === 'FAILED') {
    item.retryCount += 1;
  }

  await putItem(STORES.SYNC_QUEUE, item);
};

/**
 * Remove sync queue item (after successful sync)
 */
export const removeSyncItem = async (id: string): Promise<void> => {
  await deleteItem(STORES.SYNC_QUEUE, id);
};

/**
 * Clear all synced items from queue
 */
export const clearSyncedItems = async (): Promise<number> => {
  const syncedItems = await getItemsByIndex<SyncQueueItem>(
    STORES.SYNC_QUEUE,
    'status',
    'SYNCED'
  );

  for (const item of syncedItems) {
    await deleteItem(STORES.SYNC_QUEUE, item.id);
  }

  return syncedItems.length;
};

/**
 * Retry failed sync items (reset to pending)
 */
export const retryFailedItems = async (): Promise<number> => {
  const failedItems = await getFailedSyncItems();

  for (const item of failedItems) {
    item.status = 'PENDING';
    item.error = undefined;
    await putItem(STORES.SYNC_QUEUE, item);
  }

  return failedItems.length;
};

/**
 * Get count of pending sync items
 */
export const getPendingSyncCount = async (): Promise<number> => {
  const items = await getPendingSyncItems();
  return items.length;
};

/**
 * Check if there are pending sync operations
 */
export const hasPendingSync = async (): Promise<boolean> => {
  const count = await getPendingSyncCount();
  return count > 0;
};

/**
 * Get sync queue statistics
 */
export interface SyncQueueStats {
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
  total: number;
}

export const getSyncQueueStats = async (): Promise<SyncQueueStats> => {
  const allItems = await getAllSyncItems();

  return {
    pending: allItems.filter((i) => i.status === 'PENDING').length,
    syncing: allItems.filter((i) => i.status === 'SYNCING').length,
    failed: allItems.filter((i) => i.status === 'FAILED').length,
    synced: allItems.filter((i) => i.status === 'SYNCED').length,
    total: allItems.length,
  };
};

/**
 * Check if resource has pending operations
 */
export const hasResourcePendingOps = async (
  resourceType: ResourceType,
  resourceId: string
): Promise<boolean> => {
  const pendingItems = await getPendingSyncItems();
  return pendingItems.some(
    (item) => item.resourceType === resourceType && item.resourceId === resourceId
  );
};
