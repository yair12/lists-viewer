# Offline Mode Implementation Plan

## Current State

### ✅ What Exists
- **IndexedDB Storage Layer** (`client/src/services/storage/`)
  - `listStorage.ts` - Local list persistence
  - `itemStorage.ts` - Local item persistence
  - `userStorage.ts` - User data storage
  
- **Sync Queue Infrastructure** (`client/src/services/offline/syncQueue.ts`)
  - Queue operations with priority
  - Retry logic with exponential backoff
  - Status tracking (pending, processing, completed, failed)
  - Operations: CREATE, UPDATE, DELETE, REORDER
  
- **Unit Tests** (56 passing tests)
  - IndexedDB storage operations (27 tests)
  - Sync queue functionality (29 tests)

### ❌ What's Missing
The offline infrastructure **exists but isn't connected** to the actual mutations. Currently:
- Mutations make direct API calls
- No optimistic updates
- No offline detection
- No conflict resolution UI
- No error handling dialogs

---

## Implementation Steps

### 1. Create Offline Manager Hook (`useOfflineManager.ts`)

**Purpose**: Central offline state management

```typescript
// client/src/hooks/useOfflineManager.ts
export function useOfflineManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Poll queue for pending count
  useEffect(() => {
    const interval = setInterval(async () => {
      const queue = await syncQueue.getAll();
      setPendingCount(queue.filter(op => op.status === 'pending').length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Process queue when online
  useEffect(() => {
    if (isOnline && !syncInProgress) {
      processQueue();
    }
  }, [isOnline]);

  return { isOnline, pendingCount, syncInProgress };
}
```

### 2. Refactor Mutation Hooks to Use Queue

**Current Flow** (Direct API):
```typescript
// useCreateItem (current)
mutationFn: (data) => itemsApi.create(listId, data)
```

**New Flow** (Queue + Optimistic):
```typescript
// useCreateItem (new)
mutationFn: async (data) => {
  const tempId = uuid();
  const optimisticItem = { ...data, id: tempId, version: 1, pending: true };
  
  // 1. Add to IndexedDB immediately
  await itemStorage.add(optimisticItem);
  
  // 2. Add to sync queue
  await syncQueue.add({
    type: 'CREATE',
    entity: 'item',
    data: { listId, item: data },
    tempId,
    priority: 1,
  });
  
  // 3. Update React Query cache (optimistic)
  queryClient.setQueryData(['items', listId], (old) => [...old, optimisticItem]);
  
  return optimisticItem;
}
```

### 3. Background Queue Processor

**Purpose**: Process queued operations when online

```typescript
// client/src/services/offline/queueProcessor.ts
export class QueueProcessor {
  private processing = false;
  private pollInterval: number | null = null;

  async start() {
    if (this.processing) return;
    this.processing = true;

    // Process queue every 5 seconds when online
    this.pollInterval = setInterval(() => {
      if (navigator.onLine) {
        this.processQueue();
      }
    }, 5000);
  }

  async processQueue() {
    const queue = await syncQueue.getAll();
    const pending = queue.filter(op => op.status === 'pending');

    for (const operation of pending) {
      try {
        await syncQueue.updateStatus(operation.id, 'processing');
        
        const result = await this.executeOperation(operation);
        
        // Update IndexedDB with server response (real ID, version)
        await this.updateLocalStorage(operation, result);
        
        // Mark complete
        await syncQueue.updateStatus(operation.id, 'completed');
        
        // Update React Query cache with server data
        this.invalidateQueries(operation);
        
      } catch (error) {
        if (error.code === 'version_conflict') {
          // Show conflict resolution dialog
          await this.handleConflict(operation, error);
        } else {
          // Mark as failed, will retry
          await syncQueue.updateStatus(operation.id, 'failed');
          await syncQueue.incrementRetries(operation.id);
          
          // Show error dialog if max retries exceeded
          if (operation.retries >= 3) {
            this.showErrorDialog(operation, error);
          }
        }
      }
    }
  }

  private async executeOperation(operation: SyncOperation) {
    switch (operation.type) {
      case 'CREATE':
        return await itemsApi.create(operation.data.listId, operation.data.item);
      case 'UPDATE':
        return await itemsApi.update(
          operation.data.listId,
          operation.data.itemId,
          operation.data.updates
        );
      case 'DELETE':
        return await itemsApi.delete(
          operation.data.listId,
          operation.data.itemId,
          operation.data.version
        );
      case 'REORDER':
        return await itemsApi.reorder(operation.data.listId, operation.data.items);
    }
  }
}
```

