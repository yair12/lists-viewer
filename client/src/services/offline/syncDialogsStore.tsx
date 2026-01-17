/**
 * Global state for managing conflict and error dialogs using React Context
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import type { Item, List } from '../../types';
import type { SyncQueueItem } from '../storage/syncQueue';

export type ConflictResolution = 'local' | 'server';

interface ConflictState {
  resourceType: 'ITEM' | 'LIST' | null;
  localVersion: Item | List | null;
  serverVersion: Item | List | null;
  queueItem: SyncQueueItem | null;
  resolve: ((choice: ConflictResolution) => void) | null;
}

interface ErrorState {
  resourceType: 'ITEM' | 'LIST' | null;
  resourceName: string;
  errorMessage: string;
  retryCount: number;
  queueItem: SyncQueueItem | null;
  retry: (() => void) | null;
  discard: (() => void) | null;
}

interface SyncDialogsContextType {
  conflictDialog: ConflictState;
  showConflictDialog: (
    resourceType: 'ITEM' | 'LIST',
    localVersion: Item | List,
    serverVersion: Item | List,
    queueItem: SyncQueueItem,
  ) => Promise<ConflictResolution>;
  closeConflictDialog: () => void;

  errorDialog: ErrorState;
  showErrorDialog: (
    resourceType: 'ITEM' | 'LIST',
    resourceName: string,
    errorMessage: string,
    retryCount: number,
    queueItem: SyncQueueItem,
  ) => Promise<'retry' | 'discard'>;
  closeErrorDialog: () => void;
}

const SyncDialogsContext = createContext<SyncDialogsContextType | null>(null);

export function SyncDialogsProvider({ children }: { children: ReactNode }) {
  const [conflictDialog, setConflictDialog] = useState<ConflictState>({
    resourceType: null,
    localVersion: null,
    serverVersion: null,
    queueItem: null,
    resolve: null,
  });

  const [errorDialog, setErrorDialog] = useState<ErrorState>({
    resourceType: null,
    resourceName: '',
    errorMessage: '',
    retryCount: 0,
    queueItem: null,
    retry: null,
    discard: null,
  });

  const showConflictDialog = (
    resourceType: 'ITEM' | 'LIST',
    localVersion: Item | List,
    serverVersion: Item | List,
    queueItem: SyncQueueItem,
  ): Promise<ConflictResolution> => {
    return new Promise<ConflictResolution>((resolve) => {
      setConflictDialog({
        resourceType,
        localVersion,
        serverVersion,
        queueItem,
        resolve,
      });
    });
  };

  const closeConflictDialog = () => {
    if (conflictDialog.resolve) {
      conflictDialog.resolve('server'); // Default to server on cancel
    }
    setConflictDialog({
      resourceType: null,
      localVersion: null,
      serverVersion: null,
      queueItem: null,
      resolve: null,
    });
  };

  const showErrorDialog = (
    resourceType: 'ITEM' | 'LIST',
    resourceName: string,
    errorMessage: string,
    retryCount: number,
    queueItem: SyncQueueItem,
  ): Promise<'retry' | 'discard'> => {
    return new Promise<'retry' | 'discard'>((resolve) => {
      setErrorDialog({
        resourceType,
        resourceName,
        errorMessage,
        retryCount,
        queueItem,
        retry: () => resolve('retry'),
        discard: () => resolve('discard'),
      });
    });
  };

  const closeErrorDialog = () => {
    if (errorDialog.discard) {
      errorDialog.discard(); // Default to discard on cancel
    }
    setErrorDialog({
      resourceType: null,
      resourceName: '',
      errorMessage: '',
      retryCount: 0,
      queueItem: null,
      retry: null,
      discard: null,
    });
  };

  return (
    <SyncDialogsContext.Provider
      value={{
        conflictDialog,
        showConflictDialog,
        closeConflictDialog,
        errorDialog,
        showErrorDialog,
        closeErrorDialog,
      }}
    >
      {children}
    </SyncDialogsContext.Provider>
  );
}

export function useSyncDialogs() {
  const context = useContext(SyncDialogsContext);
  if (!context) {
    throw new Error('useSyncDialogs must be used within SyncDialogsProvider');
  }
  return context;
}

// Export singleton instance for use outside React components (queue processor)
let dialogsInstance: SyncDialogsContextType | null = null;

export function setSyncDialogsInstance(instance: SyncDialogsContextType) {
  dialogsInstance = instance;
}

export function getSyncDialogsInstance(): SyncDialogsContextType {
  if (!dialogsInstance) {
    throw new Error('SyncDialogs instance not initialized');
  }
  return dialogsInstance;
}
