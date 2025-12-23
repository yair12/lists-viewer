# Phase 4 - Data Flow Architecture

## Offline-First Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Action                              │
│                 (Create/Update/Delete List/Item)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      React Component                             │
│              (ListsGrid, ItemsList, etc.)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Custom Hook Layer                              │
│    useLists(), useItems(), useCreateList(), etc.                │
│              (TanStack Query Integration)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Network Status Check                          │
│              (useNetworkStatus hook)                             │
└─────────────────┬───────────────────────────────┬───────────────┘
                  │                               │
       ┌──────────▼─────────┐         ┌──────────▼─────────┐
       │    ONLINE MODE     │         │   OFFLINE MODE     │
       └──────────┬─────────┘         └──────────┬─────────┘
                  │                               │
                  ▼                               ▼
    ┌─────────────────────────┐     ┌─────────────────────────┐
    │   API Service Layer     │     │   Sync Queue Manager    │
    │   (Axios Client)        │     │  addToSyncQueue()       │
    │   • lists.ts            │     │  • Queue operation      │
    │   • items.ts            │     │  • Set status: PENDING  │
    │   • users.ts            │     │  • Store payload        │
    └───────────┬─────────────┘     └───────────┬─────────────┘
                │                               │
                ▼                               │
    ┌─────────────────────────┐               │
    │   Backend API           │               │
    │   POST/PUT/DELETE       │               │
    │   /api/v1/lists         │               │
    │   /api/v1/items         │               │
    └───────────┬─────────────┘               │
                │                               │
       ┌────────▼────────┐                    │
       │   SUCCESS       │                    │
       └────────┬────────┘                    │
                │                               │
                └───────────┬───────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │     Cache Manager             │
            │   • cacheList()               │
            │   • cacheItems()              │
            │   • Update IndexedDB          │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │       IndexedDB               │
            │   ┌─────────────────────┐     │
            │   │ Lists Store         │     │
            │   │ Items Store         │     │
            │   │ Sync Queue Store    │     │
            │   │ Cache Store         │     │
            │   │ User Store          │     │
            │   └─────────────────────┘     │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  TanStack Query Cache         │
            │  • Invalidate queries         │
            │  • Update cached data         │
            │  • Trigger re-render          │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │    React Component Update     │
            │    (UI reflects changes)      │
            └───────────────────────────────┘
```

## Sync Queue Processing (Future - Phase 5)

```
┌─────────────────────────────────────────────────────────────────┐
│                  Network Comes Online                            │
│              (Online event detected)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Sync Manager Triggered                        │
│                  (Background process)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Get Pending Items from Sync Queue                   │
│              (FIFO order by timestamp)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │  For Each Item  │
                   └────────┬────────┘
                            │
                ┌───────────▼───────────┐
                │ Set status: SYNCING   │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │  Execute API Request  │
                │  (POST/PUT/DELETE)    │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼────┐      ┌──────▼──────┐    ┌──────▼──────┐
    │SUCCESS │      │  CONFLICT   │    │   ERROR     │
    └───┬────┘      └──────┬──────┘    └──────┬──────┘
        │                  │                   │
        ▼                  ▼                   ▼
    ┌────────┐      ┌──────────────┐    ┌──────────────┐
    │ SYNCED │      │ Show Conflict│    │ FAILED       │
    │ Remove │      │ Resolution UI│    │ Retry later  │
    │ from Q │      └──────────────┘    │ (backoff)    │
    └────────┘                          └──────────────┘
```

## Component Usage Pattern

```typescript
// Component using offline-first hooks
function ListsComponent() {
  // 1. Get network status
  const { isOnline } = useNetworkStatus();
  
  // 2. Fetch lists (works offline with cache)
  const { data: lists, isLoading } = useLists();
  
  // 3. Mutation hooks (work offline)
  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();
  
  // 4. Sync queue status
  const { data: syncStats } = useSyncQueueStats();
  
  // 5. Handle create (works both online and offline)
  const handleCreate = async (name: string) => {
    try {
      await createList.mutateAsync({ name });
      // Success - either synced or queued
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    <div>
      {/* Network indicator */}
      <NetworkBadge online={isOnline} pendingSync={syncStats?.pending} />
      
      {/* Lists display (from cache when offline) */}
      {lists?.map(list => <ListCard key={list.id} list={list} />)}
    </div>
  );
}
```

## IndexedDB Schema

```
Database: lists-viewer-db (v1)
│
├── Store: lists
│   ├── keyPath: 'id'
│   └── Indexes:
│       ├── updatedAt
│       └── createdBy
│
├── Store: items
│   ├── keyPath: 'id'
│   └── Indexes:
│       ├── listId
│       ├── type
│       ├── completed
│       ├── order
│       └── listId_order (compound)
│
├── Store: syncQueue
│   ├── keyPath: 'id'
│   └── Indexes:
│       ├── status
│       ├── timestamp
│       └── status_timestamp (compound)
│
├── Store: cache
│   └── keyPath: 'key'
│
└── Store: user
    └── keyPath: 'id'
```

## Query Keys Structure

```typescript
queryKeys = {
  lists: {
    all: ['lists'],
    detail: (id) => ['lists', id]
  },
  items: {
    all: ['items'],
    byList: (listId) => ['items', 'list', listId],
    detail: (listId, itemId) => ['items', listId, itemId]
  },
  user: {
    current: ['user', 'current'],
    icons: ['user', 'icons']
  },
  sync: {
    queue: ['sync', 'queue'],
    stats: ['sync', 'stats']
  }
}
```

## Error Handling Flow

```
API Request
     │
     ▼
┌─────────────┐
│ Try Request │
└─────┬───────┘
      │
      ├─► Success ────────────► Update Cache ────► UI Update
      │
      ├─► Network Error ──────► Add to Queue ────► Update Cache (optimistic) ──► UI Update
      │
      ├─► 409 Conflict ───────► Store conflict ──► Show resolution UI
      │
      └─► Other Error ────────► Show error ──────► Retry or fail
```

---

**Legend:**
- ┌─┐ Process/Component
- ▼ Data flow direction
- ├─┤ Decision point
- │ Connection
