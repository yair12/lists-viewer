/**
 * Dialog for resolving sync conflicts between local and server versions
 */

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper } from '@mui/material';
import type { Item, List } from '../../types';

interface ConflictDialogProps {
  open: boolean;
  resourceType: 'ITEM' | 'LIST';
  localVersion: Item | List;
  serverVersion: Item | List;
  onResolve: (choice: 'local' | 'server') => void;
  onClose: () => void;
}

export default function ConflictDialog({
  open,
  resourceType,
  localVersion,
  serverVersion,
  onResolve,
  onClose,
}: ConflictDialogProps) {
  if (!localVersion || !serverVersion) return null;

  const isItem = resourceType === 'ITEM';
  const localItem = localVersion as Item;
  const serverItem = serverVersion as Item;
  const localList = localVersion as List;
  const serverList = serverVersion as List;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Sync Conflict Detected</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          The {isItem ? 'item' : 'list'} was modified both locally and on the server. Choose which version to keep:
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          {/* Local Version */}
          <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Your Local Changes
            </Typography>
            <Typography variant="body2">
              <strong>Name:</strong> {localVersion.name}
            </Typography>
            {isItem && (
              <>
                <Typography variant="body2">
                  <strong>Completed:</strong> {localItem.completed ? 'Yes' : 'No'}
                </Typography>
                {localItem.quantity && (
                  <Typography variant="body2">
                    <strong>Quantity:</strong> {localItem.quantity} {localItem.quantityType}
                  </Typography>
                )}
              </>
            )}
            {!isItem && localList.description && (
              <Typography variant="body2">
                <strong>Description:</strong> {localList.description}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Modified: {new Date(localVersion.updatedAt).toLocaleString()}
            </Typography>
          </Paper>

          {/* Server Version */}
          <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
            <Typography variant="subtitle2" color="secondary" gutterBottom>
              Server Version
            </Typography>
            <Typography variant="body2">
              <strong>Name:</strong> {serverVersion.name}
            </Typography>
            {isItem && (
              <>
                <Typography variant="body2">
                  <strong>Completed:</strong> {serverItem.completed ? 'Yes' : 'No'}
                </Typography>
                {serverItem.quantity && (
                  <Typography variant="body2">
                    <strong>Quantity:</strong> {serverItem.quantity} {serverItem.quantityType}
                  </Typography>
                )}
              </>
            )}
            {!isItem && serverList.description && (
              <Typography variant="body2">
                <strong>Description:</strong> {serverList.description}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Modified: {new Date(serverVersion.updatedAt).toLocaleString()}
            </Typography>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={() => onResolve('server')} variant="outlined" color="secondary">
          Use Server Version
        </Button>
        <Button onClick={() => onResolve('local')} variant="contained" color="primary">
          Use My Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
