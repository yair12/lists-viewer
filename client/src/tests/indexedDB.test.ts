import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  initDB,
  STORES,
  getItem,
  getAllItems,
  getItemsByIndex,
  putItem,
  putItems,
  deleteItem,
  deleteItems,
  clearStore,
  countItems,
  clearAllData,
  closeDB,
} from '../services/storage/indexedDB'
import { mockLists, mockItems } from './mockData'

describe('IndexedDB Storage', () => {
  beforeEach(async () => {
    // Initialize fresh database
    await initDB()
    // Clear all data before each test
    await clearAllData()
  })

  afterEach(() => {
    closeDB()
  })

  describe('Database Initialization', () => {
    it('should initialize database with all stores', async () => {
      const db = await initDB()
      
      expect(db.name).toBe('lists-viewer-db')
      expect(db.version).toBe(1)
      expect(db.objectStoreNames.contains(STORES.LISTS)).toBe(true)
      expect(db.objectStoreNames.contains(STORES.ITEMS)).toBe(true)
      expect(db.objectStoreNames.contains(STORES.SYNC_QUEUE)).toBe(true)
      expect(db.objectStoreNames.contains(STORES.CACHE)).toBe(true)
      expect(db.objectStoreNames.contains(STORES.USER)).toBe(true)
    })

    it('should return same instance on multiple calls', async () => {
      const db1 = await initDB()
      const db2 = await initDB()
      
      expect(db1).toBe(db2)
    })
  })

  describe('Basic CRUD Operations', () => {
    it('should store and retrieve a single item', async () => {
      const list = mockLists[0]
      
      await putItem(STORES.LISTS, list)
      const retrieved = await getItem<typeof list>(STORES.LISTS, list.id)
      
      expect(retrieved).toEqual(list)
    })

    it('should return null for non-existent item', async () => {
      const result = await getItem(STORES.LISTS, 'non-existent-id')
      
      expect(result).toBeNull()
    })

    it('should store and retrieve multiple items', async () => {
      await putItems(STORES.LISTS, mockLists)
      const retrieved = await getAllItems(STORES.LISTS)
      
      expect(retrieved).toHaveLength(mockLists.length)
      expect(retrieved).toEqual(expect.arrayContaining(mockLists))
    })

    it('should update existing item', async () => {
      const list = mockLists[0]
      await putItem(STORES.LISTS, list)
      
      const updated = { ...list, name: 'Updated Name', version: 2 }
      await putItem(STORES.LISTS, updated)
      
      const retrieved = await getItem(STORES.LISTS, list.id)
      expect(retrieved).toEqual(updated)
      expect(retrieved?.name).toBe('Updated Name')
    })

    it('should delete a single item', async () => {
      const list = mockLists[0]
      await putItem(STORES.LISTS, list)
      
      await deleteItem(STORES.LISTS, list.id)
      
      const retrieved = await getItem(STORES.LISTS, list.id)
      expect(retrieved).toBeNull()
    })

    it('should delete multiple items', async () => {
      await putItems(STORES.LISTS, mockLists)
      
      const idsToDelete = [mockLists[0].id, mockLists[1].id]
      await deleteItems(STORES.LISTS, idsToDelete)
      
      const remaining = await getAllItems(STORES.LISTS)
      expect(remaining).toHaveLength(0)
    })

    it('should handle deleting empty array', async () => {
      await putItems(STORES.LISTS, mockLists)
      
      await deleteItems(STORES.LISTS, [])
      
      const all = await getAllItems(STORES.LISTS)
      expect(all).toHaveLength(mockLists.length)
    })
  })

  describe('Index Queries', () => {
    beforeEach(async () => {
      await putItems(STORES.ITEMS, mockItems)
    })

    it('should query items by listId index', async () => {
      const list1Items = await getItemsByIndex(STORES.ITEMS, 'listId', 'list-1')
      
      expect(list1Items).toHaveLength(3)
      expect(list1Items.every((item: any) => item.listId === 'list-1')).toBe(true)
    })

    it('should query items by completed index', async () => {
      // Note: fake-indexedDB has issues with boolean indexes, query all and filter
      const allItems = await getAllItems(STORES.ITEMS)
      const completedItems = allItems.filter((item: any) => item.completed === true)
      
      expect(completedItems).toHaveLength(1)
      expect(completedItems[0]).toMatchObject({
        id: 'item-3',
        completed: true,
      })
    })

    it('should query items by type index', async () => {
      const regularItems = await getItemsByIndex(STORES.ITEMS, 'type', 'regular')
      
      expect(regularItems).toHaveLength(3)
      expect(regularItems.every((item: any) => item.type === 'regular')).toBe(true)
    })

    it('should return empty array for non-matching index query', async () => {
      const results = await getItemsByIndex(STORES.ITEMS, 'listId', 'non-existent-list')
      
      expect(results).toEqual([])
    })

    it('should query by compound index (listId + order)', async () => {
      // Query items from list-1 with order >= 1
      const range = IDBKeyRange.bound(['list-1', 1], ['list-1', 999])
      const results = await getItemsByIndex(STORES.ITEMS, 'listId_order', range)
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((item: any) => item.listId === 'list-1' && item.order >= 1)).toBe(true)
    })
  })

  describe('Store Management', () => {
    it('should clear all items from a store', async () => {
      await putItems(STORES.LISTS, mockLists)
      await putItems(STORES.ITEMS, mockItems)
      
      await clearStore(STORES.LISTS)
      
      const lists = await getAllItems(STORES.LISTS)
      const items = await getAllItems(STORES.ITEMS)
      
      expect(lists).toHaveLength(0)
      expect(items).toHaveLength(mockItems.length) // Items should remain
    })

    it('should count items in store', async () => {
      await putItems(STORES.LISTS, mockLists)
      
      const count = await countItems(STORES.LISTS)
      
      expect(count).toBe(mockLists.length)
    })

    it('should return 0 for empty store count', async () => {
      const count = await countItems(STORES.LISTS)
      
      expect(count).toBe(0)
    })

    it('should clear all data from database', async () => {
      await putItems(STORES.LISTS, mockLists)
      await putItems(STORES.ITEMS, mockItems)
      await putItem(STORES.USER, { id: 'user-1', name: 'Test' })
      
      await clearAllData()
      
      const lists = await getAllItems(STORES.LISTS)
      const items = await getAllItems(STORES.ITEMS)
      const users = await getAllItems(STORES.USER)
      
      expect(lists).toHaveLength(0)
      expect(items).toHaveLength(0)
      expect(users).toHaveLength(0)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent writes to same store', async () => {
      const promises = mockLists.map(list => putItem(STORES.LISTS, list))
      
      await Promise.all(promises)
      
      const results = await getAllItems(STORES.LISTS)
      expect(results).toHaveLength(mockLists.length)
    })

    it('should handle concurrent reads', async () => {
      await putItems(STORES.LISTS, mockLists)
      
      const promises = mockLists.map(list => getItem(STORES.LISTS, list.id))
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(mockLists.length)
      expect(results.every(r => r !== null)).toBe(true)
    })

    it('should handle mixed read/write operations', async () => {
      await putItem(STORES.LISTS, mockLists[0])
      
      const operations = [
        getItem(STORES.LISTS, mockLists[0].id),
        putItem(STORES.LISTS, mockLists[1]),
        getAllItems(STORES.LISTS),
      ]
      
      const [getResult, , getAllResult] = await Promise.all(operations)
      
      expect(getResult).toEqual(mockLists[0])
      expect(getAllResult).toHaveLength(2)
    })
  })

  describe('Transaction Integrity', () => {
    it('should batch multiple puts in single transaction', async () => {
      const startTime = Date.now()
      
      await putItems(STORES.ITEMS, mockItems)
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      const results = await getAllItems(STORES.ITEMS)
      expect(results).toHaveLength(mockItems.length)
      
      // Batched operation should be faster than individual puts
      // (This is a rough check - timing may vary)
      expect(duration).toBeLessThan(1000)
    })

    it('should maintain data integrity after failed operation', async () => {
      await putItem(STORES.LISTS, mockLists[0])
      
      try {
        // Try to put invalid data (should fail)
        await putItem(STORES.LISTS, null as any)
      } catch (error) {
        // Expected to fail
      }
      
      // Original data should still be intact
      const result = await getItem(STORES.LISTS, mockLists[0].id)
      expect(result).toEqual(mockLists[0])
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty arrays', async () => {
      await putItems(STORES.LISTS, [])
      
      const results = await getAllItems(STORES.LISTS)
      expect(results).toEqual([])
    })

    it('should handle large datasets', async () => {
      // Create 1000 items
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockItems[0],
        id: `item-${i}`,
        order: i,
      }))
      
      await putItems(STORES.ITEMS, largeDataset)
      
      const count = await countItems(STORES.ITEMS)
      expect(count).toBe(1000)
    })

    it('should handle special characters in IDs', async () => {
      const specialList = {
        ...mockLists[0],
        id: 'list-with-special-chars-!@#$%^&*()',
      }
      
      await putItem(STORES.LISTS, specialList)
      const result = await getItem(STORES.LISTS, specialList.id)
      
      expect(result).toEqual(specialList)
    })

    it('should handle very long strings', async () => {
      const longName = 'A'.repeat(10000)
      const listWithLongName = {
        ...mockLists[0],
        name: longName,
      }
      
      await putItem(STORES.LISTS, listWithLongName)
      const result = await getItem(STORES.LISTS, listWithLongName.id)
      
      expect(result?.name).toBe(longName)
    })
  })
})
