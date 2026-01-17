/**
 * Sync Manager
 * Handles background synchronization of offline operations
 */

import { 
  getPendingSyncItems, 
  updateSyncItemStatus, 
  removeSyncItem,
  SyncQueueItem 
} from '../storage/syncQueue';
import { networkStatus } from './networkStatus';
import { listsApi } from '../api/lists';
import { itemsApi } from '../api/items';
import { 
  cacheList, 
  cacheItem, 
  removeCachedList, 
  removeCachedItem 
} from '../storage/cacheManager';
import { queryClient, queryKeys } from '../api/queryClient';
import type { ErrorResponse, Item } from '../../types';

// Sync status
type SyncStatus = 'idle' | 'syncing' | 'error';
type SyncListener = (status: SyncStatus, progress?: { current: number; total: number }) => void;
type ItemSyncedListener = (itemId: string, resourceType: 'LIST' | 'ITEM') => void;

// Exponential backoff configuration
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 60 seconds
const MAX_RETRIES = 5;

class SyncManager {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private itemSyncedListeners: Set<ItemSyncedListener> = new Set();
  private status: SyncStatus = 'idle';

  constructor() {
    // Listen to network status changes
    networkStatus.addListener((isOnline) => {
      if (isOnline && !this.isSyncing) {
        console.log('[SyncManager] Network online, starting sync');
        this.startSync();
      }
    });
  }

