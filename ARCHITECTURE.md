# Complete System Architecture - Phases 4 & 5

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                                │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    React Application                             │    │
│  │                                                                   │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │  Components │  │  Custom Hooks│  │    Pages     │           │    │
│  │  │  - Lists    │  │  - useLists  │  │  - Home      │           │    │
│  │  │  - Items    │  │  - useItems  │  │  - ListView  │           │    │
│  │  │  - Dialogs  │  │  - useUser   │  │  - Onboard   │           │    │
│  │  │  - Indicators│  │  - useSync   │  │              │           │    │
│  │  └─────────────┘  └──────────────┘  └──────────────┘           │    │
│  │                                                                   │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │         TanStack Query (State Management)                │   │    │
│  │  │  - Server state caching                                  │   │    │
│  │  │  - Automatic refetching                                  │   │    │
│  │  │  - Optimistic updates                                    │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  │                                                                   │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │              Services Layer                               │   │    │
│  │  │                                                            │   │    │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │    │
│  │  │  │   API        │  │   Storage    │  │   Offline    │   │   │    │
│  │  │  │   - client   │  │   - indexDB  │  │   - network  │   │   │    │
│  │  │  │   - lists    │  │   - syncQ    │  │   - sync     │   │   │    │
│  │  │  │   - items    │  │   - cache    │  │   - conflict │   │   │    │
│  │  │  │   - users    │  │              │  │              │   │   │    │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  IndexedDB (Local Storage)                       │    │
│  │                                                                   │    │
│  │  [lists] [items] [syncQueue] [cache] [user]                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              Service Worker (PWA Support)                        │    │
│  │                                                                   │    │
│  │  - NetworkFirst for API                                          │    │
│  │  - CacheFirst for Assets                                         │    │
│  │  - Offline Fallback                                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                        HTTP/HTTPS (REST)
                                │
┌───────────────────────────────┴───────────────────────────────────────────┐
│                          Server (Go Backend)                               │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                      Gin-Gonic Router                             │    │
│  │                                                                    │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐     │    │
│  │  │  Middleware    │  │   Handlers     │  │   Services    │     │    │
│  │  │  - Auth        │  │  - Lists       │  │  - List Svc   │     │    │
│  │  │  - CORS        │  │  - Items       │  │  - Item Svc   │     │    │
│  │  │  - Logging     │  │  - Users       │  │  - User Svc   │     │    │
│  │  │  - Error       │  │  - Health      │  │  - Health     │     │    │
│  │  └────────────────┘  └────────────────┘  └───────────────┘     │    │
│  │                                                                    │    │
│  │  ┌────────────────────────────────────────────────────────────┐ │    │
│  │  │              Repository Layer                               │ │    │
│  │  │  - List Repository                                          │ │    │
│  │  │  - Item Repository                                          │ │    │
│  │  │  - User Repository                                          │ │    │
│  │  └────────────────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                                │
┌───────────────────────────────┴───────────────────────────────────────────┐
│                       MongoDB Database                                     │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  lists       │  │  items       │  │  users       │                   │
│  │  collection  │  │  collection  │  │  collection  │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└────────────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        User Interaction Flow                              │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │  React Component│
                          │  (e.g. ListView)│
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Custom Hook    │
                          │  (useItems)     │
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌──────────────────┐         ┌──────────────────┐
          │ TanStack Query   │         │ Network Status   │
          │ (react-query)    │         │ Service          │
          └────────┬─────────┘         └────────┬─────────┘
                   │                            │
                   │                    ┌───────┴────────┐
                   │                    │                │
                   │              ┌─────▼──┐      ┌─────▼──┐
                   │              │ Online │      │Offline │
                   │              └───┬────┘      └────┬───┘
                   │                  │                │
           ┌───────┴────────┐         │                │
           │                │         ▼                ▼
     ┌─────▼─────┐   ┌──────▼──────┐   ┌────────────────┐
     │ Cache     │   │ API Service │   │ Sync Queue     │
     │ Manager   │   │ (Axios)     │   │ Manager        │
     └─────┬─────┘   └──────┬──────┘   └────────┬───────┘
           │                │                    │
           │                ▼                    │
           │         ┌──────────────┐            │
           │         │  Backend API │            │
           │         │  (Go Server) │            │
           │         └──────┬───────┘            │
           │                │                    │
           └────────────────┴────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   IndexedDB   │
                    │   Storage     │
                    └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  UI Update    │
                    │  (Re-render)  │
                    └───────────────┘
```

## Sync Manager State Machine

```
┌─────────────┐
│    IDLE     │◄──────────────────────┐
└──────┬──────┘                       │
       │                              │
       │ Network Online               │
       │ + Pending Items              │
       │                              │
       ▼                              │
┌─────────────┐                       │
│   SYNCING   │                       │
└──────┬──────┘                       │
       │                              │
       │ For Each Item                │
       │                              │
       ▼                              │
┌──────────────────────────────────┐  │
│  Process Item:                   │  │
│  1. Mark as SYNCING              │  │
│  2. Execute API Call             │  │
│  3. Handle Result                │  │
└──────┬───────────────────────────┘  │
       │                              │
       │                              │
   ┌───┴──────────┬──────────────┐   │
   │              │              │   │
   ▼              ▼              ▼   │
┌────────┐  ┌──────────┐  ┌─────────┐
│SUCCESS │  │ CONFLICT │  │  ERROR  │
└───┬────┘  └─────┬────┘  └────┬────┘
    │             │             │
    │ Remove      │ Add to      │ Retry
    │ from Q      │ Resolver    │ (Backoff)
    │             │             │
    └─────────────┴─────────────┼────┐
                                │    │
                 ┌──────────────┘    │
                 │                   │
                 │ All Done          │ Continue
                 │                   │
                 └───────────────────┘
