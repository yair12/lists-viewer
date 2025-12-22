export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const USER_STORAGE_KEY = 'lists-viewer-user';
export const THEME_STORAGE_KEY = 'lists-viewer-theme';

export const STORAGE_KEYS = {
  USER: USER_STORAGE_KEY,
  THEME: THEME_STORAGE_KEY,
};

export const QUANTITY_TYPES = [
  'pieces',
  'kg',
  'gr',
  'liters',
  'ml',
  'dozen',
  'pack',
  'box',
  'bottle',
] as const;

export const DEFAULT_ICON_ID = 'avatar1';

export const SYNC_RETRY_DELAY = 5000; // 5 seconds
export const MAX_SYNC_RETRIES = 3;

export const DEBOUNCE_DELAY = 300; // milliseconds