  /**
   * Add a listener for sync status changes
   */
  public addListener(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Add a listener for when individual items are synced
   */
  public addItemSyncedListener(listener: ItemSyncedListener): () => void {
    this.itemSyncedListeners.add(listener);
    return () => this.itemSyncedListeners.delete(listener);
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(status: SyncStatus, progress?: { current: number; total: number }): void {
    this.status = status;
    this.listeners.forEach((listener) => {
      try {
        listener(status, progress);
      } catch (error) {
        console.error('[SyncManager] Error in listener:', error);
      }
    });
  }

  /**
   * Notify when an item has been synced
   */
  private notifyItemSynced(itemId: string, resourceType: 'LIST' | 'ITEM'): void {
    this.itemSyncedListeners.forEach((listener) => {
      try {
        listener(itemId, resourceType);
      } catch (error) {
        console.error('[SyncManager] Error in item synced listener:', error);
      }
    });
  }

  /**
   * Get current sync status
   */
  public getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Start synchronization process
   */
  public async startSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress');
      return;
    }

    if (!networkStatus.isOnline) {
      console.log('[SyncManager] Cannot sync while offline');
      return;
    }

    this.isSyncing = true;
    this.notifyListeners('syncing');
    
    // Signal that sync is in progress (can be checked by queries)
    (window as any).__syncInProgress = true;

    try {
      const pendingItems = await getPendingSyncItems();

      if (pendingItems.length === 0) {
        console.log('[SyncManager] No pending items to sync');
        this.notifyListeners('idle');
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncManager] Syncing ${pendingItems.length} items`);

      let current = 0;
      for (const item of pendingItems) {
        current++;
        this.notifyListeners('syncing', { current, total: pendingItems.length });

        try {
          await this.syncItem(item);
        } catch (error) {
          console.error(`[SyncManager] Failed to sync item ${item.id}:`, error);
          // Continue with next item
        }

        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('[SyncManager] Sync completed');
      this.notifyListeners('idle');
    } catch (error) {
      console.error('[SyncManager] Sync error:', error);
      this.notifyListeners('error');
    } finally {
      this.isSyncing = false;
      (window as any).__syncInProgress = false;
    }
  }

  /**
   * Sync a single queue item
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    // Mark as syncing
    await updateSyncItemStatus(item.id, 'SYNCING');

    try {
      // Execute the operation
      await this.executeOperation(item);

      // Mark as synced and remove from queue
      await updateSyncItemStatus(item.id, 'SYNCED');
      await removeSyncItem(item.id);

      // Notify listeners that this item was synced
      this.notifyItemSynced(item.resourceId, item.resourceType);

      console.log(`[SyncManager] Successfully synced ${item.resourceType} ${item.operationType}`);
    } catch (error) {
      await this.handleSyncError(item, error);
    }
  }

  /**
   * Execute the actual API operation
   */
  private async executeOperation(item: SyncQueueItem): Promise<void> {
    const { operationType, resourceType, resourceId, parentId, payload } = item;

    if (resourceType === 'LIST') {
      await this.executeListOperation(operationType, resourceId, payload);
    } else if (resourceType === 'ITEM') {
      if (!parentId) {
        throw new Error('Item operation requires parentId (listId)');
      }
      await this.executeItemOperation(operationType, resourceId, parentId, payload);
    } else {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Execute list operation
   */
  private async executeListOperation(
    operationType: string,
    resourceId: string,
    payload: unknown
  ): Promise<void> {
    switch (operationType) {
      case 'CREATE': {
        const data = payload as { name: string; description?: string; color?: string };
        const newList = await listsApi.create(data);
        await cacheList(newList);
        break;
      }
      case 'UPDATE': {
        const data = payload as { name: string; description?: string; color?: string; version: number };
        const updatedList = await listsApi.update(resourceId, data);
        await cacheList(updatedList);
        break;
      }
      case 'DELETE': {
        const data = payload as { version: number };
        await listsApi.delete(resourceId, data.version);
        await removeCachedList(resourceId);
        break;
      }
      default:
        throw new Error(`Unknown operation type: ${operationType}`);
    }
  }

  /**
   * Execute item operation
   */
  private async executeItemOperation(
    operationType: string,
    resourceId: string,
    listId: string,
    payload: unknown
  ): Promise<void> {
    switch (operationType) {
      case 'CREATE': {
        const data = payload as { 
          type: 'item' | 'list'; 
          name: string; 
          quantity?: number; 
          quantityType?: string;
          userIconId?: string;
          description?: string;
        };
        const newItem = await itemsApi.create(listId, data);
        // Clear pending flag when caching synced item
        await cacheItem({ ...newItem, pending: false });
        break;
      }
      case 'UPDATE': {
        const data = payload as {
          name: string;
          completed?: boolean;
          quantity?: number;
          quantityType?: string;
          order?: number;
          version: number;
          description?: string;
        };
        const updatedItem = await itemsApi.update(listId, resourceId, data);
        
        // Clear pending flag when caching synced item
        const itemWithoutPending = { ...updatedItem, pending: false };
        await cacheItem(itemWithoutPending);
        
        // Also update React Query cache to immediately reflect the change
        const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId)) || [];
        const updatedItems = currentItems.map(i => 
          i.id === resourceId ? itemWithoutPending : i
        );
        queryClient.setQueryData(queryKeys.items.byList(listId), updatedItems);
        queryClient.setQueryData(queryKeys.items.detail(listId, resourceId), itemWithoutPending);
        break;
      }
      case 'DELETE': {
        const data = payload as { version: number };
        await itemsApi.delete(listId, resourceId, data.version);
        await removeCachedItem(resourceId);
        break;
      }
      default:
        throw new Error(`Unknown operation type: ${operationType}`);
    }
  }

  /**
   * Handle sync error with retry logic
   */
  private async handleSyncError(item: SyncQueueItem, error: unknown): Promise<void> {
    const errorResponse = error as ErrorResponse;

    // Check if it's a version conflict
    if (errorResponse?.error === 'version_conflict') {
      console.warn(`[SyncManager] Version conflict for ${item.resourceType} ${item.resourceId}`);
      
      // Mark as failed with conflict info
      await updateSyncItemStatus(
        item.id, 
        'FAILED', 
        `Version conflict: ${errorResponse.message}`
      );

      // Store conflict data for resolution
      // This will be picked up by the conflict resolution UI
      return;
    }

    // Check if max retries reached
    if (item.retryCount >= MAX_RETRIES) {
      console.error(`[SyncManager] Max retries reached for item ${item.id}`);
      await updateSyncItemStatus(
        item.id, 
        'FAILED', 
        `Max retries reached: ${this.getErrorMessage(error)}`
      );
      return;
    }

    // Calculate backoff delay
    const delay = this.calculateBackoffDelay(item.retryCount);
    console.log(`[SyncManager] Retrying item ${item.id} after ${delay}ms (attempt ${item.retryCount + 1})`);

    // Mark as failed (will be retried later)
    await updateSyncItemStatus(
      item.id, 
      'FAILED', 
      this.getErrorMessage(error)
    );

    // Schedule retry
    setTimeout(() => {
      if (networkStatus.isOnline && !this.isSyncing) {
        this.startSync();
      }
    }, delay);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number): number {
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    return Math.min(delay, MAX_RETRY_DELAY);
  }

  /**
   * Extract error message
   */
  private getErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return (error as { message: string }).message;
    }
    return 'Unknown error';
  }

  /**
   * Force sync now (manual trigger)
   */
  public async forceSyncNow(): Promise<void> {
    if (!networkStatus.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    await this.startSync();
  }

  /**
   * Check if currently syncing
   */
  public get syncing(): boolean {
    return this.isSyncing;
  }
}

// Export singleton instance
export const syncManager = new SyncManager();

export default syncManager;
