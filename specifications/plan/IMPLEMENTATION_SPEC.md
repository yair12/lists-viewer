# Lists Viewer - Implementation Specification

**Project:** Lists Viewer (Todo/Checklist Application)  
**Date Created:** December 22, 2025  
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Data Models](#data-models)
5. [API Specification](#api-specification)
6. [Client Architecture](#client-architecture)
7. [Implementation Phases](#implementation-phases)
8. [Deployment Strategy](#deployment-strategy)
9. [Non-Functional Requirements](#non-functional-requirements)

---

## Executive Summary

Lists Viewer is a Progressive Web App (PWA) designed to provide a cross-platform todo/checklist management solution. The application supports:

- **Hierarchical List Management**: Create, read, update, and delete lists with up to 2 levels of nesting (lists can contain lists as categories)
- **Item Management**: Full CRUD operations on list items with rich metadata
- **Offline Capabilities**: Complete offline support with sync queue mechanism
- **Collaborative Features**: Multi-user editing with optimistic locking conflict resolution
- **Native-like Experience**: Installable PWA with dark theme and smooth animations
- **Cross-platform**: Browser-based with responsive design for desktop, tablet, and mobile

The architecture follows a modern client-server model with a Go backend (REST API + static file serving) and a React-based PWA frontend with offline-first data persistence.

---

## Technology Stack

### Backend (Server)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Language** | Go (Golang) | 1.21+ | High-performance, concurrent API server |
| **Database** | MongoDB | 5.0+ | Document-based data persistence |
| **API Framework** | Gin-Gonic | Latest | REST API routing and middleware |
| **API Spec** | OpenAPI 3.0 | Latest | API contract and code generation |
| **Code Generation** | go-swagger / oapi-codegen | Latest | OpenAPI to Go code generation |
| **Container** | Docker | 24.0+ | Application containerization |
| **Orchestration** | Kubernetes + Helm | Latest | Deployment orchestration |
| **Package Manager** | Go Modules | Built-in | Dependency management |
| **Monitoring** | Prometheus (optional) | Latest | Metrics collection |

### Frontend (Client)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Language** | TypeScript | 5.0+ | Type-safe JavaScript development |
| **Framework** | React | 18.0+ | UI component library |
| **Build Tool** | Vite | 5.0+ | Fast development server and bundler |
| **State Management** | TanStack Query (React Query) | 5.0+ | Server state management and sync |
| **Local Storage** | IndexedDB + sqlite3 (sql.js) | Latest | Offline data persistence |
| **Offline Library** | Workbox | Latest | Service Worker management for PWA |
| **UI Library** | Material-UI (MUI) v5 | 5.0+ | Component library with dark theme |
| **Package Manager** | npm / pnpm | Latest | Dependency management |
| **Testing** | Vitest + React Testing Library | Latest | Unit and component testing |
| **HTTP Client** | Axios | Latest | API communication |
| **Drag & Drop** | React Beautiful DnD | Latest | List and item reordering |

### Development Tools

| Tool | Purpose |
|------|---------|
| Git | Version control |
| Docker Compose | Local development environment |
| Postman / Insomnia | API testing |
| VS Code | Development IDE |
| ESLint + Prettier | Code quality and formatting |

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (Browser)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         React PWA Application (TypeScript)           │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │         UI Layer (MUI Components)               │ │   │
│  │  │  - ListsView, ItemsView, EditDialog, etc.      │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │      State Management (TanStack Query)          │ │   │
│  │  │  - Server state caching and synchronization     │ │   │
│  │  │  - Offline queue management                     │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │    Local Storage Layer (IndexedDB)               │ │   │
│  │  │  - Lists and items cache                        │ │   │
│  │  │  - Sync queue (pending operations)              │ │   │
│  │  │  - User preferences and cache                   │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │    Service Worker (PWA Support)                 │ │   │
│  │  │  - Offline request interception                 │ │   │
│  │  │  - Cache strategies                             │ │   │
│  │  │  - Background sync (pending operations)         │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│              HTTP/WebSocket Connection                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────────────────┐  ┌─────▼─────────────────────┐
│   Server (Golang + Gin)     │  │  MongoDB Replica Set      │
│                             │  │  - Lists Collection       │
│ ┌─────────────────────────┐ │  │  - Items Collection       │
│ │  Static File Server     │ │  │  - Change Log (optional)  │
│ │  - index.html           │ │  │                           │
│ │  - JS bundles           │ │  └─────────────────────────┘
│ │  - CSS                  │ │
│ │  - Images               │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │   REST API Routes       │ │
│ │  /api/v1/lists/*        │ │
│ │  /api/v1/items/*        │ │
│ │  /api/v1/health         │ │
│ │  /api/v1/users/*        │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │   Middleware            │ │
│ │  - Auth (username)      │ │
│ │  - CORS                 │ │
│ │  - Logging              │ │
│ │  - Error Handling       │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Deployment Architecture

```
┌─────────────────────────────────────────────┐
│       Kubernetes Cluster (k8s)              │
│  ┌───────────────────────────────────────┐  │
│  │      Helm Release: lists-viewer       │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │   Pod: Backend Service          │  │  │
│  │  │  - Go application container     │  │  │
│  │  │  - Port 8080                    │  │  │
│  │  │  - Health check probes          │  │  │
│  │  │  - Replicas: 2-3                │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │   Service: Backend API           │  │  │
│  │  │  - ClusterIP/LoadBalancer        │  │  │
│  │  │  - Port 8080                     │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │   ConfigMap: App Config          │  │  │
│  │  │   Secret: DB Credentials         │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │   MongoDB (Pre-deployed)              │  │
│  │  - Assumed external cluster           │  │
│  │  - Connection via Secret              │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘

┌──────────────────────────────┐
│   Docker Registry             │
│  - Dev image (local build)    │
│  - Prod image (ARM for RPi4)  │
│  - Multi-stage Dockerfile     │
└──────────────────────────────┘
```

---

## Data Models

### Important: Hierarchical List Structure

Lists support 2-level nesting via a unified item model:
- **Root Lists**: Top-level lists (stored in lists collection)
- **Nested Lists as Items**: A nested list is an item with `type: "list"` stored in items collection inside a root list
- **Maximum depth**: 2 levels - items of type "list" cannot contain other list items

This allows for category grouping. Nested list items have their own items collection for their children.

### List Model

```typescript
{
  _id: ObjectId,              // MongoDB ID
  id: string,                 // UUID (application level)
  name: string,               // List name (required)
  description: string,        // Short description (optional)
  createdAt: DateTime,        // Created timestamp
  updatedAt: DateTime,        // Last updated timestamp
  createdBy: string,          // Username of creator
  updatedBy: string,          // Username of last updater
  version: number,            // Version for optimistic locking
  userId: string,             // Owner/creator ID (username)
  archived: boolean,          // Soft delete flag (optional)
  itemCount: number,          // Denormalized count of regular items only
  completedItemCount: number  // Denormalized count of completed items only
}
```

### Item Model

```typescript
{
  _id: ObjectId,              // MongoDB ID
  id: string,                 // UUID (application level)
  listId: string,             // Parent list ID
  type: string,               // "item" or "list" (for nested lists)
  name: string,               // Item/List name (required)
  completed: boolean,         // Completion status (only for type="item")
  createdAt: DateTime,        // Created timestamp
  updatedAt: DateTime,        // Last updated timestamp
  createdBy: string,          // Username of creator
  updatedBy: string,          // Username of last updater
  version: number,            // Version for optimistic locking
  order: number,              // Order in parent list (for sorting)
  quantity: number,           // Optional quantity (only for type="item")
  quantityType: string,       // Unit: "kg", "gr", "liters", "ml", "pieces", etc. (only for type="item")
  userIconId: string,         // Icon ID of last updater
  archived: boolean,          // Soft delete flag (optional)
  syncStatus: string,         // LOCAL (draft), SYNCED, PENDING, CONFLICT
  
  // For nested lists (type="list"):
  description: string,        // Short description (optional, for nested lists)
  itemCount: number,          // Denormalized count of items in nested list
  completedItemCount: number  // Denormalized count of completed items in nested list
}
```

**Storage Note**: 
- Regular items are stored: `lists[listId].items[]`
- Nested list items are stored: `lists[parentListId].items[]` with `type: "list"`
- Items within a nested list are stored: `lists[parentListId].items[nestedListId].items[]`

### User/Icon Model

```typescript
{
  _id: ObjectId,              // MongoDB ID
  id: string,                 // UUID (application level)
  username: string,           // User nickname (unique)
  iconId: string,             // Associated icon ID
  color: string,              // Color associated with user (optional)
  createdAt: DateTime,        // First login/registration
  lastActivity: DateTime,     // Last activity timestamp
  preferences: {              // User preferences
    theme: "light" | "dark",
    language: string
  }
}
```

### Sync Queue Item (Local Storage)

```typescript
{
  id: string,                 // UUID
  timestamp: DateTime,        // When operation was created
  operationType: string,      // "CREATE", "UPDATE", "DELETE"
  resourceType: string,       // "LIST", "ITEM"
  resourceId: string,         // Target resource ID
  parentId: string,           // Parent ID (for items)
  payload: object,            // Full object data
  version: number,            // Version for conflict detection
  retryCount: number,         // Retry attempts
  status: string              // "PENDING", "FAILED", "SYNCED"
}
```

---

## API Specification

### Authentication & Authorization

- **No OAuth/Identity Provider**: Username-based identification
- **Username**: Cached locally, sent with each request via header `X-User-Id`
- **Scope**: Single-user assumption (no role-based access control)

### Base URL

```
/api/v1
```

### Health Check Endpoints

#### Health - Readiness Probe
```
GET /health/ready
Response: 200 OK
{
  "status": "ready",
  "database": "connected"
}

Response: 503 Service Unavailable
{
  "status": "not_ready",
  "database": "disconnected"
}
```

#### Health - Liveness Probe
```
GET /health/live
Response: 200 OK
{
  "status": "alive"
}
```

### List Endpoints

#### Get All Lists
```
GET /lists
Headers: X-User-Id: <username>
Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Grocery List",
      "description": "Weekly shopping",
      "createdAt": "2025-12-22T10:00:00Z",
      "updatedAt": "2025-12-22T10:00:00Z",
      "createdBy": "user1",
      "updatedBy": "user1",
      "version": 1,
      "itemCount": 15,
      "completedItemCount": 3
    }
  ]
}
```

#### Create List
```
POST /lists
Headers: X-User-Id: <username>
Body:
{
  "name": "Grocery List",
  "description": "Weekly shopping"
}
Response: 201 Created
{
  "id": "uuid",                          // Generated by server
  "name": "Grocery List",
  "description": "Weekly shopping",
  "createdAt": "2025-12-22T10:00:00Z",
  "updatedAt": "2025-12-22T10:00:00Z",
  "createdBy": "user1",
  "updatedBy": "user1",
  "version": 1
}
```

#### Get List by ID
```
GET /lists/{id}
Headers: X-User-Id: <username>
Response: 200 OK
{
  "id": "uuid",
  "name": "Grocery List",
  ...
}
Response: 404 Not Found
```

#### Update List
```
PUT /lists/{id}
Headers: X-User-Id: <username>
Body:
{
  "name": "Grocery List Updated",
  "description": "Weekly shopping",
  "version": 1
}
Response: 200 OK
{
  "id": "uuid",
  "name": "Grocery List Updated",
  ...
}
Response: 409 Conflict (version mismatch)
{
  "error": "version_conflict",
  "message": "List was updated by another user",
  "current": { ... }
}
```

#### Delete List
```
DELETE /lists/{id}
Headers: X-User-Id: <username>
Body:
{
  "version": 1
}
Response: 204 No Content
Response: 404 Not Found
Response: 409 Conflict (version mismatch)
```

### Item Endpoints

#### Get Items by List
```
GET /lists/{listId}/items
Headers: X-User-Id: <username>
Query: ?includeArchived=false&sort=order
Response: 200 OK
{
  "data": [
    // Regular items (type="item")
    {
      "id": "uuid",
      "listId": "uuid",
      "type": "item",
      "name": "Milk",
      "completed": false,
      "createdAt": "2025-12-22T10:00:00Z",
      "updatedAt": "2025-12-22T10:00:00Z",
      "createdBy": "user1",
      "updatedBy": "user1",
      "version": 1,
      "order": 1,
      "quantity": 2,
      "quantityType": "liters",
      "userIconId": "icon1"
    },
    // Nested list item (type="list")
    {
      "id": "uuid",
      "listId": "uuid",
      "type": "list",            // Indicates this is a nested list
      "name": "Organic Items",
      "description": "Organic products",
      "order": 2,
      "itemCount": 5,
      "completedItemCount": 1,
      "createdAt": "2025-12-22T10:00:00Z",
      "updatedAt": "2025-12-22T10:00:00Z",
      "createdBy": "user1",
      "updatedBy": "user1",
      "version": 1,
      "userIconId": "icon1"
    }
  ]
}
```

#### Create Item
```
POST /lists/{listId}/items
Headers: X-User-Id: <username>
Body (regular item):
{
  "type": "item",
  "name": "Milk",
  "quantity": 2,
  "quantityType": "liters",
  "userIconId": "icon1"
}
Body (nested list):
{
  "type": "list",
  "name": "Organic Items",
  "description": "Organic products"
}
Response: 201 Created
{
  "id": "uuid",                          // Generated by server
  "listId": "uuid",
  "type": "item" or "list",
  "name": "Milk",
  "completed": false,
  "version": 1,
  "order": 10,
  "createdAt": "2025-12-22T10:00:00Z",
  "updatedAt": "2025-12-22T10:00:00Z",
  "createdBy": "user1",
  "updatedBy": "user1",
  ...
}
```

#### Update Item
```
PUT /lists/{listId}/items/{itemId}
Headers: X-User-Id: <username>
Body (regular item):
{
  "name": "Milk (2L)",
  "completed": false,
  "quantity": 2,
  "quantityType": "liters",
  "order": 5,
  "version": 1
}
Body (nested list):
{
  "name": "Organic Items Updated",
  "description": "All organic products",
  "order": 3,
  "version": 1
}
Response: 200 OK
{
  "id": "uuid",
  "name": "Milk (2L)",
  "order": 5,
  ...
}
Response: 409 Conflict (version mismatch)
{
  "error": "version_conflict",
  "message": "Item was updated by another user",
  "current": { ... },
  "reason": "item_completed" | "item_deleted" | "item_modified"
}
```

#### Delete Item
```
DELETE /lists/{listId}/items/{itemId}
Headers: X-User-Id: <username>
Body:
{
  "version": 1
}
Response: 204 No Content
Response: 409 Conflict (version mismatch)
```

#### Reorder Items
```
PATCH /lists/{listId}/items/reorder
Headers: X-User-Id: <username>
Body:
{
  "items": [
    { "id": "uuid1", "order": 1 },
    { "id": "uuid2", "order": 2 },
    { "id": "uuid3", "order": 3 }
  ]
}
Response: 200 OK
{
  "data": [ { "id": "uuid1", "order": 1 }, ... ]
}
```

#### Bulk Complete Items
```
PATCH /lists/{listId}/items/complete
Headers: X-User-Id: <username>
Body:
{
  "itemIds": ["uuid1", "uuid2", "uuid3"]
}
Response: 200 OK
{
  "completedCount": 3,
  "data": [ { "id": "uuid1", "completed": true, "version": 2 }, ... ]
}
```

#### Bulk Delete Items
```
DELETE /lists/{listId}/items
Headers: X-User-Id: <username>
Body:
{
  "itemIds": ["uuid1", "uuid2", "uuid3"]
}
Response: 200 OK
{
  "deletedCount": 3
}
```

#### Move Item Between Lists
```
PATCH /lists/{sourceListId}/items/{itemId}/move
Headers: X-User-Id: <username>
Body:
{
  "targetListId": "uuid",          // Target root list or nested list item ID
  "version": 1,
  "order": 5
}
Response: 200 OK
{
  "id": "uuid",
  "listId": "target-uuid",
  "order": 5,
  ...
}
```

Note: This endpoint supports moving items:
- From root list to another root list
- From root list to nested list (targetListId is the nested list item ID)
- From nested list to root list (sourceListId is the nested list item ID)
- From nested list to another nested list (both sourceListId and targetListId are item IDs with type="list")

#### Delete Completed Items
```
DELETE /lists/{listId}/items/completed
Headers: X-User-Id: <username>
Response: 200 OK
{
  "deletedCount": 5
}
```

#### Reorder Nested List Items
```
PATCH /lists/{listId}/items/{nestedListItemId}/items/reorder
Headers: X-User-Id: <username>
Body:
{
  "items": [
    { "id": "uuid1", "order": 1 },
    { "id": "uuid2", "order": 2 }
  ]
}
Response: 200 OK
{
  "data": [ { "id": "uuid1", "order": 1 }, ... ]
}
```

Note: To access items within a nested list, use the path `/lists/{rootListId}/items/{nestedListItemId}/items/*` where `nestedListItemId` is the ID of the item with `type: "list"`.

### Icon/User Endpoints

#### Get Available Icons
```
GET /icons
Headers: X-User-Id: <username>
Response: 200 OK
{
  "data": [
    {
      "id": "icon1",
      "name": "Avatar 1",
      "url": "/icons/avatar1.png"
    },
    ...
  ]
}
```

#### Get or Create User
```
POST /users/init
Body:
{
  "username": "user1",
  "iconId": "icon1"
}
Response: 200 OK | 201 Created
{
  "id": "uuid",                          // Generated by server
  "username": "user1",
  "iconId": "icon1",
  "color": "#FF5733"
}
```

### Error Responses

All error responses follow this format:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": {}
}
```

Common error codes:
- `validation_error` - Request validation failed
- `version_conflict` - Optimistic lock conflict
- `not_found` - Resource not found
- `unauthorized` - Missing/invalid user ID
- `internal_error` - Server error

---

## Client Architecture

### Project Structure

```
lists-viewer/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── Lists/
│   │   │   │   ├── ListsPanel.tsx
│   │   │   │   ├── ListItem.tsx
│   │   │   │   └── CreateListDialog.tsx
│   │   │   ├── Items/
│   │   │   │   ├── ItemsList.tsx
│   │   │   │   ├── ItemRow.tsx
│   │   │   │   ├── EditItemDialog.tsx
│   │   │   │   ├── CreateItemDialog.tsx
│   │   │   │   └── ItemsSkeleton.tsx
│   │   │   └── Common/
│   │   │       ├── SyncIndicator.tsx
│   │   │       ├── ConfirmDialog.tsx
│   │   │       └── ErrorSnackbar.tsx
│   │   ├── hooks/
│   │   │   ├── useList.ts
│   │   │   ├── useItems.ts
│   │   │   ├── useOfflineSync.ts
│   │   │   ├── useLocalStorage.ts
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   ├── api/
│   │   │   │   ├── client.ts
│   │   │   │   ├── lists.ts
│   │   │   │   ├── items.ts
│   │   │   │   └── icons.ts
│   │   │   ├── storage/
│   │   │   │   ├── indexedDB.ts
│   │   │   │   ├── syncQueue.ts
│   │   │   │   └── cacheManager.ts
│   │   │   └── offline/
│   │   │       ├── conflictResolver.ts
│   │   │       ├── syncManager.ts
│   │   │       └── networkStatus.ts
│   │   ├── store/
│   │   │   ├── slices/
│   │   │   │   ├── listsSlice.ts
│   │   │   │   ├── itemsSlice.ts
│   │   │   │   ├── uiSlice.ts
│   │   │   │   └── syncSlice.ts
│   │   │   └── store.ts
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   ├── api.ts
│   │   │   ├── models.ts
│   │   │   └── errors.ts
│   │   ├── utils/
│   │   │   ├── constants.ts
│   │   │   ├── formatters.ts
│   │   │   ├── validators.ts
│   │   │   └── helpers.ts
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── OnBoarding.tsx
│   │   │   └── NotFound.tsx
│   │   ├── styles/
│   │   │   ├── theme.ts
│   │   │   └── global.css
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── public/
│   │   ├── icons/
│   │   │   ├── avatar1.png
│   │   │   ├── avatar2.png
│   │   │   └── ...
│   │   ├── manifest.json
│   │   ├── sw.js (Service Worker)
│   │   └── favicon.ico
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md
│
├── server/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── api/
│   │   │   ├── handler/
│   │   │   │   ├── health.go
│   │   │   │   ├── lists.go
│   │   │   │   ├── items.go
│   │   │   │   ├── icons.go
│   │   │   │   └── users.go
│   │   │   ├── router.go
│   │   │   ├── middleware.go
│   │   │   └── errors.go
│   │   ├── models/
│   │   │   ├── list.go
│   │   │   ├── item.go
│   │   │   ├── user.go
│   │   │   └── errors.go
│   │   ├── repository/
│   │   │   ├── interface.go
│   │   │   ├── list_repo.go
│   │   │   ├── item_repo.go
│   │   │   └── user_repo.go
│   │   ├── service/
│   │   │   ├── list_service.go
│   │   │   ├── item_service.go
│   │   │   └── user_service.go
│   │   ├── database/
│   │   │   ├── mongodb.go
│   │   │   └── migrations.go
│   │   └── config/
│   │       └── config.go
│   ├── openapi.yaml
│   ├── Dockerfile
│   ├── Dockerfile.arm64 (for RPi)
│   ├── go.mod
│   ├── go.sum
│   ├── .dockerignore
│   └── README.md
│
├── helm/
│   └── lists-viewer/
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── values-dev.yaml
│       ├── values-prod.yaml
│       ├── templates/
│       │   ├── deployment.yaml
│       │   ├── service.yaml
│       │   ├── configmap.yaml
│       │   ├── secret.yaml
│       │   ├── ingress.yaml (optional)
│       │   ├── hpa.yaml (auto-scaling)
│       │   └── pdb.yaml (pod disruption budget)
│       └── README.md
│
├── docker-compose.yml
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

### State Management Flow

```
User Action → React Component
    ↓
TanStack Query Hook (useQuery/useMutation)
    ↓
API Service Layer
    ↓
Network Status Check
    ├─ Online: Send to Backend
    │  ├─ Success: Update cache, store in IndexedDB
    │  ├─ Conflict: Show conflict resolution UI
    │  └─ Error: Add to sync queue
    │
    └─ Offline: Store in sync queue + IndexedDB
       ↓
Service Worker intercepts requests
    ↓
Serve from cache/offline data
    ↓
UI shows unsync indicator (different color)
    ↓
When online again: Background sync
    ├─ Process queue items sequentially
    ├─ Handle conflicts via conflict resolver
    └─ Update UI with results
```

### Offline-First Data Flow

```
IndexedDB Schema:
├── lists (keyPath: 'id')
├── items (keyPath: 'id', indexes: [listId])
├── syncQueue (keyPath: 'id', indexes: [status, timestamp])
├── cache (keyPath: 'key')
└── user (keyPath: 'userId')

Sync Manager Process:
1. Monitor network status (online/offline)
2. On online event:
   - Get all PENDING items from syncQueue
   - Sort by timestamp (FIFO)
   - For each item:
     a. Execute operation (POST/PUT/DELETE)
     b. If success: mark SYNCED, update cache
     c. If conflict: show UI, wait for user decision
     d. If error: increment retry, keep PENDING
   - Show sync progress to user
3. Retry failed items with exponential backoff
4. Clean up SYNCED items after confirmation
```

---

## Implementation Phases

### Phase 1: Project Setup & Infrastructure (Weeks 1-2)

**Goals**: Establish development environment, project structure, and CI/CD foundation

#### Tasks:
1. **Repository Setup**
   - Initialize Git repository structure
   - Create `.gitignore` for Go, Node.js, and IDE files
   - Set up branch protection rules

2. **Backend Setup**
   - Initialize Go module (`go mod init lists-viewer`)
   - Set up Gin-Gonic framework with basic routing
   - Configure MongoDB connection
   - Create Dockerfile with multi-stage build
   - Create Dockerfile.arm64 for Raspberry Pi 4
   - Set up docker-compose.yml for local development

3. **Frontend Setup**
   - Initialize Vite + React + TypeScript project
   - Install core dependencies (MUI, React Query, Axios, Workbox)
   - Create project structure directories
   - Configure tsconfig.json and build settings
   - Set up PWA manifest and basic service worker

4. **DevOps Setup**
   - Create Helm chart directory structure
   - Set up deployment values for dev/prod
   - Create GitHub Actions CI/CD pipeline (optional)

5. **Documentation**
   - Create project README
   - Document development setup instructions
   - Create CONTRIBUTING.md

**Deliverables**: 
- Working dev environment (docker-compose)
- Basic API server responding to requests
- Basic React app running locally

---

### Phase 2: Backend Core API (Weeks 3-5)

**Goals**: Implement REST API with MongoDB persistence and health checks

#### Tasks:
1. **Database Layer**
   - Implement MongoDB connection pooling
   - Create indexes for collections (lists, items)
   - Write repository layer for lists and items
   - Implement version management for optimistic locking

2. **Health Check Endpoints**
   - Implement `/health/live` endpoint
   - Implement `/health/ready` endpoint with DB check
   - Configure Kubernetes probes

3. **List API Endpoints**
   - `GET /api/v1/lists` - List all root lists
   - `POST /api/v1/lists` - Create root list
   - `GET /api/v1/lists/{id}` - Get single list
   - `PUT /api/v1/lists/{id}` - Update list
   - `DELETE /api/v1/lists/{id}` - Delete list

4. **Item API Endpoints** (both root and nested lists)
   - `GET /api/v1/lists/{listId}/items` - List items in root list
   - `GET /api/v1/lists/{listId}/items/{nestedListItemId}/items` - List items in nested list
   - `POST /api/v1/lists/{listId}/items` - Create item or nested list in root list
   - `POST /api/v1/lists/{listId}/items/{nestedListItemId}/items` - Create item in nested list
   - `GET /api/v1/lists/{listId}/items/{id}` - Get item
   - `PUT /api/v1/lists/{listId}/items/{id}` - Update item
   - `DELETE /api/v1/lists/{listId}/items/{id}` - Delete item
   - `PATCH /api/v1/lists/{listId}/items/reorder` - Reorder items in list
   - `PATCH /api/v1/lists/{listId}/items/complete` - Bulk complete items
   - `DELETE /api/v1/lists/{listId}/items` - Bulk delete items
   - `PATCH /api/v1/lists/{listId}/items/{nestedListItemId}/items/reorder` - Reorder items in nested list
   - `PATCH /api/v1/lists/{sourceListId}/items/{id}/move` - Move item between lists
   - `DELETE /api/v1/lists/{listId}/items/completed` - Delete all completed items

5. **User/Icon Endpoints**
   - `GET /api/v1/icons` - List available icons
   - `POST /api/v1/users/init` - Initialize/get user

6. **Error Handling & Validation**
   - Implement request validation middleware
   - Implement error response standardization
   - Handle version conflicts with appropriate status codes

7. **Middleware**
   - User identification middleware (X-User-Id header)
   - CORS configuration
   - Request logging
   - Error handling middleware

**Deliverables**:
- Fully functional REST API
- OpenAPI/Swagger documentation
- Postman collection for testing
- MongoDB schema with proper indexes

---

### Phase 3: Frontend Core UI (Weeks 6-8)

**Goals**: Build responsive PWA UI with dark theme and animations

#### Tasks:
1. **Onboarding & Authentication**
   - Create user nickname input screen
   - Icon selection screen
   - Local caching of user preferences

2. **Layout Components**
   - Create main layout with sidebar and main content area
   - Responsive design for desktop/tablet/mobile
   - Dark theme implementation with MUI theming

3. **Lists Management UI**
   - List panel in sidebar showing all root lists
   - Current list indicator
   - Create list dialog (for root lists only)
   - Edit list name/description
   - Delete list with confirmation
   - Nested lists are managed as items within a list with type="list"

4. **Items Management UI**
   - Display items in two sections (open, completed)
   - Create item form (for regular items)
   - Create nested list form (with type="list")
   - Edit item/list dialog with all fields
   - Item row component with checkbox for completion (regular items only)
   - Nested list row component showing name, description, item counts
   - Display user icon (last updated by)
   - Show item metadata (quantity, quantity type, timestamps)

5. **Drag & Drop**
   - Implement drag-and-drop for items within list (using React Beautiful DnD)
   - Implement drag-and-drop for moving items between lists
   - Support dragging both regular items and nested list items
   - Visual feedback during dragging

6. **UI Polish**
   - Add animations for item creation/deletion
   - Loading states and skeletons
   - Empty state messages
   - Proper spacing and typography

**Deliverables**:
- Fully functional UI mockup (works with mock data)
- Responsive design tested on desktop/mobile
- Dark theme implemented
- PWA manifest configured

---

### Phase 4: Offline-First Data Management (Weeks 9-11)

**Goals**: Implement local storage, sync queue, and offline-first capabilities

#### Tasks:
1. **IndexedDB Setup**
   - Create IndexedDB schema for lists, items, cache, syncQueue
   - Implement database initialization
   - Create CRUD operations for each store

2. **API Integration Layer**
   - Create API service with proper error handling
   - Implement axios interceptors for user ID header
   - Create request/response transformers

3. **Local Storage & Caching**
   - Implement local user preference storage
   - Cache lists and items in IndexedDB
   - Implement cache invalidation strategy

4. **Sync Queue Management**
   - Create sync queue data store (IndexedDB)
   - Implement sync queue serialization/deserialization
   - Create sync queue UI indicator

5. **Network Status Management**
   - Implement online/offline status detection
   - Create network status service
   - Display network status in UI

6. **TanStack Query Setup**
   - Configure QueryClient with appropriate defaults
   - Create custom hooks for lists (useList, useLists)
   - Create custom hooks for items (useItems, useItem)
   - Implement optimistic updates for UI responsiveness

**Deliverables**:
- Working offline mode
- Sync queue visible in UI
- Proper caching strategy implemented
- Network status indicator

---

### Phase 5: Offline Sync & Conflict Resolution (Weeks 12-14)

**Goals**: Implement background sync and conflict resolution logic

#### Tasks:
1. **Service Worker Enhancement**
   - Set up service worker with Workbox
   - Implement request interception for offline mode
   - Create cache-first/network-first strategies
   - Implement background sync for pending operations

2. **Sync Manager Implementation**
   - Create background sync processor
   - Implement FIFO processing of sync queue
   - Implement exponential backoff for retries
   - Create progress tracking and reporting

3. **Conflict Resolution**
   - Implement conflict detection (version comparison)
   - Create conflict resolution logic:
     - If deleted: discard local changes
     - If modified differently: show diff UI, let user choose
     - If same name: show de-duplicate dialog
   - Create conflict UI dialogs (show differences)

4. **Retry & Error Handling**
   - Implement retry logic with exponential backoff
   - Handle network timeouts gracefully
   - Implement dead letter queue for failed items
   - Create manual retry UI

5. **Sync Indicators**
   - Show unsync status on items (different color)
   - Show sync progress during background sync
   - Show sync errors with action buttons
   - Show conflict notifications

**Deliverables**:
- Working offline sync
- Conflict resolution dialogs
- Proper retry mechanism
- Sync status indicators in UI

---

### Phase 6: Testing & Documentation (Weeks 15-16)

**Goals**: Ensure code quality and complete documentation

#### Tasks:
1. **Backend Testing**
   - Unit tests for repository layer
   - Unit tests for service layer
   - Integration tests with MongoDB
   - API endpoint tests
   - Test conflict resolution logic

2. **Frontend Testing**
   - Unit tests for utilities and helpers
   - Component tests for UI components
   - Hook tests for custom hooks
   - Integration tests for sync flow
   - E2E tests for critical user flows

3. **Load Testing**
   - Test API with multiple concurrent users
   - Test sync queue with large datasets
   - MongoDB performance tuning

4. **Documentation**
   - API documentation (OpenAPI/Swagger)
   - Frontend architecture documentation
   - Development guide for contributors
   - Deployment guide for Kubernetes
   - User guide for end users

5. **Code Quality**
   - Configure ESLint and Prettier
   - Run code coverage analysis
   - Code reviews and refactoring

**Deliverables**:
- >80% code coverage
- Complete OpenAPI documentation
- Deployment runbook
- User guide

---

### Phase 7: Deployment & Optimization (Weeks 17-18)

**Goals**: Production-ready builds and Kubernetes deployment

#### Tasks:
1. **Docker Image Optimization**
   - Multi-stage Docker builds
   - Image size optimization
   - Security scanning (Trivy)
   - Test image building for Raspberry Pi 4

2. **Helm Chart Finalization**
   - Complete all Helm templates
   - Configure values for dev/prod/pi environments
   - Create init containers if needed
   - Set up proper health checks and resource limits
   - Configure auto-scaling policies

3. **Frontend Build Optimization**
   - Code splitting for better performance
   - Tree-shaking and minification
   - Asset optimization
   - Service worker caching strategies

4. **Production Checklist**
   - Environment configuration (secrets, ConfigMaps)
   - Logging setup
   - Monitoring setup (optional)
   - Backup and disaster recovery plan
   - Security review (CORS, headers, etc.)

5. **Deployment Testing**
   - Test on Kubernetes cluster
   - Test on Raspberry Pi 4
   - Smoke tests after deployment
   - Load testing

**Deliverables**:
- Production-ready Docker images
- Working Helm deployment
- Production deployment runbook
- Performance benchmarks

---

### Phase 8: Polish & Release (Weeks 19-20)

**Goals**: Final touches and production release

#### Tasks:
1. **UX Polish**
   - Refine animations and transitions
   - Optimize performance further
   - A/B test UI variations
   - User feedback incorporation

2. **PWA Optimization**
   - Optimize manifest
   - Test installability on iOS/Android
   - Test offline functionality thoroughly

3. **Release Preparation**
   - Create release notes
   - Create version tags
   - Document known issues and roadmap

4. **Post-Launch Support**
   - Monitor for issues
   - Collect user feedback
   - Plan for enhancements

**Deliverables**:
- Production release v1.0
- Release notes
- User feedback mechanism

---

## Implementation Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1. Setup & Infrastructure | Weeks 1-2 | Dev environment, project structure |
| 2. Backend Core API | Weeks 3-5 | REST API with persistence |
| 3. Frontend Core UI | Weeks 6-8 | Responsive PWA UI |
| 4. Offline Data Management | Weeks 9-11 | IndexedDB, caching, sync queue |
| 5. Offline Sync & Conflicts | Weeks 12-14 | Background sync, conflict resolution |
| 6. Testing & Documentation | Weeks 15-16 | Tests, API docs, guides |
| 7. Deployment & Optimization | Weeks 17-18 | Docker, Helm, production setup |
| 8. Polish & Release | Weeks 19-20 | Final touches, v1.0 release |
| **Total** | **20 weeks** | **Production-ready application** |

---

## Non-Functional Requirements

### Performance

- **API Response Time**: <500ms for 95th percentile
- **Frontend Load Time**: <2s initial load (cached), <1s subsequent loads
- **Sync Time**: Offline changes synced within 5s of coming online
- **List Rendering**: 1000+ items should render smoothly

### Scalability

- **User Concurrency**: Support 100+ concurrent users on single API instance
- **Database**: MongoDB replica set with automatic failover
- **API**: Horizontal scalability with stateless design
- **Frontend**: Efficient caching to minimize server load

### Security

- **HTTPS**: All production communication over HTTPS
- **CORS**: Strict CORS policy for API
- **Headers**: Security headers (CSP, X-Frame-Options, etc.)
- **Input Validation**: All user inputs validated on client and server
- **Data Encryption**: Sensitive data encrypted in transit and at rest

### Reliability

- **Uptime**: 99.5% SLA
- **Database Failover**: Automatic failover with MongoDB replica set
- **Data Backup**: Daily automated backups
- **Error Recovery**: Graceful error handling with user notifications

### Availability

- **Offline Support**: Full functionality in offline mode
- **PWA Installation**: Installable on iOS, Android, and desktop
- **Cross-browser**: Support Chrome, Firefox, Safari, Edge

### Maintainability

- **Code Quality**: Clear, well-commented code following conventions
- **Documentation**: Comprehensive API and code documentation
- **Testing**: >80% code coverage
- **Monitoring**: Health checks and optional metrics collection

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| MongoDB connection failures | Medium | High | Connection pooling, retry logic, fallback to cache |
| Version conflicts in concurrent edits | Medium | Medium | Optimistic locking, clear conflict UI |
| Sync queue overflow | Low | High | Implement queue size limits, cleanup strategies |
| PWA install failures | Low | Medium | Test on real devices, fallback to web app |
| Service Worker bugs | Medium | High | Comprehensive testing, update strategy |
| API rate limiting issues | Low | Low | Implement client-side throttling |

---

## Success Criteria

1. ✅ All required features implemented and tested
2. ✅ Offline-first architecture working seamlessly
3. ✅ Conflict resolution logic handles all scenarios
4. ✅ PWA installable and working on target platforms
5. ✅ Performance benchmarks met (response times, load times)
6. ✅ >80% test coverage
7. ✅ Kubernetes deployment successful
8. ✅ Production deployment on Raspberry Pi 4 successful
9. ✅ User documentation complete
10. ✅ Zero critical bugs at release

---

## Appendix: Technology Decision Rationale

### Why Go for Backend?
- High performance for concurrent requests
- Single binary deployment
- Excellent standard library
- Strong typing and error handling
- Ideal for microservices and containerized deployments

### Why React for Frontend?
- Large ecosystem and community support
- Component reusability
- Strong PWA support with libraries
- Performance optimization tools (React.lazy, code splitting)
- TypeScript support for type safety

### Why TanStack Query?
- Powerful server state management
- Built-in caching and synchronization
- Handles offline scenarios well
- Optimistic updates support
- Excellent developer experience

### Why IndexedDB for Local Storage?
- Larger storage capacity than localStorage
- Indexed queries for efficient searching
- Transaction support
- Better performance for large datasets

### Why MongoDB?
- Document-based, flexible schema
- Easy to add new fields without migrations
- Replica set support for high availability
- Excellent Kubernetes integration

### Why Kubernetes + Helm?
- Industry standard for container orchestration
- Automatic scaling and healing
- Easy rollback and updates
- Environment-agnostic deployment
- Works well on Raspberry Pi 4 with K3s

---

**Document Version**: 1.0  
**Last Updated**: December 22, 2025  
**Next Review**: During Phase 2 kickoff
