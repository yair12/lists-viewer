import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_PREFIX, USER_STORAGE_KEY } from '../../utils/constants';
import { ErrorResponse } from '../../types';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: 3000, // 3 seconds for fast offline detection
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get current user ID from local storage
 */
const getCurrentUserId = (): string | null => {
  try {
    const userStr = localStorage.getItem(USER_STORAGE_KEY);
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.id || user.username || null;
    }
  } catch (error) {
    console.error('Failed to get current user ID:', error);
  }
  return null;
};

/**
 * Request interceptor - Add authentication header
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const userId = getCurrentUserId();
    
    if (userId) {
      config.headers['X-User-Id'] = userId;
    }

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }

    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle errors
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error: AxiosError<ErrorResponse>) => {
    // Log error in development
    if (import.meta.env.DEV) {
      console.error('[API Response Error]', error.response?.data || error.message);
    }

    // Handle specific error cases
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - clear user session
          console.error('Unauthorized request. User may need to re-authenticate.');
          break;
        
        case 404:
          // Not found
          console.warn('Resource not found:', data?.message);
          break;
        
        case 409:
          // Conflict (version mismatch)
          console.warn('Version conflict detected:', data?.message);
          break;
        
        case 500:
        case 502:
        case 503:
        case 504:
          // Server errors
          console.error('Server error:', data?.message);
          break;
        
        default:
          console.error('API error:', data?.message);
      }

      return Promise.reject(data || error);
    }

    // Network error, timeout, or connection refused
    if (error.code === 'ECONNABORTED' || 
        error.code === 'ERR_NETWORK' ||
        error.message.includes('timeout') ||
        error.message === 'Network Error' ||
        error.message.includes('ERR_CONNECTION_REFUSED')) {
      console.error('Network/Connection error:', error.message, error.code);
      return Promise.reject({
        error: 'network_error',
        message: 'Cannot reach server. Working offline.',
      });
    }

    return Promise.reject(error);
  }
);

/**
 * Check if error is a version conflict
 */
export const isVersionConflict = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    error.error === 'version_conflict'
  );
};

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    (error.error === 'network_error' || error.error === 'timeout')
  );
};

/**
 * Extract error message from error object
 */
export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'An unexpected error occurred';
};

export default apiClient;
