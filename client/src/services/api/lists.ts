import apiClient from './client';
import type {
  List,
  CreateListRequest,
  UpdateListRequest,
  ListsResponse,
} from '../../types';

export const listsApi = {
  // Get all lists
  getAll: async (): Promise<List[]> => {
    const response = await apiClient.get<ListsResponse>('/lists');
    return response.data.data;
  },

  // Get single list
  getById: async (id: string): Promise<List> => {
    const response = await apiClient.get<List>(`/lists/${id}`);
    return response.data;
  },

  // Create new list
  create: async (data: CreateListRequest): Promise<List> => {
    const response = await apiClient.post<List>('/lists', data);
    return response.data;
  },

  // Update list
  update: async (id: string, data: UpdateListRequest): Promise<List> => {
    const response = await apiClient.put<List>(`/lists/${id}`, data);
    return response.data;
  },

  // Delete list
  delete: async (id: string, version: number): Promise<void> => {
    await apiClient.delete(`/lists/${id}`, {
      data: { version },
    });
  },
};

export default listsApi;
