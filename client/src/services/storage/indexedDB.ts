/**
 * IndexedDB wrapper for offline data persistence
 * Stores lists, items, sync queue, cache, and user preferences
 */

const DB_NAME = 'lists-viewer-db';
const DB_VERSION = 1;

// Store names
export const STORES = {
  LISTS: 'lists',
  ITEMS: 'items',
  SYNC_QUEUE: 'syncQueue',
  CACHE: 'cache',
  USER: 'user',
} as const;

export interface DBStores {
  lists: IDBObjectStore;
  items: IDBObjectStore;
  syncQueue: IDBObjectStore;
  cache: IDBObjectStore;
  user: IDBObjectStore;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB with schema
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Lists store
      if (!db.objectStoreNames.contains(STORES.LISTS)) {
        const listStore = db.createObjectStore(STORES.LISTS, { keyPath: 'id' });
        listStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        listStore.createIndex('createdBy', 'createdBy', { unique: false });
      }

      // Items store
      if (!db.objectStoreNames.contains(STORES.ITEMS)) {
        const itemStore = db.createObjectStore(STORES.ITEMS, { keyPath: 'id' });
        itemStore.createIndex('listId', 'listId', { unique: false });
        itemStore.createIndex('type', 'type', { unique: false });
        itemStore.createIndex('completed', 'completed', { unique: false });
        itemStore.createIndex('order', 'order', { unique: false });
        itemStore.createIndex('listId_order', ['listId', 'order'], { unique: false });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('status', 'status', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncStore.createIndex('status_timestamp', ['status', 'timestamp'], { unique: false });
      }

      // Cache store (for misc cached data)
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
      }

      // User store
      if (!db.objectStoreNames.contains(STORES.USER)) {
        db.createObjectStore(STORES.USER, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Get a value from a store by key
 */
export const getItem = async <T>(storeName: string, key: string): Promise<T | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get item from ${storeName}`));
    };
  });
};

/**
 * Get all values from a store
 */
export const getAllItems = async <T>(storeName: string): Promise<T[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get all items from ${storeName}`));
    };
  });
};

/**
 * Get items by index
 */
export const getItemsByIndex = async <T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey | IDBKeyRange
): Promise<T[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get items by index from ${storeName}`));
    };
  });
};

/**
 * Put (add or update) a value in a store
 */
export const putItem = async <T>(storeName: string, value: T): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to put item in ${storeName}`));
    };
  });
};

/**
 * Put multiple items in a store (transaction)
 */
export const putItems = async <T extends { id?: string }>(
  storeName: string,
  values: T[]
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    let completed = 0;
    let failed = false;

    values.forEach((value) => {
      const request = store.put(value);

      request.onsuccess = () => {
        completed++;
        if (completed === values.length && !failed) {
          resolve();
        }
      };

      request.onerror = () => {
        if (!failed) {
          failed = true;
          reject(new Error(`Failed to put items in ${storeName}`));
        }
      };
    });

    if (values.length === 0) {
      resolve();
    }
  });
};

/**
 * Delete a value from a store by key
 */
export const deleteItem = async (storeName: string, key: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete item from ${storeName}`));
    };
  });
};

/**
 * Delete multiple items from a store
 */
export const deleteItems = async (storeName: string, keys: string[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    let completed = 0;
    let failed = false;

    keys.forEach((key) => {
      const request = store.delete(key);

      request.onsuccess = () => {
        completed++;
        if (completed === keys.length && !failed) {
          resolve();
        }
      };

      request.onerror = () => {
        if (!failed) {
          failed = true;
          reject(new Error(`Failed to delete items from ${storeName}`));
        }
      };
    });

    if (keys.length === 0) {
      resolve();
    }
  });
};

/**
 * Clear all data from a store
 */
export const clearStore = async (storeName: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to clear store ${storeName}`));
    };
  });
};

/**
 * Count items in a store
 */
export const countItems = async (storeName: string): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(`Failed to count items in ${storeName}`));
    };
  });
};

/**
 * Clear all data from database (reset)
 */
export const clearAllData = async (): Promise<void> => {
  const db = await initDB();
  const storeNames = Array.from(db.objectStoreNames);
  
  for (const storeName of storeNames) {
    await clearStore(storeName);
  }
};

/**
 * Close database connection
 */
export const closeDB = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

// Expose for dev/test access
if (typeof window !== 'undefined') {
  (window as any).__openDB = initDB;
}
