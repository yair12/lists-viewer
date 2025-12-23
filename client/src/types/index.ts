// Core data models matching the backend API

export interface List {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  itemCount: number;
  completedItemCount: number;
  archived?: boolean;
  pending?: boolean; // Indicates item is pending sync
}

export interface Item {
  id: string;
  listId: string;
  type: 'item' | 'list';
  name: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  order: number;
  quantity?: number;
  quantityType?: string;
  userIconId: string;
  archived?: boolean;
  pending?: boolean; // Indicates item is pending sync
  
  // For nested lists (type="list")
  description?: string;
  itemCount?: number;
  completedItemCount?: number;
}

export interface User {
  id: string;
  username: string;
  iconId: string;
  color?: string;
  createdAt: string;
  lastActivity: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
}

export interface Icon {
  id: string;
  name: string;
  url: string;
}

// API Request/Response types
export interface CreateListRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateListRequest {
  name: string;
  description?: string;
  color?: string;
  version: number;
}

export interface CreateItemRequest {
  type: 'item' | 'list';
  name: string;
  quantity?: number;
  quantityType?: string;
  userIconId?: string;
  description?: string; // For nested lists
  order?: number; // For specifying initial order
}

export interface UpdateItemRequest {
  name: string;
  completed?: boolean;
  quantity?: number;
  quantityType?: string;
  order?: number;
  version: number;
  description?: string; // For nested lists
}

export interface ReorderItem {
  id: string;
  order: number;
}

export interface ReorderItemsRequest {
  items: ReorderItem[];
}

export interface BulkCompleteRequest {
  itemIds: string[];
}

export interface BulkDeleteRequest {
  itemIds: string[];
}

export interface MoveItemRequest {
  targetListId: string;
  order: number;
  version: number;
}

export interface InitUserRequest {
  username: string;
  iconId: string;
}

// API Response wrappers
export interface ListsResponse {
  data: List[];
}

export interface ItemsResponse {
  data: Item[];
}

export interface IconsResponse {
  data: Icon[];
}

export interface BulkCompleteResponse {
  completedCount: number;
  data: Item[];
}

export interface BulkDeleteResponse {
  deletedCount: number;
}

// API Error response
export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  current?: List | Item; // For version conflicts
  reason?: string;
}

// UI State types
export interface AppState {
  currentListId: string | null;
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  user: User | null;
}