### 4. Data Polling for Updates

**Purpose**: Detect server-side changes and conflicts

```typescript
// client/src/hooks/useDataSync.ts
export function useDataSync() {
  const queryClient = useQueryClient();
  const { isOnline } = useOfflineManager();

  useEffect(() => {
    if (!isOnline) return;

    // Poll every 10 seconds for updates
    const interval = setInterval(async () => {
      const lists = queryClient.getQueryData(['lists']);
      
      for (const list of lists) {
        const serverItems = await itemsApi.getAll(list.id);
        const localItems = await itemStorage.getAll(list.id);
        
        // Check for conflicts
        for (const localItem of localItems) {
          const serverItem = serverItems.find(si => si.id === localItem.id);
          
          if (serverItem && serverItem.version > localItem.version) {
            // Server has newer version
            const pendingOp = await syncQueue.findByEntity('item', localItem.id);
            
            if (pendingOp) {
              // Conflict! Local changes pending but server has newer version
              showConflictDialog(localItem, serverItem, pendingOp);
            } else {
              // No conflict, just update local
              await itemStorage.update(serverItem);
              queryClient.setQueryData(['items', list.id], serverItems);
            }
          }
        }
        
        // Remove completed operations from queue
        await this.cleanupQueue(localItems, serverItems);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isOnline]);
}
```

### 5. Conflict Resolution Dialog

**Purpose**: Let user choose server version or override with local changes

