import { itemsApi } from '../api/items';
import { listsApi } from '../api/lists';
import {
  getPendingSyncItems,
  getFailedSyncItems,
  updateSyncItemStatus,
  removeSyncItem,
  type SyncQueueItem,
} from '../storage/syncQueue';
import { STORES, getItem, putItem } from '../storage/indexedDB';
import { getSyncDialogsInstance } from './syncDialogsStore';
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
   * Process all pending operations in the queue
   */
  private async processQueue() {
    if (this.processing) {
      return; // Already processing
    }

    if (!navigator.onLine) {
      console.log('📴 Offline - skipping queue processing');
      return;
    }

    this.processing = true;

    try {
      const pending = await getPendingSyncItems();
      const failed = await getFailedSyncItems();
      
      // Retry failed items that haven't exceeded max retries (3)
      const retriable = failed.filter(item => (item.retryCount || 0) < 3);
      
      const allItems = [...pending, ...retriable];
      
      if (allItems.length === 0) {
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
      if (error.response?.data?.error?.code === 'version_conflict' || error.response?.status === 409) {
        await this.handleConflict(operation, error);
      } else {
        // Other errors - increment retry count
        const retryCount = (operation.retryCount || 0) + 1;
        await updateSyncItemStatus(operation.id, 'FAILED', error.message);

        // If max retries exceeded, show error dialog
        if (retryCount >= 3) {
          const localData = await this.getLocalData(operation);
          const resourceName = localData ? (localData as any).name : operation.resourceId;

          const dialogStore = getSyncDialogsInstance();
          const action = await dialogStore.showErrorDialog(
            operation.resourceType,
            resourceName,
            error.message || 'Unknown error occurred',
            retryCount,
            operation
          );

          if (action === 'discard') {
            await removeSyncItem(operation.id);
            console.log(`🗑️  Discarded failed operation: ${operation.id}`);
          } else {
            // Retry - reset retry count
            await updateSyncItemStatus(operation.id, 'PENDING', '');
          }
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
    if (!result) return; // Delete operations don't return data

    const { resourceType } = operation;

    switch (resourceType) {
      case 'ITEM':
        // Update item in IndexedDB with server data (real ID, updated version)
        await putItem(STORES.ITEMS, result);
        break;
      case 'LIST':
        // Update list in IndexedDB
        await putItem(STORES.LISTS, result);
        break;
    }
  }

  /**
   * Handle version conflicts
   */
  private async handleConflict(operation: SyncQueueItem, _error: Error) {
    console.warn(`⚠️  Conflict detected for ${operation.resourceType} ${operation.resourceId}`);

    try {
      // Get local and server data
      const localData = await this.getLocalData(operation);
      const serverData = await this.getServerData(operation);

      if (!localData || !serverData) {
        // Data not found, remove from queue
        await removeSyncItem(operation.id);
        return;
      }

      // Show conflict dialog and wait for user choice
      const dialogStore = getSyncDialogsInstance();
      const resolution = await dialogStore.showConflictDialog(
        operation.resourceType,
        localData,
        serverData,
        operation
      );

      switch (resolution) {
        case 'server':
          // Accept server version - update local storage and remove from queue
          await this.updateLocalStorage(operation, serverData);
          await removeSyncItem(operation.id);
          console.log(`✅ Conflict resolved: using server version`);
          break;

        case 'local':
          // Force update with local version
          const updated = await this.forceUpdate(operation, localData, serverData);
          await this.updateLocalStorage(operation, updated);
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
   * Get local data for conflict resolution
   */
  private async getLocalData(operation: SyncQueueItem): Promise<Item | List | null> {
    const { resourceType, resourceId } = operation;

    switch (resourceType) {
      case 'ITEM':
        return await getItem<Item>(STORES.ITEMS, resourceId);
      case 'LIST':
        return await getItem<List>(STORES.LISTS, resourceId);
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
