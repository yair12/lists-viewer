import apiClient from './client';
import type { User, Icon, InitUserRequest, IconsResponse } from '../../types';

export const usersApi = {
  // Initialize or get user
  init: async (data: InitUserRequest): Promise<User> => {
    const response = await apiClient.post<User>('/users/init', data);
    return response.data;
  },

  // Get available icons
  getIcons: async (): Promise<Icon[]> => {
    const response = await apiClient.get<IconsResponse>('/icons');
    return response.data.data;
  },
};

export default usersApi;