```typescript
// client/src/components/Common/ConflictDialog.tsx
interface ConflictDialogProps {
  open: boolean;
  localItem: Item;
  serverItem: Item;
  operation: SyncOperation;
  onResolve: (strategy: 'use_server' | 'use_local') => void;
  onClose: () => void;
}

export default function ConflictDialog({
  open,
  localItem,
  serverItem,
  operation,
  onResolve,
  onClose,
}: ConflictDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Conflict Detected
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          This item was modified in another tab or device. Choose which version to keep:
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          {/* Local Version */}
          <Card sx={{ flex: 1, border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Your Changes (Local)
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {localItem.name}
              </Typography>
              {localItem.quantity && (
                <Chip label={`${localItem.quantity} ${localItem.quantityType}`} size="small" />
              )}
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Modified: {new Date(localItem.updatedAt).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Version: {localItem.version}
              </Typography>
            </CardContent>
          </Card>

          {/* Server Version */}
          <Card sx={{ flex: 1, border: '2px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Server Version (Latest)
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {serverItem.name}
              </Typography>
              {serverItem.quantity && (
                <Chip label={`${serverItem.quantity} ${serverItem.quantityType}`} size="small" />
              )}
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Modified: {new Date(serverItem.updatedAt).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Version: {serverItem.version}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="outlined"
          onClick={() => onResolve('use_server')}
          startIcon={<CloudDownloadIcon />}
        >
          Use Server Version
        </Button>
        <Button
          variant="contained"
          onClick={() => onResolve('use_local')}
          startIcon={<CloudUploadIcon />}
        >
          Keep My Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### 6. Conflict Resolution Logic

```typescript
// client/src/services/offline/conflictResolver.ts
export class ConflictResolver {
  async resolve(
    strategy: 'use_server' | 'use_local',
    localItem: Item,
    serverItem: Item,
    operation: SyncOperation
  ) {
    if (strategy === 'use_server') {
      // 1. Update local storage with server version
      await itemStorage.update(serverItem);
      
      // 2. Remove pending operation from queue
      await syncQueue.remove(operation.id);
      
      // 3. Update React Query cache
      queryClient.setQueryData(['items', localItem.listId], (old) =>
        old.map(item => item.id === serverItem.id ? serverItem : item)
      );
      
    } else if (strategy === 'use_local') {
      // 1. Force update on server with local changes
      const updated = await itemsApi.update(
        localItem.listId,
        localItem.id,
        {
          ...localItem,
          version: serverItem.version, // Use server's current version
        }
      );
      
      // 2. Update local with new version from server
      await itemStorage.update(updated);
      
      // 3. Mark queue operation as completed
      await syncQueue.updateStatus(operation.id, 'completed');
      
      // 4. Update React Query cache
      queryClient.setQueryData(['items', localItem.listId], (old) =>
        old.map(item => item.id === updated.id ? updated : item)
      );
    }
  }
}
```

### 7. Error Dialog for Failed Operations

```typescript
// client/src/components/Common/SyncErrorDialog.tsx
interface SyncErrorDialogProps {
  open: boolean;
  operation: SyncOperation;
  error: Error;
  onRetry: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export default function SyncErrorDialog({
  open,
  operation,
  error,
  onRetry,
  onDiscard,
  onClose,
}: SyncErrorDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon color="error" />
          Sync Failed
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Failed to sync the following operation:
        </Typography>
        
        <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, my: 2 }}>
          <Typography variant="subtitle2">
            {operation.type} {operation.entity}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {JSON.stringify(operation.data, null, 2)}
          </Typography>
        </Box>

        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {error.message}
        </Alert>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Retries: {operation.retries} / 3
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Dismiss</Button>
        <Button onClick={onDiscard} color="error">
          Discard Changes
        </Button>
        <Button onClick={onRetry} variant="contained">
          Retry Now
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### 8. Offline Indicator Component

```typescript
// client/src/components/Common/OfflineIndicator.tsx
export default function OfflineIndicator() {
  const { isOnline, pendingCount } = useOfflineManager();

  if (isOnline && pendingCount === 0) {
    return null; // Don't show anything when online and synced
  }

  return (
    <Chip
      icon={isOnline ? <SyncIcon /> : <CloudOffIcon />}
      label={
        isOnline
          ? `Syncing ${pendingCount} changes...`
          : `Offline - ${pendingCount} pending`
      }
      color={isOnline ? 'warning' : 'error'}
      size="small"
      sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}
    />
  );
}
```

### 9. Add to Main Layout

```typescript
// client/src/components/Layout/MainLayout.tsx
import OfflineIndicator from '../Common/OfflineIndicator';

export default function MainLayout({ children }) {
  return (
    <Box>
      <Header />
      <Sidebar />
      <Box component="main">
        {children}
      </Box>
      <OfflineIndicator /> {/* Add this */}
    </Box>
  );
}
```

---

## Implementation Checklist

### Phase 1: Core Offline Infrastructure
- [ ] Create `useOfflineManager` hook for online/offline state
- [ ] Create `QueueProcessor` class for background sync
- [ ] Refactor `useCreateItem` to use queue + optimistic updates
- [ ] Refactor `useUpdateItem` to use queue + optimistic updates
- [ ] Refactor `useDeleteItem` to use queue + optimistic updates
- [ ] Add `OfflineIndicator` component to show sync status

### Phase 2: Conflict Resolution
- [ ] Create `ConflictDialog` component
- [ ] Create `ConflictResolver` class
- [ ] Add `useDataSync` hook for polling server updates
- [ ] Implement conflict detection logic
- [ ] Wire up "Use Server" / "Keep My Changes" buttons

