/**
 * Conflict Dialog Component
 * Shows conflict details and resolution options
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Divider,
  Alert,
  Chip,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { ConflictInfo, ResolutionStrategy } from '../../services/offline/conflictResolver';

interface ConflictDialogProps {
  open: boolean;
  conflict: ConflictInfo | null;
  onResolve: (strategy: ResolutionStrategy) => Promise<void>;
  onClose: () => void;
}

export function ConflictDialog({
  open,
  conflict,
  onResolve,
  onClose,
}: ConflictDialogProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<ResolutionStrategy>('use_local');
  const [resolving, setResolving] = useState(false);

  if (!conflict) return null;

  const { localVersion, serverVersion, conflictType, error } = conflict;

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onResolve(selectedStrategy);
      onClose();
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    } finally {
      setResolving(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          <Typography variant="h6">Sync Conflict Detected</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {conflictType === 'deleted'
            ? 'This item was deleted on the server while you were editing it.'
            : 'This item was modified by another user or on another device.'}
        </Alert>

        <Box mb={3}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Conflict Type
          </Typography>
          <Chip
            label={conflictType.replace('_', ' ').toUpperCase()}
            color="warning"
            size="small"
          />
        </Box>

        <Box mb={3}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Error Message
          </Typography>
          <Typography variant="body2">{error.message}</Typography>
        </Box>

        {/* Local Version */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight="bold">
                Your Local Version
              </Typography>
              <Chip label="Local" color="primary" size="small" />
            </Box>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2">
              <strong>Name:</strong> {localVersion.name}
            </Typography>
            {'description' in localVersion && localVersion.description && (
              <Typography variant="body2">
                <strong>Description:</strong> {localVersion.description}
              </Typography>
            )}
            {'completed' in localVersion && (
              <Typography variant="body2">
                <strong>Completed:</strong> {localVersion.completed ? 'Yes' : 'No'}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Last updated: {formatTimestamp(localVersion.updatedAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Version: {localVersion.version}
            </Typography>
          </CardContent>
        </Card>

        {/* Server Version */}
        {serverVersion ? (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Server Version
                </Typography>
                <Chip label="Server" color="secondary" size="small" />
              </Box>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2">
                <strong>Name:</strong> {serverVersion.name}
              </Typography>
              {'description' in serverVersion && serverVersion.description && (
                <Typography variant="body2">
                  <strong>Description:</strong> {serverVersion.description}
                </Typography>
              )}
              {'completed' in serverVersion && (
                <Typography variant="body2">
                  <strong>Completed:</strong> {serverVersion.completed ? 'Yes' : 'No'}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Last updated: {formatTimestamp(serverVersion.updatedAt)} by {serverVersion.updatedBy}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Version: {serverVersion.version}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'error.50' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <CancelIcon color="error" />
                <Typography variant="subtitle1" fontWeight="bold">
                  Item Deleted on Server
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Resolution Strategy */}
        <Box mt={3}>
          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            Choose Resolution Strategy
          </Typography>
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value as ResolutionStrategy)}
            >
              <FormControlLabel
                value="use_local"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      Use My Version (Local)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Overwrite the server version with your local changes
                    </Typography>
                  </Box>
                }
              />
              {serverVersion && (
                <FormControlLabel
                  value="use_server"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        Use Server Version
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Discard your local changes and accept the server version
                      </Typography>
                    </Box>
                  }
                />
              )}
              {serverVersion && (
                <FormControlLabel
                  value="merge"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        Merge Changes (Automatic)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Attempt to combine both versions automatically
                      </Typography>
                    </Box>
                  }
                />
              )}
              <FormControlLabel
                value="cancel"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      Cancel Operation
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Skip this sync and keep local state as-is
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={resolving}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleResolve}
          disabled={resolving}
          startIcon={<CheckIcon />}
        >
          {resolving ? 'Resolving...' : 'Resolve Conflict'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictDialog;