```

## Conflict Resolution Flow

```
┌─────────────────┐
│ API Call Failed │
│ Status: 409     │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Extract Conflict    │
│ - Local Version     │
│ - Server Version    │
│ - Error Message     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Add to Conflict     │
│ Resolver Queue      │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Notify UI           │
│ (Show Badge)        │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ User Opens Dialog   │
│ - View Both         │
│ - Compare Diff      │
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Choose Strategy:                    │
│                                     │
│  ┌──────────┐  ┌──────────┐       │
│  │Use Local │  │Use Server│       │
│  └────┬─────┘  └────┬─────┘       │
│       │             │              │
│  ┌────┴─────┐  ┌────┴──────┐      │
│  │  Merge   │  │  Cancel   │      │
│  └────┬─────┘  └────┬──────┘      │
│       │             │              │
└───────┴─────────────┴──────────────┘
        │
        ▼
┌────────────────────┐
│ Apply Resolution   │
│ - Update Cache     │
│ - Update Queue     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Retry Sync         │
└────────────────────┘
```

## IndexedDB Schema

```
Database: lists-viewer-db (version 1)
│
├─ Store: lists
│  ├─ keyPath: 'id'
│  ├─ Indexes:
│  │  ├─ updatedAt (non-unique)
│  │  └─ createdBy (non-unique)
│  └─ Data: List objects
│
├─ Store: items
│  ├─ keyPath: 'id'
│  ├─ Indexes:
│  │  ├─ listId (non-unique)
│  │  ├─ type (non-unique)
│  │  ├─ completed (non-unique)
│  │  ├─ order (non-unique)
│  │  └─ [listId, order] (compound, non-unique)
│  └─ Data: Item objects
│
├─ Store: syncQueue
│  ├─ keyPath: 'id'
│  ├─ Indexes:
│  │  ├─ status (non-unique)
│  │  ├─ timestamp (non-unique)
│  │  └─ [status, timestamp] (compound, non-unique)
│  └─ Data: SyncQueueItem objects
│
├─ Store: cache
│  ├─ keyPath: 'key'
│  └─ Data: Key-value pairs
│
└─ Store: user
   ├─ keyPath: 'id'
   └─ Data: User objects
```

## Service Worker Cache Strategy

```
Request Type          Strategy               Cache Name          TTL
─────────────────────────────────────────────────────────────────────
/api/*               NetworkFirst           api-cache           24h
                     (10s timeout)
                     
*.png, *.jpg, etc.   CacheFirst             image-cache         30d

*.woff, *.ttf, etc.  CacheFirst             font-cache          1y

*.js, *.css          StaleWhileRevalidate   static-resources    7d

/ (navigation)       Cache w/ Fallback      precache            -
```

## Request Flow Comparison

### Online Request

```
Component → Hook → API Service → Axios → Backend → MongoDB
                                                      ↓
Component ← Hook ← Cache ←──────────────── Response ←┘
```

### Offline Request

```
Component → Hook → Sync Queue → IndexedDB
                      ↓
Component ← Hook ← Cache (optimistic) ← IndexedDB
                      ↓
                  [Queued for later]
```

### Sync When Online

```
Network Event → Sync Manager
                    ↓
            Get Pending Items
                    ↓
            For Each: API Call
                    ↓
         ┌──────────┴──────────┐
         │                     │
      Success              Conflict
         │                     │
    Remove from Q      Add to Resolver
         │                     │
    Update Cache         Show Dialog
```

## Technology Stack Summary

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Stack                          │
├─────────────────────────────────────────────────────────────┤
│ Framework         React 18.2+                               │
│ Language          TypeScript 5.0+                           │
│ Build Tool        Vite 5.0+                                 │
│ State Mgmt        TanStack Query 5.0+                       │
│ UI Library        Material-UI 5.14+                         │
│ HTTP Client       Axios 1.6+                                │
│ Routing           React Router 7.11+                        │
│ PWA               Workbox 7.0+                              │
│ Drag & Drop       @hello-pangea/dnd 18.0+                  │
│ Local Storage     IndexedDB (native API)                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Backend Stack                           │
├─────────────────────────────────────────────────────────────┤
│ Language          Go 1.21+                                  │
│ Framework         Gin-Gonic                                 │
│ Database          MongoDB 5.0+                              │
│ Container         Docker 24.0+                              │
│ Orchestration     Kubernetes + Helm                         │
└─────────────────────────────────────────────────────────────┘
```

## Performance Characteristics

```
Operation                    Typical Time    Notes
──────────────────────────────────────────────────────────
IndexedDB Read              < 5ms           From memory
IndexedDB Write             < 10ms          With indexes
API Call (online)           100-500ms       Network dependent
Sync Queue Processing       ~100ms/item     Sequential
Conflict Detection          < 10ms          Per item
UI Re-render               < 16ms          60 FPS target
Cache Lookup               < 5ms           TanStack Query
Service Worker Cache       < 20ms          Disk read
```

## Error Handling Flow

```
Error Occurs
     │
     ▼
Classify Error
     │
     ├─ Network Error ──→ Add to Sync Queue ──→ Optimistic Update
     │
     ├─ 409 Conflict ───→ Add to Resolver ────→ Show Dialog
     │
     ├─ 404 Not Found ──→ Remove from Cache ──→ Update UI
     │
     ├─ 401 Unauthorized → Show Login ─────────→ Clear Session
     │
     └─ 500 Server Error → Retry (backoff) ────→ Show Error
```

---

**This architecture provides:**
- ✅ Complete offline functionality
- ✅ Automatic synchronization
- ✅ Intelligent conflict resolution
- ✅ Progressive Web App capabilities
- ✅ Type-safe implementation
- ✅ Scalable and maintainable code
