# Offline Mode Testing Guide

## Problem
Browser's built-in "offline mode" doesn't properly simulate network failures - it prevents requests from even starting, causing the app to hang indefinitely.

## Solution
A development-only **Offline Toggle Button** has been added to test offline functionality.

## How to Test

### 1. Start the Application
```bash
docker compose up --build -d
```

Navigate to: http://localhost:8080

### 2. Look for the FAB (Floating Action Button)
- In **development mode only**, you'll see a green WiFi icon button in the bottom-right corner
- This button lets you simulate offline mode

### 3. Testing Offline Mode

#### To Go Offline:
1. Click the green WiFi button (bottom-right)
2. Button turns RED with WiFi-OFF icon
3. Red banner appears at top: "DEV MODE: Offline Testing Enabled"
4. Console logs: `[DEV] 🔴 Forced OFFLINE mode for testing`

#### To Go Online:
1. Click the red WiFi-OFF button
2. Button turns GREEN with WiFi icon
3. Banner disappears
4. Console logs: `[DEV] 🟢 Forced ONLINE mode restored`

### 4. Test Scenarios

#### Scenario A: Edit Item While Offline
1. Create a list and add some items (while online)
2. Click the WiFi button to go **offline** (red)
3. Edit an item (change name, quantity, etc.)
4. Click "Save"
5. **Expected behavior:**
   - Item updates immediately in UI (optimistic update)
   - Dialog closes
   - Console shows:
     ```
     [useUpdateItem] ⚠️ Offline detected, skipping API call and using cache
     [useUpdateItem] ✅ Item cached and queued for sync
     ```
   - No API request in Network tab
   - Item stored in IndexedDB
   - Operation added to sync queue

6. Click WiFi button to go **online** (green)
7. **Expected behavior:**
   - Sync manager automatically processes queue
   - API request sent to server
   - Item synced to MongoDB

#### Scenario B: Create Item While Offline
1. Go **offline** (red button)
2. Create a new item
3. **Expected behavior:**
   - Temp item created with ID like `temp-1234567890`
   - Item appears in list immediately
   - Added to sync queue
   - Console: `[useCreateItem] Offline detected, creating temp item`

4. Go **online** (green button)
5. **Expected behavior:**
   - Temp item synced to server
   - Real ID received from server
   - Item updated with real ID

#### Scenario C: Delete Item While Offline
1. Have some items in a list
2. Go **offline**
3. Delete an item
4. **Expected behavior:**
   - Item removed from UI
   - Marked as deleted in cache
   - Delete operation queued
   - Console: `[useDeleteItem] Offline detected, marking deleted`

5. Go **online**
6. Delete operation synced to server

### 5. Verify Sync Queue

#### Check Console
Look for these log patterns:
```
[useUpdateItem] Starting update... { listId: "...", itemId: "...", isOnline: false }
[useUpdateItem] ⚠️ Offline detected, skipping API call and using cache
[useUpdateItem] ✅ Item cached and queued for sync
```

#### Check IndexedDB
1. Open DevTools → Application → IndexedDB → lists-viewer-db
2. Check `syncQueue` store
3. Should see pending operations with:
   - `status: "PENDING"`
   - `operationType: "UPDATE" | "CREATE" | "DELETE"`
   - `timestamp`
   - `payload` with your changes

#### Check Network Tab
1. While **offline** (red): No API requests should appear
2. After going **online** (green): Watch for automatic sync requests

### 6. Advanced Testing

#### Test Conflict Resolution
1. Open app in two browser tabs
2. Go offline in Tab 1
3. Edit same item in both tabs
4. Save in Tab 2 (online) first
5. Save in Tab 1 (offline)
6. Go online in Tab 1
7. Should trigger conflict resolution dialog

#### Test Network Timeout
The API timeout is set to **10 seconds**. If server is slow or unreachable:
- Request will timeout after 10s
- Falls back to offline mode
- Operation queued for retry

## Console Logging

Enhanced logging helps debug:

### Offline Mode
```
[DEV] 🔴 Forced OFFLINE mode for testing
[useUpdateItem] Starting update... { listId: "abc", itemId: "123", isOnline: false }
[useUpdateItem] ⚠️ Offline detected, skipping API call and using cache
[useUpdateItem] ✅ Item cached and queued for sync
```

### Online Mode
```
[DEV] 🟢 Forced ONLINE mode restored
[useUpdateItem] Starting update... { listId: "abc", itemId: "123", isOnline: true }
[useUpdateItem] 🌐 Making API call...
[useUpdateItem] ✅ API call successful
```

### Network Error
```
[useUpdateItem] 🌐 Making API call...
[useUpdateItem] ❌ API call failed
[useUpdateItem] Network error, adding to sync queue
```

## Production vs Development

- **Development**: Offline toggle button visible
- **Production**: Button hidden automatically (checks `import.meta.env.DEV`)

## Alternative Testing Methods

If you need to test without the toggle:

### 1. Chrome DevTools Network Throttling
1. Open DevTools → Network tab
2. Change throttle from "No throttling" to "Offline"
3. ⚠️ **Note**: This still causes hanging issues

### 2. Block API Requests
1. Open DevTools → Network tab
2. Right-click request → "Block request URL"
3. Add pattern: `*/api/*`

### 3. Disconnect WiFi
- Literally turn off WiFi/Ethernet
- Most realistic test
- Inconvenient during development

## Troubleshooting

### Button Not Visible
- Check you're running in development mode
- Verify `import.meta.env.DEV` is true
- Try hard refresh (Ctrl+Shift+R)

### Changes Not Persisting
- Check IndexedDB is initialized
- Look for errors in console
- Verify cache manager is working

### Sync Not Triggering
- Check network status service
- Look for sync manager errors
- Verify sync queue has items

### API Still Being Called When Offline
- Check console for `isOnline: false` in logs
- Verify button actually turned red
- Check network tab for requests
- May need to clear service worker cache

## Files Modified

- `client/src/components/Common/OfflineToggle.tsx` - Toggle component
- `client/src/App.tsx` - Added toggle to app
- `client/src/hooks/useItems.ts` - Enhanced logging + offline detection
- `client/src/hooks/useLists.ts` - Enhanced logging + offline detection
- `client/src/services/api/client.ts` - Reduced timeout to 10s
