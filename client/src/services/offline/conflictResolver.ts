/**
 * Conflict Resolver
 * Handles conflict detection and resolution strategies
 */

import type { List, Item, ErrorResponse } from '../../types';
import { 
  SyncQueueItem, 
  updateSyncItemStatus, 
  removeSyncItem 
} from '../storage/syncQueue';
import { 
  cacheList, 
  cacheItem, 
  removeCachedList, 
  removeCachedItem 
} from '../storage/cacheManager';

export type ConflictType = 'modified' | 'deleted' | 'version_mismatch';

export interface ConflictInfo {
  queueItem: SyncQueueItem;
  localVersion: List | Item;
  serverVersion: List | Item | null;
  conflictType: ConflictType;
  error: ErrorResponse;
}

export type ResolutionStrategy = 'use_local' | 'use_server' | 'merge' | 'cancel';

class ConflictResolver {
  private pendingConflicts: Map<string, ConflictInfo> = new Map();
  private conflictListeners: Set<(conflicts: ConflictInfo[]) => void> = new Set();

  /**
   * Add a conflict to be resolved
   */
  public addConflict(
    queueItem: SyncQueueItem,
    error: ErrorResponse,
    localVersion: List | Item
  ): void {
    const conflictInfo: ConflictInfo = {
      queueItem,
      localVersion,
      serverVersion: error.current || null,
      conflictType: this.determineConflictType(error),
      error,
    };

    this.pendingConflicts.set(queueItem.id, conflictInfo);
    this.notifyListeners();

    console.log(`[ConflictResolver] Conflict added: ${queueItem.resourceType} ${queueItem.resourceId}`);
  }

  /**
   * Determine the type of conflict
   */
  private determineConflictType(error: ErrorResponse): ConflictType {
    if (error.reason === 'item_deleted' || error.reason === 'list_deleted') {
      return 'deleted';
    }
    if (error.reason === 'item_modified' || error.reason === 'list_modified') {
      return 'modified';
    }
    return 'version_mismatch';
  }

