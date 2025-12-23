import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  addToSyncQueue,
  getPendingSyncItems,
  updateSyncItemStatus,
  retryFailedItems,
  hasResourcePendingDelete,
  getResourcesWithPendingDelete,
  removeSyncItem,
} from '../services/storage/syncQueue'
import { initDB, clearAllData, closeDB, STORES, getAllItems, clearStore } from '../services/storage/indexedDB'
import type { SyncQueueItem } from '../services/storage/syncQueue'

describe('Sync Queue', () => {
  beforeEach(async () => {
    await initDB()
    await clearAllData()
  })

  afterEach(() => {
    closeDB()
  })

  describe('Adding to Queue', () => {
    it('should add operation to sync queue with PENDING status', async () => {
      const queueItem = await addToSyncQueue(
        'CREATE',
        'ITEM',
        'item-1',
        { name: 'Test Item' },
        1,
        'list-1'
      )

      expect(queueItem).toMatchObject({
        operationType: 'CREATE',
        resourceType: 'ITEM',
        resourceId: 'item-1',
        parentId: 'list-1',
        version: 1,
        retryCount: 0,
        status: 'PENDING',
      })
      expect(queueItem.id).toBeTruthy()
      expect(queueItem.timestamp).toBeTruthy()
    })

    it('should add multiple operations in order', async () => {
      await addToSyncQueue('CREATE', 'LIST', 'list-1', { name: 'List 1' }, 1)
      await new Promise(resolve => setTimeout(resolve, 10))
      await addToSyncQueue('CREATE', 'ITEM', 'item-1', { name: 'Item 1' }, 1, 'list-1')
      await new Promise(resolve => setTimeout(resolve, 10))
      await addToSyncQueue('UPDATE', 'ITEM', 'item-1', { name: 'Item 1 Updated' }, 2, 'list-1')

      const pending = await getPendingSyncItems()
      
      expect(pending).toHaveLength(3)
      expect(pending[0].operationType).toBe('CREATE')
      expect(pending[0].resourceType).toBe('LIST')
      expect(pending[1].operationType).toBe('CREATE')
      expect(pending[1].resourceType).toBe('ITEM')
      expect(pending[2].operationType).toBe('UPDATE')
    })

    it('should handle operations without parentId', async () => {
      const queueItem = await addToSyncQueue(
        'UPDATE',
        'LIST',
        'list-1',
        { name: 'Updated List' },
        2
      )

      expect(queueItem.parentId).toBeUndefined()
    })
  })

  describe('Retrieving Pending Items', () => {
    beforeEach(async () => {
      // Add mix of pending and synced items
      await addToSyncQueue('CREATE', 'LIST', 'list-1', {}, 1)
      await addToSyncQueue('CREATE', 'ITEM', 'item-1', {}, 1, 'list-1')
      
      const syncedItem = await addToSyncQueue('UPDATE', 'ITEM', 'item-2', {}, 2, 'list-1')
      await updateSyncItemStatus(syncedItem.id, 'SYNCED')
    })

    it('should return only PENDING items', async () => {
      const pending = await getPendingSyncItems()
      
      expect(pending).toHaveLength(2)
      expect(pending.every(item => item.status === 'PENDING')).toBe(true)
    })

    it('should return items in FIFO order (oldest first)', async () => {
      const pending = await getPendingSyncItems()
      
      // Should have at least 2 items
      expect(pending.length).toBeGreaterThanOrEqual(2)
      
      // First item should be LIST, second should be ITEM (from beforeEach)
      expect(pending.some(item => item.resourceType === 'LIST')).toBe(true)
      expect(pending.some(item => item.resourceType === 'ITEM')).toBe(true)
      
      // Verify timestamps are in ascending order
      for (let i = 1; i < pending.length; i++) {
        const time1 = new Date(pending[i-1].timestamp).getTime()
        const time2 = new Date(pending[i].timestamp).getTime()
        expect(time1).toBeLessThanOrEqual(time2)
      }
    })

    it('should return empty array when no pending items', async () => {
      await clearStore(STORES.SYNC_QUEUE)
      
      const pending = await getPendingSyncItems()
      
      expect(pending).toEqual([])
    })
  })

  describe('Updating Status', () => {
    let queueItem: SyncQueueItem

    beforeEach(async () => {
      queueItem = await addToSyncQueue('CREATE', 'ITEM', 'item-1', {}, 1, 'list-1')
    })

    it('should update status to SYNCING', async () => {
      await updateSyncItemStatus(queueItem.id, 'SYNCING')
      
      const allItems = await getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE)
      const updated = allItems.find(item => item.id === queueItem.id)
      
      expect(updated?.status).toBe('SYNCING')
      expect(updated?.lastAttempt).toBeTruthy()
    })

    it('should update status to SYNCED', async () => {
      await updateSyncItemStatus(queueItem.id, 'SYNCED')
      
      const allItems = await getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE)
      const updated = allItems.find(item => item.id === queueItem.id)
      
      expect(updated?.status).toBe('SYNCED')
    })

    it('should update status to FAILED with error message', async () => {
      await updateSyncItemStatus(queueItem.id, 'FAILED', 'Network timeout')
      
      const allItems = await getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE)
      const updated = allItems.find(item => item.id === queueItem.id)
      
      expect(updated?.status).toBe('FAILED')
      expect(updated?.error).toBe('Network timeout')
    })

    it('should increment retry count on failure', async () => {
      await updateSyncItemStatus(queueItem.id, 'FAILED', 'Error 1')
      await updateSyncItemStatus(queueItem.id, 'FAILED', 'Error 2')
      
      const allItems = await getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE)
      const updated = allItems.find(item => item.id === queueItem.id)
      
      expect(updated?.retryCount).toBe(2)
    })
  })

  describe('Retry Failed Items', () => {
    beforeEach(async () => {
      const item1 = await addToSyncQueue('CREATE', 'ITEM', 'item-1', {}, 1, 'list-1')
      await updateSyncItemStatus(item1.id, 'FAILED', 'Network error')
      
      const item2 = await addToSyncQueue('UPDATE', 'ITEM', 'item-2', {}, 2, 'list-1')
      await updateSyncItemStatus(item2.id, 'FAILED', 'Timeout')
      
      const item3 = await addToSyncQueue('DELETE', 'ITEM', 'item-3', {}, 3, 'list-1')
      await updateSyncItemStatus(item3.id, 'SYNCED')
    })

    it('should reset FAILED items to PENDING', async () => {
      await retryFailedItems()
      
      const pending = await getPendingSyncItems()
      
      expect(pending).toHaveLength(2)
      expect(pending.every(item => item.status === 'PENDING')).toBe(true)
    })

    it('should not affect SYNCED items', async () => {
      await retryFailedItems()
      
      const allItems = await getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE)
      const syncedItems = allItems.filter(item => item.status === 'SYNCED')
      
      expect(syncedItems).toHaveLength(1)
    })

    it('should preserve retry count when retrying', async () => {
      const items = await getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE)
      const failedItem = items.find(item => item.status === 'FAILED')
      const originalRetryCount = failedItem?.retryCount || 0
      
      await retryFailedItems()
      
      const pending = await getPendingSyncItems()
      const retriedItem = pending.find(item => item.id === failedItem?.id)
      
      expect(retriedItem?.retryCount).toBe(originalRetryCount)
    })
  })

  describe('Pending Delete Detection', () => {
    beforeEach(async () => {
      await addToSyncQueue('CREATE', 'ITEM', 'item-1', {}, 1, 'list-1')
      await addToSyncQueue('UPDATE', 'ITEM', 'item-2', {}, 2, 'list-1')
      await addToSyncQueue('DELETE', 'ITEM', 'item-3', {}, 3, 'list-1')
      await addToSyncQueue('DELETE', 'ITEM', 'item-4', {}, 4, 'list-1')
    })

    it('should detect if resource has pending DELETE', async () => {
      const hasDelete = await hasResourcePendingDelete('ITEM', 'item-3')
      
      expect(hasDelete).toBe(true)
    })

    it('should return false for resource without DELETE', async () => {
      const hasDelete = await hasResourcePendingDelete('ITEM', 'item-1')
      
      expect(hasDelete).toBe(false)
    })

    it('should get all resources with pending DELETE', async () => {
      const resources = await getResourcesWithPendingDelete('ITEM')
      
      expect(resources).toHaveLength(2)
      expect(resources).toContain('item-3')
      expect(resources).toContain('item-4')
    })

    it('should filter by resource type', async () => {
      await addToSyncQueue('DELETE', 'LIST', 'list-1', {}, 1)
      
      const itemDeletes = await getResourcesWithPendingDelete('ITEM')
      const listDeletes = await getResourcesWithPendingDelete('LIST')
      
      expect(itemDeletes).toHaveLength(2)
      expect(listDeletes).toHaveLength(1)
    })

    it('should return empty array when no deletes pending', async () => {
      await clearStore(STORES.SYNC_QUEUE)
      
      const resources = await getResourcesWithPendingDelete('ITEM')
      
      expect(resources).toEqual([])
    })
  })

  describe('Queue Management', () => {
    beforeEach(async () => {
      await addToSyncQueue('CREATE', 'LIST', 'list-1', {}, 1)
      await addToSyncQueue('CREATE', 'ITEM', 'item-1', {}, 1, 'list-1')
      await addToSyncQueue('UPDATE', 'ITEM', 'item-1', {}, 2, 'list-1')
    })

    it('should remove specific sync item', async () => {
      const items = await getPendingSyncItems()
      const firstItem = items[0]
      
      await removeSyncItem(firstItem.id)
      
      const remaining = await getPendingSyncItems()
      expect(remaining).toHaveLength(2)
      expect(remaining.find(item => item.id === firstItem.id)).toBeUndefined()
    })

    it('should clear entire sync queue', async () => {
      await clearStore(STORES.SYNC_QUEUE)
      
      const remaining = await getPendingSyncItems()
      expect(remaining).toEqual([])
    })

    it('should handle removing non-existent item gracefully', async () => {
      await expect(removeSyncItem('non-existent-id')).resolves.not.toThrow()
      
      const remaining = await getPendingSyncItems()
      expect(remaining).toHaveLength(3)
    })
  })

  describe('Race Condition Scenarios', () => {
    it('should handle rapid queue additions', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        addToSyncQueue('CREATE', 'ITEM', `item-${i}`, { name: `Item ${i}` }, 1, 'list-1')
      )
      
      await Promise.all(promises)
      
      const pending = await getPendingSyncItems()
      expect(pending).toHaveLength(50)
    })

    it('should handle concurrent status updates', async () => {
      const items = await Promise.all([
        addToSyncQueue('CREATE', 'ITEM', 'item-1', {}, 1, 'list-1'),
        addToSyncQueue('CREATE', 'ITEM', 'item-2', {}, 1, 'list-1'),
        addToSyncQueue('CREATE', 'ITEM', 'item-3', {}, 1, 'list-1'),
      ])
      
      await Promise.all(
        items.map(item => updateSyncItemStatus(item.id, 'SYNCING'))
      )
      
      const allItems = await getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE)
      const syncing = allItems.filter(item => item.status === 'SYNCING')
      
      expect(syncing).toHaveLength(3)
    })

    it('should maintain queue order under concurrent operations', async () => {
      // Add items with slight delays to ensure ordering
      const item1 = await addToSyncQueue('CREATE', 'ITEM', 'item-1', {}, 1, 'list-1')
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const item2 = await addToSyncQueue('UPDATE', 'ITEM', 'item-1', {}, 2, 'list-1')
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const item3 = await addToSyncQueue('DELETE', 'ITEM', 'item-1', {}, 3, 'list-1')
      
      const pending = await getPendingSyncItems()
      
      expect(pending[0].id).toBe(item1.id)
      expect(pending[1].id).toBe(item2.id)
      expect(pending[2].id).toBe(item3.id)
    })

    it('should handle DELETE queued after UPDATE for same resource', async () => {
      await addToSyncQueue('UPDATE', 'ITEM', 'item-1', { name: 'Updated' }, 2, 'list-1')
      await addToSyncQueue('DELETE', 'ITEM', 'item-1', {}, 2, 'list-1')
      
      const pending = await getPendingSyncItems()
      const hasDelete = await hasResourcePendingDelete('ITEM', 'item-1')
      
      expect(pending).toHaveLength(2)
      expect(hasDelete).toBe(true)
      
      // DELETE should be last in queue
      expect(pending[1].operationType).toBe('DELETE')
    })
  })

  describe('Version Tracking', () => {
    it('should track version in queue item', async () => {
      const item = await addToSyncQueue(
        'UPDATE',
        'ITEM',
        'item-1',
        { name: 'Test' },
        5,
        'list-1'
      )
      
      expect(item.version).toBe(5)
    })

    it('should allow version updates in queue', async () => {
      await addToSyncQueue('CREATE', 'ITEM', 'item-1', {}, 1, 'list-1')
      await new Promise(resolve => setTimeout(resolve, 10))
      await addToSyncQueue('UPDATE', 'ITEM', 'item-1', {}, 2, 'list-1')
      await new Promise(resolve => setTimeout(resolve, 10))
      await addToSyncQueue('UPDATE', 'ITEM', 'item-1', {}, 3, 'list-1')
      
      const pending = await getPendingSyncItems()
      const versions = pending.map(item => item.version)
      
      expect(versions).toEqual([1, 2, 3])
    })
  })

  describe('Payload Storage', () => {
    it('should store complex payload data', async () => {
      const complexPayload = {
        name: 'Complex Item',
        nested: {
          field: 'value',
          array: [1, 2, 3],
        },
        quantity: 2.5,
        tags: ['tag1', 'tag2'],
      }
      
      const item = await addToSyncQueue(
        'CREATE',
        'ITEM',
        'item-1',
        complexPayload,
        1,
        'list-1'
      )
      
      expect(item.payload).toEqual(complexPayload)
    })

    it('should handle null/undefined in payload', async () => {
      const payload = {
        name: 'Test',
        quantity: null,
        type: undefined,
      }
      
      const item = await addToSyncQueue(
        'UPDATE',
        'ITEM',
        'item-1',
        payload,
        2,
        'list-1'
      )
      
      expect(item.payload).toMatchObject({
        name: 'Test',
        quantity: null,
      })
    })
  })
})
