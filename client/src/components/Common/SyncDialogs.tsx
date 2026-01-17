/**
 * Global sync dialogs that appear when conflicts or errors occur
 */

import { useEffect } from 'react';
import { useSyncDialogs, setSyncDialogsInstance } from '../../services/offline/syncDialogsStore';
import ConflictDialog from './ConflictDialog';
import SyncErrorDialog from './SyncErrorDialog';

export default function SyncDialogs() {
  const dialogsContext = useSyncDialogs();
  const { conflictDialog, closeConflictDialog, errorDialog, closeErrorDialog } = dialogsContext;

  // Register singleton instance for queue processor
  useEffect(() => {
    setSyncDialogsInstance(dialogsContext);
  }, [dialogsContext]);

  const handleConflictResolve = (choice: 'local' | 'server') => {
    if (conflictDialog.resolve) {
      conflictDialog.resolve(choice);
    }
    closeConflictDialog();
  };

  const handleErrorRetry = () => {
    if (errorDialog.retry) {
      errorDialog.retry();
    }
    closeErrorDialog();
  };

  const handleErrorDiscard = () => {
    if (errorDialog.discard) {
      errorDialog.discard();
    }
    closeErrorDialog();
  };

  return (
    <>
      <ConflictDialog
        open={conflictDialog.resourceType !== null}
        resourceType={conflictDialog.resourceType || 'ITEM'}
        localVersion={conflictDialog.localVersion!}
        serverVersion={conflictDialog.serverVersion!}
        onResolve={handleConflictResolve}
        onClose={closeConflictDialog}
      />
      
      <SyncErrorDialog
        open={errorDialog.resourceType !== null}
        resourceType={errorDialog.resourceType || 'ITEM'}
        resourceName={errorDialog.resourceName}
        errorMessage={errorDialog.errorMessage}
        retryCount={errorDialog.retryCount}
        onRetry={handleErrorRetry}
        onDiscard={handleErrorDiscard}
        onClose={closeErrorDialog}
      />
    </>
  );
}