  /**
   * Get all pending conflicts
   */
  public getPendingConflicts(): ConflictInfo[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * Get conflict by queue item ID
   */
  public getConflict(queueItemId: string): ConflictInfo | undefined {
    return this.pendingConflicts.get(queueItemId);
  }

  /**
   * Add listener for conflict changes
   */
  public addListener(listener: (conflicts: ConflictInfo[]) => void): () => void {
    this.conflictListeners.add(listener);
    return () => this.conflictListeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const conflicts = this.getPendingConflicts();
    this.conflictListeners.forEach((listener) => {
      try {
        listener(conflicts);
      } catch (error) {
        console.error('[ConflictResolver] Error in listener:', error);
      }
    });
  }

  /**
   * Resolve a conflict with the chosen strategy
   */
  public async resolveConflict(
    queueItemId: string,
    strategy: ResolutionStrategy
  ): Promise<void> {
    const conflict = this.pendingConflicts.get(queueItemId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${queueItemId}`);
    }

    console.log(`[ConflictResolver] Resolving conflict with strategy: ${strategy}`);

    try {
      switch (strategy) {
        case 'use_local':
          await this.useLocalVersion(conflict);
          break;
        case 'use_server':
          await this.useServerVersion(conflict);
          break;
        case 'merge':
          await this.mergeVersions(conflict);
          break;
        case 'cancel':
          await this.cancelOperation(conflict);
          break;
        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }

      // Remove from pending conflicts
      this.pendingConflicts.delete(queueItemId);
      this.notifyListeners();
    } catch (error) {
      console.error('[ConflictResolver] Error resolving conflict:', error);
      throw error;
    }
  }

  /**
   * Use local version (force update)
   */
  private async useLocalVersion(conflict: ConflictInfo): Promise<void> {
    const { queueItem, serverVersion } = conflict;

    if (!serverVersion) {
      // Server version deleted, recreate
      console.log('[ConflictResolver] Server version deleted, recreating');
      // Convert UPDATE to CREATE
      queueItem.operationType = 'CREATE';
    } else {
      // Force update with server version number
      console.log('[ConflictResolver] Using local version, updating version number');
      const payload = queueItem.payload as Record<string, unknown>;
      if (payload && typeof payload === 'object' && 'version' in payload) {
        payload.version = (serverVersion as { version: number }).version;
      }
    }

    // Mark as pending to retry
    await updateSyncItemStatus(queueItem.id, 'PENDING');
  }

  /**
   * Use server version (discard local changes)
   */
  private async useServerVersion(conflict: ConflictInfo): Promise<void> {
    const { queueItem, serverVersion } = conflict;

    if (!serverVersion) {
      // Server version deleted, remove local
      console.log('[ConflictResolver] Server version deleted, removing local');
      if (queueItem.resourceType === 'LIST') {
        await removeCachedList(queueItem.resourceId);
      } else {
        await removeCachedItem(queueItem.resourceId);
      }
    } else {
      // Update cache with server version
      console.log('[ConflictResolver] Using server version, updating cache');
      if (queueItem.resourceType === 'LIST') {
        await cacheList(serverVersion as List);
      } else {
        await cacheItem(serverVersion as Item);
      }
    }

    // Remove from sync queue
    await removeSyncItem(queueItem.id);
  }

  /**
   * Merge versions (attempt automatic merge)
   */
  private async mergeVersions(conflict: ConflictInfo): Promise<void> {
    const { queueItem, localVersion, serverVersion } = conflict;

    if (!serverVersion) {
      // Cannot merge if server deleted
      throw new Error('Cannot merge: server version deleted');
    }

    console.log('[ConflictResolver] Attempting to merge versions');

    // Simple merge strategy: combine non-conflicting changes
    const merged = this.performMerge(localVersion, serverVersion);

    // Update cache with merged version
    if (queueItem.resourceType === 'LIST') {
      await cacheList(merged as List);
    } else {
      await cacheItem(merged as Item);
    }

      // Update queue item with merged data and server version
      queueItem.payload = merged;
      if ('version' in merged && typeof merged.version === 'number') {
        (queueItem.payload as { version: number }).version = merged.version;
      }    // Mark as pending to retry
    await updateSyncItemStatus(queueItem.id, 'PENDING');
  }

  /**
   * Perform simple merge of two versions
   */
  private performMerge(local: List | Item, server: List | Item): List | Item {
    // Simple merge: take newer timestamp for each field
    const merged = { ...server };

    // Compare timestamps and take newer changes
    if (local.updatedAt > server.updatedAt) {
      // Local is newer, prefer local changes for editable fields
      merged.name = local.name;
      if ('description' in local && 'description' in server) {
        merged.description = local.description;
      }
      if ('completed' in local && 'completed' in server) {
        (merged as Item).completed = (local as Item).completed;
      }
      if ('quantity' in local && 'quantity' in server) {
        (merged as Item).quantity = (local as Item).quantity;
      }
      if ('quantityType' in local && 'quantityType' in server) {
        (merged as Item).quantityType = (local as Item).quantityType;
      }
    }

    // Always use server's version number and system fields
    merged.version = server.version;
    merged.updatedAt = server.updatedAt;
    merged.updatedBy = server.updatedBy;

    return merged;
  }

  /**
   * Cancel operation (discard local changes)
   */
  private async cancelOperation(conflict: ConflictInfo): Promise<void> {
    const { queueItem } = conflict;

    console.log('[ConflictResolver] Canceling operation');

    // Just remove from queue
    await removeSyncItem(queueItem.id);

    // Note: Keep cache as-is, don't update
    // User may want to manually fix things
  }

  /**
   * Auto-resolve conflicts where possible
   */
  public async autoResolve(queueItemId: string): Promise<boolean> {
    const conflict = this.pendingConflicts.get(queueItemId);
    if (!conflict) {
      return false;
    }

    const { conflictType, localVersion, serverVersion } = conflict;

    // Auto-resolve simple cases
    if (conflictType === 'deleted' && !serverVersion) {
      // Server deleted, accept it
      await this.resolveConflict(queueItemId, 'use_server');
      return true;
    }

    // If only timestamps differ, can auto-merge
    if (serverVersion && this.canAutoMerge(localVersion, serverVersion)) {
      await this.resolveConflict(queueItemId, 'merge');
      return true;
    }

    return false;
  }

  /**
   * Check if versions can be auto-merged
   */
  private canAutoMerge(local: List | Item, server: List | Item): boolean {
    // Compare key fields
    if (local.name !== server.name) return false;
    if ('description' in local && 'description' in server && local.description !== server.description) return false;
    if ('completed' in local && 'completed' in server && (local as Item).completed !== (server as Item).completed) return false;

    // Only timestamps/version differ - can merge
    return true;
  }

  /**
   * Clear all resolved conflicts
   */
  public clearResolvedConflicts(): void {
    this.pendingConflicts.clear();
    this.notifyListeners();
  }

  /**
   * Get conflict count
   */
  public getConflictCount(): number {
    return this.pendingConflicts.size;
  }
}

// Export singleton instance
export const conflictResolver = new ConflictResolver();

export default conflictResolver;
