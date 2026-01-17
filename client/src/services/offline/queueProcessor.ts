import { itemsApi } from '../api/items';
import { listsApi } from '../api/lists';
import {
  getPendingSyncItems,
  getFailedSyncItems,
  updateSyncItemStatus,
  removeSyncItem,
  type SyncQueueItem,
} from '../storage/syncQueue';
import { STORES, putItem, deleteItem } from '../storage/indexedDB';
import { getSyncDialogsInstance } from './syncDialogsStore';
import { queryClient, queryKeys } from '../api/queryClient';
import type { Item, List } from '../../types';

export class QueueProcessor {
  private processing = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    // No constructor params needed - using zustand store
  }

  /**
   * Start the background processor
   */
  start() {
    if (this.pollInterval) {
      console.log('⚠️ QueueProcessor already running');
      return;
    }

    console.log('🚀 Starting QueueProcessor...');
    
    // Process immediately
    this.processQueue();

    // Then process every 5 seconds
    this.pollInterval = setInterval(() => {
      if (navigator.onLine && !this.processing) {
        this.processQueue();
      }
    }, 5000);
  }

  /**
   * Stop the background processor
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('🛑 QueueProcessor stopped');
    }
  }

  /**
   * Manually trigger queue processing (e.g., after queuing new operations)
   */
  async trigger() {
    console.log(`[QueueProcessor] trigger() called - navigator.onLine=${navigator.onLine}, processing=${this.processing}`);
    if (navigator.onLine && !this.processing) {
      await this.processQueue();
    } else {
      console.log(`[QueueProcessor] Skipping trigger - ${!navigator.onLine ? 'offline' : 'already processing'}`);
    }
  }

  /**
   * Process all pending operations in the queue
   */
  private async processQueue() {
    if (this.processing) {
      console.log('[QueueProcessor] Already processing, skipping');
      return; // Already processing
    }

    if (!navigator.onLine) {
      console.log('📴 Offline - skipping queue processing');
      return;
    }

    this.processing = true;
    console.log('[QueueProcessor] Starting queue processing');

    try {
      const pending = await getPendingSyncItems();
      const failed = await getFailedSyncItems();
      
      console.log(`[QueueProcessor] Found ${pending.length} pending and ${failed.length} failed items`);
      
      // Retry failed items that haven't exceeded max retries (3)
      const retriable = failed.filter(item => (item.retryCount || 0) < 3);
      
      const allItems = [...pending, ...retriable];
      
      if (allItems.length === 0) {
        console.log('[QueueProcessor] No items to process');
        this.processing = false;
        return;
      }

      console.log(`🔄 Processing ${pending.length} pending and ${retriable.length} failed operations...`);

      for (const operation of allItems) {
        // Reset status to PENDING for retriable items
        if (operation.status === 'FAILED') {
          await updateSyncItemStatus(operation.id, 'PENDING', '');
        }
        await this.processOperation(operation);
      }

      console.log('✅ Queue processing complete');
    } catch (error) {
      console.error('❌ Error processing queue:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: SyncQueueItem) {
    try {
      // Mark as syncing
      await updateSyncItemStatus(operation.id, 'SYNCING');

      // Execute the operation
      const result = await this.executeOperation(operation);

      // Update local storage with server response
      await this.updateLocalStorage(operation, result);

      // Mark as synced and remove from queue
      await updateSyncItemStatus(operation.id, 'SYNCED');
      await removeSyncItem(operation.id);

      console.log(`✅ Synced: ${operation.operationType} ${operation.resourceType} ${operation.resourceId}`);
      
    } catch (error: any) {
      console.error(`❌ Failed to sync operation ${operation.id}:`, error);

      // Handle version conflicts
      // Note: axios interceptor returns error.response.data directly, so check both formats
      const isVersionConflict = 
        error.response?.data?.error?.code === 'version_conflict' || 
        error.response?.status === 409 ||
        error.error === 'version_conflict' ||
        error.code === 'version_conflict';
      
      if (isVersionConflict) {
        await this.handleConflict(operation, error);
      } else {
        // Other errors - increment retry count
        const retryCount = (operation.retryCount || 0) + 1;
        await updateSyncItemStatus(operation.id, 'FAILED', error.message);

        // If max retries exceeded, log error but don't show dialog
        if (retryCount >= 3) {
          console.error(`❌ Max retries exceeded for ${operation.operationType} ${operation.resourceType} ${operation.resourceId}:`, error.message);
          // Keep in queue with FAILED status - don't discard automatically
          // User can manually resolve later if needed
        }
      }
    }
  }

  /**
   * Execute the actual API call for an operation
   */
  private async executeOperation(operation: SyncQueueItem): Promise<any> {
    const { operationType, resourceType, resourceId, payload, parentId } = operation;

    switch (resourceType) {
      case 'ITEM':
        return await this.executeItemOperation(operationType, resourceId, parentId!, payload);
      case 'LIST':
        return await this.executeListOperation(operationType, resourceId, payload);
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Execute item operations
   */
  private async executeItemOperation(
    operationType: string,
    itemId: string,
    listId: string,
    payload: any
  ): Promise<Item> {
    // Special case: reorder operation
    if (itemId === 'reorder') {
      const reorderedItems = await itemsApi.reorder(listId, payload);
      return reorderedItems as any; // Return array of items
    }

    switch (operationType) {
      case 'CREATE':
        return await itemsApi.create(listId, payload);
      case 'UPDATE':
        return await itemsApi.update(listId, itemId, payload);
      case 'DELETE':
        await itemsApi.delete(listId, itemId, payload.version);
        return null as any;
      default:
        throw new Error(`Unknown operation type: ${operationType}`);
    }
  }

  /**
   * Execute list operations
   */
  private async executeListOperation(
    operationType: string,
    listId: string,
    payload: any
  ): Promise<List> {
    switch (operationType) {
      case 'CREATE':
        return await listsApi.create(payload);
      case 'UPDATE':
        return await listsApi.update(listId, payload);
      case 'DELETE':
        await listsApi.delete(listId, payload.version);
        return null as any;
      default:
        throw new Error(`Unknown operation type: ${operationType}`);
    }
  }

  /**
   * Update local storage with server response
   */
  private async updateLocalStorage(operation: SyncQueueItem, result: any) {
    if (!result) {
      // Delete operations - remove from IndexedDB and invalidate cache
      const { resourceType, resourceId, parentId } = operation;
      
      // Delete from IndexedDB
      if (resourceType === 'ITEM') {
        await deleteItem(STORES.ITEMS, resourceId);
        if (parentId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(parentId) });
        }
      } else if (resourceType === 'LIST') {
        await deleteItem(STORES.LISTS, resourceId);
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.all });
      }
      return;
    }

    const { resourceType, parentId, resourceId } = operation;

    switch (resourceType) {
      case 'ITEM':
        // Special handling for reorder operations
        if (resourceId === 'reorder' && Array.isArray(result)) {
          // Result is an array of reordered items from server
          // Update all items in IndexedDB and React Query cache
          for (const item of result) {
            await putItem(STORES.ITEMS, item);
          }
          
          // Refresh the entire list in React Query cache
          if (parentId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(parentId) });
          }
        } else {
          // Regular single item update
          const isCreateOperation = operation.operationType === 'CREATE';
          
          // For CREATE operations, delete the temp item and store the real one
          if (isCreateOperation && resourceId !== result.id) {
            await deleteItem(STORES.ITEMS, resourceId); // Delete temp item
          }
          
          // Store the server result without pending flag
          await putItem(STORES.ITEMS, { ...result, pending: false });
          
          // Update React Query cache
          if (parentId) {
            if (isCreateOperation) {
              // For CREATE: Remove temp item and add server item
              const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(parentId)) || [];
              const updatedItems = [
                ...currentItems.filter((item: Item) => item.id !== resourceId),
                { ...result, pending: false }
              ];
              
              queryClient.setQueryData(queryKeys.items.byList(parentId), updatedItems);
              queryClient.setQueryData(queryKeys.items.detail(parentId, result.id), { ...result, pending: false });
            } else {
              // For UPDATE: Replace the item in cache with server response
              const currentItems = queryClient.getQueryData<Item[]>(queryKeys.items.byList(parentId)) || [];
              const updatedItems = currentItems.map((item: Item) =>
                item.id === resourceId ? { ...result, pending: false } : item
              );
              queryClient.setQueryData(queryKeys.items.byList(parentId), updatedItems);
              queryClient.setQueryData(queryKeys.items.detail(parentId, result.id), { ...result, pending: false });
            }
          }
        }
        break;
        
      case 'LIST':
        // Update list in IndexedDB
        await putItem(STORES.LISTS, result);
        
        // Update React Query cache immediately
        const currentLists = queryClient.getQueryData<List[]>(queryKeys.lists.all) || [];
        const updatedLists = currentLists.map((list: List) => 
          list.id === resourceId ? { ...result, pending: false } : list
        );
        queryClient.setQueryData(queryKeys.lists.all, updatedLists);
        queryClient.setQueryData(queryKeys.lists.detail(resourceId), { ...result, pending: false });
        break;
    }
  }

  /**
   * Handle version conflicts
   */
  private async handleConflict(operation: SyncQueueItem, _error: Error) {
    console.warn(`⚠️  Conflict detected for ${operation.resourceType} ${operation.resourceId}`);

    try {
      // Get server data (current state on server)
      const serverData = await this.getServerData(operation);

      if (!serverData) {
        // Data not found on server, remove from queue
        await removeSyncItem(operation.id);
        return;
      }

      // Get local changes from the operation payload
      // This represents what the user tried to change
      const localData = await this.reconstructLocalData(operation, serverData);

      if (!localData) {
        // Can't reconstruct local data, remove from queue
        await removeSyncItem(operation.id);
        return;
      }

      // Show conflict dialog and wait for user choice
      const dialogStore = getSyncDialogsInstance();
      const resolution = await dialogStore.showConflictDialog(
        operation.resourceType,
        localData, // User's pending changes
        serverData, // Current server state
        operation
      );

      switch (resolution) {
        case 'server':
          // Accept server version - update local storage and remove from queue
          // Ensure pending flag is cleared
          const serverDataWithoutPending = { ...serverData, pending: false };
          await this.updateLocalStorage(operation, serverDataWithoutPending);
          await removeSyncItem(operation.id);
          console.log(`✅ Conflict resolved: using server version`);
          break;

        case 'local':
          // Force update with local version
          const updated = await this.forceUpdate(operation, localData, serverData);
          const updatedWithoutPending = { ...updated, pending: false };
          await this.updateLocalStorage(operation, updatedWithoutPending);
          await removeSyncItem(operation.id);
          console.log(`✅ Conflict resolved: using local version`);
          break;
      }
    } catch (err) {
      console.error('Error handling conflict:', err);
      await updateSyncItemStatus(operation.id, 'FAILED', `Conflict handling error: ${err}`);
    }
  }

  /**
   * Reconstruct local data by applying the queued changes to server data
   * This shows what the user was trying to change
   */
  private async reconstructLocalData(operation: SyncQueueItem, serverData: Item | List): Promise<Item | List | null> {
    const { resourceType, payload } = operation;

    switch (resourceType) {
      case 'ITEM':
        const itemPayload = payload as any;
        return {
          ...serverData,
          name: itemPayload.name ?? (serverData as Item).name,
          completed: itemPayload.completed ?? (serverData as Item).completed,
          quantity: itemPayload.quantity ?? (serverData as Item).quantity,
          quantityType: itemPayload.quantityType ?? (serverData as Item).quantityType,
          order: itemPayload.order ?? (serverData as Item).order,
          description: itemPayload.description ?? (serverData as Item).description,
        } as Item;
      case 'LIST':
        const listPayload = payload as any;
        return {
          ...serverData,
          name: listPayload.name ?? (serverData as List).name,
        } as List;
      default:
        return null;
    }
  }

  /**
   * Get server data for conflict resolution
   */
  private async getServerData(operation: SyncQueueItem): Promise<Item | List | null> {
    const { resourceType, resourceId, parentId } = operation;

    try {
      switch (resourceType) {
        case 'ITEM':
          return await itemsApi.getById(parentId!, resourceId);
        case 'LIST':
          return await listsApi.getById(resourceId);
        default:
          return null;
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // Resource was deleted on server
      }
      throw error;
    }
  }

  /**
   * Force update server with local data (use server's version number)
   */
  private async forceUpdate(
    operation: SyncQueueItem,
    localData: any,
    serverData: any
  ): Promise<any> {
    const { resourceType, resourceId, parentId } = operation;

    // Use server's version number to force the update
    const payload = {
      ...localData,
      version: serverData.version,
    };

    switch (resourceType) {
      case 'ITEM':
        return await itemsApi.update(parentId!, resourceId, payload);
      case 'LIST':
        return await listsApi.update(resourceId, payload);
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Get processor status
   */
  isRunning(): boolean {
    return this.pollInterval !== null;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}

// Singleton instance
export const queueProcessor = new QueueProcessor();

// Expose for dev/test access
if (typeof window !== 'undefined') {
  (window as any).__queueProcessor = queueProcessor;
}
