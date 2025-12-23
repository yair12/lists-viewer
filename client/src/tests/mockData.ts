import { List, Item, User } from '../types'

export const mockUser: User = {
  id: 'test-user-1',
  name: 'Test User',
  email: 'test@example.com',
  iconId: 'avatar1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

export const mockLists: List[] = [
  {
    id: 'list-1',
    name: 'Groceries',
    color: '#FF5722',
    iconId: 'avatar2',
    createdBy: 'test-user-1',
    itemCount: 3,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T10:00:00Z',
    version: 1,
  },
  {
    id: 'list-2',
    name: 'Work Tasks',
    color: '#2196F3',
    iconId: 'avatar3',
    createdBy: 'test-user-1',
    itemCount: 2,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T10:00:00Z',
    version: 1,
  },
]

export const mockItems: Item[] = [
  {
    id: 'item-1',
    listId: 'list-1',
    name: 'Milk',
    completed: false,
    quantity: 2,
    quantityType: 'liters',
    order: 0,
    type: 'regular',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T10:00:00Z',
    version: 1,
  },
  {
    id: 'item-2',
    listId: 'list-1',
    name: 'Bread',
    completed: false,
    quantity: 1,
    quantityType: 'pieces',
    order: 1,
    type: 'regular',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T10:00:00Z',
    version: 1,
  },
  {
    id: 'item-3',
    listId: 'list-1',
    name: 'Eggs',
    completed: true,
    quantity: 12,
    quantityType: 'pieces',
    order: 2,
    type: 'regular',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T12:00:00Z',
    version: 2,
  },
]

export const mockSyncQueueItem = {
  id: 'sync-1',
  timestamp: '2025-01-01T10:00:00Z',
  operationType: 'UPDATE' as const,
  resourceType: 'ITEM' as const,
  resourceId: 'item-1',
  parentId: 'list-1',
  payload: {
    name: 'Milk Updated',
    completed: false,
    quantity: 2,
    quantityType: 'liters',
    version: 1,
  },
  version: 1,
  retryCount: 0,
  status: 'PENDING' as const,
}

export const mockConflict = {
  id: 'conflict-1',
  timestamp: '2025-01-01T12:00:00Z',
  resourceType: 'ITEM' as const,
  resourceId: 'item-1',
  conflictType: 'version_mismatch' as const,
  localData: mockItems[0],
  serverData: { ...mockItems[0], name: 'Milk - Server Version', version: 2 },
  operation: {
    id: 'sync-1',
    timestamp: '2025-01-01T10:00:00Z',
    operationType: 'UPDATE' as const,
    resourceType: 'ITEM' as const,
    resourceId: 'item-1',
    parentId: 'list-1',
    payload: {
      name: 'Milk - Local Version',
      version: 1,
    },
    version: 1,
    retryCount: 3,
    status: 'FAILED' as const,
  },
}