### Phase 3: Error Handling
- [ ] Create `SyncErrorDialog` component
- [ ] Add retry logic with exponential backoff
- [ ] Add "Discard Changes" option for failed operations
- [ ] Show toast notifications for sync events

### Phase 4: Testing
- [ ] Enable all E2E offline tests (7 tests in `offline-workflows.spec.ts`)
- [ ] Enable multi-tab conflict tests (7 tests in `multi-tab-conflicts.spec.ts`)
- [ ] Test offline create, update, delete, toggle
- [ ] Test conflict resolution (use_server, use_local)
- [ ] Test interrupted sync recovery
- [ ] Test error handling and retry logic

---

## Files to Modify

### New Files
```
client/src/hooks/useOfflineManager.ts
client/src/hooks/useDataSync.ts
client/src/services/offline/queueProcessor.ts
client/src/services/offline/conflictResolver.ts
client/src/components/Common/OfflineIndicator.tsx
client/src/components/Common/ConflictDialog.tsx
client/src/components/Common/SyncErrorDialog.tsx
```

### Files to Modify
```
client/src/hooks/useItems.ts          - Refactor mutations to use queue
client/src/hooks/useLists.ts          - Refactor mutations to use queue
client/src/components/Layout/MainLayout.tsx - Add OfflineIndicator
client/src/App.tsx                    - Initialize QueueProcessor
```

---

## Expected Behavior After Implementation

### Offline Mode
1. User goes offline
2. User creates/updates/deletes items
3. Changes are **immediately visible** (optimistic update)
4. Items show "pending sync" indicator (yellow badge)
5. Operations queued in IndexedDB

### Coming Online
1. User reconnects to internet
2. Background processor starts syncing queue
3. Offline indicator shows "Syncing X changes..."
4. Each operation processes:
   - ✅ Success → Remove from queue, update with server data
   - ⚠️ Conflict → Show ConflictDialog
   - ❌ Error → Retry with backoff, show error if max retries

### Conflict Resolution
1. User sees ConflictDialog with side-by-side comparison
2. Options:
   - **Use Server Version**: Discard local changes, accept server data
   - **Keep My Changes**: Force update server with local data
   - **Cancel**: Leave in queue, resolve later

### Multi-Tab Scenario
1. Tab 1: Edit item "Buy Milk" → "Buy Oat Milk"
2. Tab 2: Edit same item → "Buy Almond Milk"
3. Tab 2 tries to save → Server rejects (version conflict)
4. ConflictDialog shows:
   - Local: "Buy Almond Milk" (v1)
   - Server: "Buy Oat Milk" (v2)
5. User chooses which to keep

---

## Testing the Implementation

Once implemented, all 14 currently skipped E2E tests should pass:

### Offline Workflows (7 tests)
- ✅ Create items offline and sync when back online
- ✅ Update item offline and sync on reconnect
- ✅ Handle interrupted sync gracefully
- ✅ Toggle item completion offline
- ✅ Delete item offline and sync
- ✅ Handle rapid offline/online toggling
- ✅ Show offline indicator when disconnected

### Multi-Tab Conflicts (7 tests)
- ✅ Detect version conflict when editing same item in two tabs
- ✅ Resolve conflict with "use_server" strategy
- ✅ Resolve conflict with "use_local" strategy
- ✅ Handle delete conflict (item deleted in another tab)
- ✅ Handle concurrent reorder operations
- ✅ Cross-tab sync behavior (no BroadcastChannel)
- ✅ Handle bulk complete in one tab while editing in another

---

## Summary

**Current Problem**: Offline infrastructure exists but isn't used. Mutations make direct API calls.

**Solution**: Wire up the sync queue to all mutations, add optimistic updates, implement background sync processor, and create conflict resolution UI.

**Result**: True offline-first app where users can work without internet, changes sync automatically when reconnected, and conflicts are resolved through user choice.
