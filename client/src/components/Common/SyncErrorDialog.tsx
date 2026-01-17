/**
 * Dialog for handling sync errors that require user action
 */

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert, Box } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface SyncErrorDialogProps {
  open: boolean;
  resourceType: 'ITEM' | 'LIST';
  resourceName: string;
  errorMessage: string;
  retryCount: number;
  onRetry: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export default function SyncErrorDialog({
  open,
  resourceType,
  resourceName,
  errorMessage,
  retryCount,
  onRetry,
  onDiscard,
  onClose,
}: SyncErrorDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ErrorOutlineIcon color="error" />
        Sync Error
      </DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to sync {resourceType.toLowerCase()}: <strong>{resourceName}</strong>
        </Alert>

        <Typography variant="body2" color="text.secondary" paragraph>
          {errorMessage}
        </Typography>

        {retryCount > 0 && (
          <Typography variant="body2" color="text.secondary" paragraph>
            Retry attempts: {retryCount}/3
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            <strong>What would you like to do?</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Retry:</strong> Attempt to sync again
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Discard:</strong> Remove this change from the sync queue
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={onDiscard} color="error" variant="outlined">
          Discard Changes
        </Button>
        <Button onClick={onRetry} color="primary" variant="contained">
          Retry Sync
        </Button>
      </DialogActions>
    </Dialog>
  );
}
