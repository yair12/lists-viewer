/**
 * Dialog for resolving duplicate item names
 */

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Paper, Box } from '@mui/material';
import type { Item } from '../../types';

interface DuplicateItemDialogProps {
  open: boolean;
  itemName: string;
  existingItems: Item[];
  onResolve: (choice: 'use-existing' | 'override' | 'cancel') => void;
  onClose: () => void;
}

export default function DuplicateItemDialog({
  open,
  itemName,
  existingItems,
  onResolve,
  onClose,
}: DuplicateItemDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Duplicate Item Detected</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          An item with the name "{itemName}" already exists in this list.
        </Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Existing Item{existingItems.length > 1 ? 's' : ''}:
          </Typography>
          {existingItems.map((item) => (
            <Box key={item.id} sx={{ mb: 1 }}>
              <Typography variant="body2">
                <strong>{item.name}</strong>
              </Typography>
              {item.quantity && (
                <Typography variant="caption" color="text.secondary">
                  Quantity: {item.quantity} {item.quantityType}
                </Typography>
              )}
              {item.completed && (
                <Typography variant="caption" color="success.main" sx={{ ml: 1 }}>
                  (Completed)
                </Typography>
              )}
            </Box>
          ))}
        </Paper>

        <Typography variant="body2" color="text.secondary">
          Would you like to use the existing item or override it with the new values?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onResolve('cancel')} color="inherit">
          Cancel
        </Button>
        <Button onClick={() => onResolve('override')} variant="outlined" color="warning">
          Override Existing
        </Button>
        <Button onClick={() => onResolve('use-existing')} variant="contained" color="primary">
          Use Existing
        </Button>
      </DialogActions>
    </Dialog>
  );
}
