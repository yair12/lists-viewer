# Phase 4 Implementation - Offline-First Data Management

## Overview

Phase 4 has been successfully implemented, establishing the offline-first data management infrastructure for the Lists Viewer application. This phase includes IndexedDB integration, sync queue management, API service layer enhancements, and TanStack Query setup.

## Completed Tasks

### ✅ 1. IndexedDB Setup

**File**: `client/src/services/storage/indexedDB.ts`

- Created IndexedDB schema with 5 stores:
  - `lists` - Cached lists (keyPath: 'id', index: updatedAt, createdBy)
  - `items` - Cached items (keyPath: 'id', indexes: listId, type, completed, order, listId_order)
  - `syncQueue` - Pending operations (keyPath: 'id', indexes: status, timestamp, status_timestamp)
  - `cache` - Miscellaneous cached data (keyPath: 'key')
  - `user` - User data (keyPath: 'id')

- Implemented core operations:
  - `initDB()` - Initialize database with schema
  - `getItem()` - Get single item by key
  - `getAllItems()` - Get all items from store
  - `getItemsByIndex()` - Query by index
  - `putItem()` / `putItems()` - Add/update items
  - `deleteItem()` / `deleteItems()` - Remove items
  - `clearStore()` - Clear store data
  - `countItems()` - Count items in store
  - `clearAllData()` - Reset entire database

### ✅ 2. Sync Queue Management

**File**: `client/src/services/storage/syncQueue.ts`

- Implemented sync queue with FIFO processing
- Queue item structure:
  ```typescript
  {
    id: string,
    timestamp: string,
    operationType: 'CREATE' | 'UPDATE' | 'DELETE',
    resourceType: 'LIST' | 'ITEM',
    resourceId: string,
    parentId?: string,
    payload: unknown,
    version: number,
    retryCount: number,
    status: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED',
    error?: string,
    lastAttempt?: string
  }
  ```

- Key functions:
  - `addToSyncQueue()` - Add operation to queue
  - `getPendingSyncItems()` - Get pending items (FIFO sorted)
  - `getFailedSyncItems()` - Get failed items
  - `updateSyncItemStatus()` - Update item status
  - `removeSyncItem()` - Remove after successful sync
  - `clearSyncedItems()` - Clean up synced items
  - `retryFailedItems()` - Reset failed items to pending
  - `getSyncQueueStats()` - Get queue statistics
  - `hasPendingSync()` - Check for pending operations

### ✅ 3. Cache Manager

**File**: `client/src/services/storage/cacheManager.ts`

- Implemented caching for lists and items
- List operations:
  - `cacheList()` / `cacheLists()` - Cache lists
  - `getCachedList()` / `getCachedLists()` - Retrieve cached lists
  - `removeCachedList()` - Remove cached list

- Item operations:
  - `cacheItem()` / `cacheItems()` - Cache items
  - `getCachedItem()` - Get single cached item
  - `getCachedItemsByList()` - Get items by list ID
  - `getCachedItemsByType()` - Get items by type (item/list)
  - `removeCachedItem()` - Remove cached item
  - `removeCachedItemsByList()` - Remove all items for list

- User preferences:
  - `cacheUserPreferences()` - Cache preferences
  - `getCachedUserPreference()` - Get cached preference
  - `cacheCurrentUser()` - Cache current user
  - `getCachedCurrentUser()` - Get cached user

- Statistics:
  - `getCacheStats()` - Get cache statistics

### ✅ 4. API Service Layer Enhancement

**File**: `client/src/services/api/client.ts`

Enhanced Axios client with:
- User ID header injection from localStorage
- Comprehensive error handling:
  - 401 Unauthorized
  - 404 Not Found
  - 409 Conflict (version mismatch)
  - 500-504 Server errors
  - Network errors and timeouts
- Development logging
- Utility functions:
  - `isVersionConflict()` - Check for version conflicts
  - `isNetworkError()` - Check for network errors
  - `getErrorMessage()` - Extract error messages

**Files**: `client/src/services/api/lists.ts`, `items.ts`, `users.ts`
- All API services already implemented from previous phases

### ✅ 5. Network Status Service

**File**: `client/src/services/offline/networkStatus.ts`

- Singleton service for network monitoring
- Features:
  - Online/offline event listeners
  - Real-time status tracking
  - Listener subscription pattern
  - Connectivity testing
  - Wait for online functionality
- Methods:
  - `isOnline` - Get current status
  - `addListener()` - Subscribe to status changes
  - `removeListener()` - Unsubscribe
  - `testConnectivity()` - Test actual network connectivity
  - `waitForOnline()` - Wait for connection with optional timeout

### ✅ 6. TanStack Query Setup

**File**: `client/src/services/api/queryClient.ts`

- Configured QueryClient with optimized defaults:
  - Stale time: 5 minutes
  - Cache time: 10 minutes
  - Retry with exponential backoff
  - Refetch on window focus and reconnect
- Defined query keys structure:
  ```typescript
  queryKeys = {
    lists: { all, detail(id) },
    items: { all, byList(listId), detail(listId, itemId) },
    user: { current, icons },
    sync: { queue, stats }
  }
  ```

### ✅ 7. Custom Hooks Implementation

#### Lists Hooks (`client/src/hooks/useLists.ts`)
- `useLists()` - Fetch all lists with offline fallback
- `useList(id)` - Fetch single list with cache
- `useCreateList()` - Create list with offline queue support
- `useUpdateList()` - Update list with optimistic updates
- `useDeleteList()` - Delete list with offline support

