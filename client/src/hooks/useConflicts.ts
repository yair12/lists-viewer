/**
 * Custom hook for conflict resolution
 */

import { useState, useEffect } from 'react';
import { conflictResolver, type ConflictInfo, type ResolutionStrategy } from '../services/offline/conflictResolver';

/**
 * Hook to manage conflicts
 */
export const useConflicts = () => {
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  useEffect(() => {
    // Get initial conflicts
    setConflicts(conflictResolver.getPendingConflicts());

    // Listen for changes
    const unsubscribe = conflictResolver.addListener((updatedConflicts) => {
      setConflicts(updatedConflicts);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const resolveConflict = async (queueItemId: string, strategy: ResolutionStrategy) => {
    await conflictResolver.resolveConflict(queueItemId, strategy);
  };

  const autoResolve = async (queueItemId: string) => {
    return conflictResolver.autoResolve(queueItemId);
  };

  const clearResolved = () => {
    conflictResolver.clearResolvedConflicts();
  };

  return {
    conflicts,
    conflictCount: conflicts.length,
    resolveConflict,
    autoResolve,
    clearResolved,
    getConflict: (id: string) => conflicts.find((c) => c.queueItem.id === id),
  };
};

export default useConflicts;
