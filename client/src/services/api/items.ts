import apiClient from './client';
import type {
  Item,
  CreateItemRequest,
  UpdateItemRequest,
  ItemsResponse,
  ReorderItemsRequest,
  BulkCompleteResponse,
  BulkDeleteResponse,
  MoveItemRequest,
} from '../../types';

export const itemsApi = {
  // Get all items in a list
  getByListId: async (listId: string, includeArchived = false): Promise<Item[]> => {
    const response = await apiClient.get<ItemsResponse>(
      `/lists/${listId}/items`,
      { params: { includeArchived } }
    );
    return response.data.data;
  },

  // Get single item
  getById: async (listId: string, itemId: string): Promise<Item> => {
    const response = await apiClient.get<Item>(`/lists/${listId}/items/${itemId}`);
    return response.data;
  },

  // Create new item
  create: async (listId: string, data: CreateItemRequest): Promise<Item> => {
    const response = await apiClient.post<Item>(`/lists/${listId}/items`, data);
    return response.data;
  },

  // Update item
  update: async (listId: string, itemId: string, data: UpdateItemRequest): Promise<Item> => {
    const response = await apiClient.put<Item>(`/lists/${listId}/items/${itemId}`, data);
    return response.data;
  },

  // Delete item
  delete: async (listId: string, itemId: string, version: number): Promise<void> => {
    await apiClient.delete(`/lists/${listId}/items/${itemId}`, {
      data: { version },
    });
  },

  // Reorder items
  reorder: async (listId: string, data: ReorderItemsRequest): Promise<Item[]> => {
    const response = await apiClient.patch<ItemsResponse>(
      `/lists/${listId}/items/reorder`,
      data
    );
    return response.data.data;
  },

  // Bulk complete items
  bulkComplete: async (listId: string, itemIds: string[]): Promise<BulkCompleteResponse> => {
    const response = await apiClient.patch<BulkCompleteResponse>(
      `/lists/${listId}/items/complete`,
      { itemIds }
    );
    return response.data;
  },

  // Bulk delete items
  bulkDelete: async (listId: string, itemIds: string[]): Promise<BulkDeleteResponse> => {
    const response = await apiClient.delete<BulkDeleteResponse>(
      `/lists/${listId}/items`,
      { data: { itemIds } }
    );
    return response.data;
  },

  // Delete completed items
  deleteCompleted: async (listId: string): Promise<BulkDeleteResponse> => {
    const response = await apiClient.delete<BulkDeleteResponse>(
      `/lists/${listId}/items/completed`
    );
    return response.data;
  },

  // Move item to another list
  move: async (sourceListId: string, itemId: string, data: MoveItemRequest): Promise<Item> => {
    const response = await apiClient.patch<Item>(
      `/lists/${sourceListId}/items/${itemId}/move`,
      data
    );
    return response.data;
  },
};

export default itemsApi;