#### Items Hooks (`client/src/hooks/useItems.ts`)
- `useItems(listId)` - Fetch items with offline fallback
- `useItem(listId, itemId)` - Fetch single item
- `useCreateItem()` - Create item with offline queue
- `useUpdateItem()` - Update item with optimistic updates
- `useDeleteItem()` - Delete item with offline support
- `useReorderItems()` - Reorder items
- `useBulkCompleteItems()` - Bulk complete items
- `useMoveItem()` - Move item between lists

#### User Hooks (`client/src/hooks/useUser.ts`)
- `useCurrentUser()` - Get current user from cache
- `useInitUser()` - Initialize user with offline support
- `useIcons()` - Fetch available icons with defaults
- `useLogout()` - Logout user

#### Utility Hooks
- `useNetworkStatus()` - Monitor network status (`client/src/hooks/useNetworkStatus.ts`)
- `useSyncQueue()` - Get sync queue items (`client/src/hooks/useSyncQueue.ts`)
- `useSyncQueueStats()` - Get sync queue statistics
- `usePendingSyncCount()` - Get pending sync count
- `useHasPendingSync()` - Check for pending sync

### ✅ 8. App Integration

**File**: `client/src/App.tsx`

- Integrated QueryClientProvider with custom queryClient
- Added IndexedDB initialization on app startup
- Maintained user authentication flow

## Key Features Implemented

### Offline-First Architecture
1. **Network Detection**: Real-time monitoring of online/offline status
2. **Cache-First Strategy**: Always read from cache first, update in background
3. **Sync Queue**: All offline operations queued for later synchronization
4. **Optimistic Updates**: UI updates immediately, syncs in background

### Error Handling
1. **Network Errors**: Graceful fallback to cached data
2. **Version Conflicts**: Detection and preparation for conflict resolution
3. **Retry Logic**: Automatic retries with exponential backoff
4. **Error Messages**: User-friendly error messages extracted

### Data Flow
```
User Action
  ↓
React Component
  ↓
Custom Hook (TanStack Query)
  ↓
API Service Layer
  ↓
Network Check
  ├─ Online → API Request → Cache Update
  └─ Offline → Sync Queue → Cache Update
```

## File Structure

```
client/src/
├── services/
│   ├── api/
│   │   ├── client.ts (Enhanced Axios with interceptors)
│   │   ├── lists.ts (Lists API - existing)
│   │   ├── items.ts (Items API - existing)
│   │   ├── users.ts (Users API - existing)
│   │   └── queryClient.ts (TanStack Query config)
│   ├── storage/
│   │   ├── indexedDB.ts (IndexedDB wrapper)
│   │   ├── syncQueue.ts (Sync queue management)
│   │   ├── cacheManager.ts (Cache utilities)
│   │   └── index.ts (Exports)
│   └── offline/
│       └── networkStatus.ts (Network monitoring)
├── hooks/
│   ├── useLists.ts (Lists hooks)
│   ├── useItems.ts (Items hooks)
│   ├── useUser.ts (User hooks)
│   ├── useNetworkStatus.ts (Network hook)
│   ├── useSyncQueue.ts (Sync queue hooks)
│   └── index.ts (Exports)
└── App.tsx (Updated with IndexedDB init)
```

## Testing Recommendations

1. **IndexedDB Operations**
   - Test CRUD operations for all stores
   - Test index queries
   - Test error handling

2. **Sync Queue**
   - Test queue additions
   - Test FIFO ordering
   - Test status updates
   - Test retry logic

3. **Network Status**
   - Test online/offline transitions
   - Test listener subscriptions
   - Test connectivity testing

4. **Custom Hooks**
   - Test data fetching with online/offline
   - Test optimistic updates
   - Test error handling
   - Test cache invalidation

5. **Integration Tests**
   - Test complete offline workflow
   - Test sync queue processing
   - Test conflict scenarios

## Next Steps (Phase 5)

Phase 5 will implement:
1. **Sync Manager** - Background sync processor
2. **Conflict Resolution** - UI and logic for handling conflicts
3. **Service Worker** - PWA offline support
4. **Retry Logic** - Exponential backoff and dead letter queue
5. **Sync Indicators** - UI components for sync status

## Dependencies Added

All required dependencies were already present in package.json:
- `@tanstack/react-query` (^5.28.0)
- `axios` (^1.6.0)
- `uuid` (^13.0.0)

## Environment Variables

Ensure `.env` file has:
```
VITE_API_URL=http://localhost:8080
```

## Usage Examples

### Fetching Lists
```typescript
const { data: lists, isLoading, error } = useLists();
```

### Creating an Item (with offline support)
```typescript
const createItem = useCreateItem();

await createItem.mutateAsync({
  listId: 'list-id',
  data: {
    type: 'item',
    name: 'New Item',
    quantity: 2,
    quantityType: 'pieces'
  }
});
```

### Monitoring Network Status
```typescript
const { isOnline, testConnectivity } = useNetworkStatus();
```

### Checking Sync Queue
```typescript
const { data: stats } = useSyncQueueStats();
// stats: { pending, syncing, failed, synced, total }
```

## Notes

- All offline operations are automatically queued
- Cache is updated optimistically for better UX
- Version conflicts are detected but not yet resolved (Phase 5)
- Service Worker implementation pending (Phase 5)
- Background sync processing pending (Phase 5)

---

**Phase 4 Status**: ✅ **COMPLETE**  
**Date Completed**: December 22, 2025  
**Next Phase**: Phase 5 - Offline Sync & Conflict Resolution
