import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { QUANTITY_TYPES } from '../../utils/constants';
import { useUpdateItem, useItems } from '../../hooks/useItems';
import type { Item, UpdateItemRequest } from '../../types';
import DuplicateItemDialog from '../Common/DuplicateItemDialog';

interface EditItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: Item;
  listId: string;
}

export default function EditItemDialog({ open, onClose, item, listId }: EditItemDialogProps) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description || '');
  const [quantity, setQuantity] = useState(item.quantity?.toString() || '');
  const [quantityType, setQuantityType] = useState<string>(item.quantityType || QUANTITY_TYPES[0]);
  const [capturedVersion, setCapturedVersion] = useState(item.version);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<UpdateItemRequest | null>(null);
  
  const updateMutation = useUpdateItem();
  
  // Fetch existing items to check for duplicates
  const { data: existingItems = [] } = useItems(listId);

  useEffect(() => {
    if (open) {
      setName(item.name);
      setDescription(item.description || '');
      setQuantity(item.quantity?.toString() || '');
      setQuantityType(item.quantityType || QUANTITY_TYPES[0]);
      // Capture version when dialog opens - don't update it even if item changes
      setCapturedVersion(item.version);
      setShowDuplicateDialog(false);
      setPendingPayload(null);
    }
  }, [open, item]);

  const checkForDuplicates = (itemName: string) => {
    const trimmedName = itemName.trim().toLowerCase();
    return existingItems.filter(
      (existingItem) => 
        existingItem.id !== item.id && // Exclude current item
        existingItem.name.toLowerCase() === trimmedName && 
        !existingItem.completed
    );
  };

  const handleDuplicateResolve = (choice: 'use-existing' | 'override' | 'cancel') => {
    setShowDuplicateDialog(false);
    
    if (choice === 'override' && pendingPayload) {
      updateMutation.mutate(
        { listId, itemId: item.id, data: pendingPayload },
        {
          onSettled: () => {
            onClose();
          },
        }
      );
      setPendingPayload(null);
    } else if (choice === 'use-existing') {
      // Just close the dialog - don't update
      onClose();
    }
    // If cancel, do nothing - just close duplicate dialog
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: UpdateItemRequest = {
      name: name.trim(),
      version: capturedVersion, // Use the captured version, not item.version
      ...(item.type === 'list' && description && { description: description.trim() }),
      ...(item.type === 'item' && quantity && { quantity: parseFloat(quantity) }),
      ...(item.type === 'item' && quantity && { quantityType }),
    };

    // Check for duplicates only if name changed (only for items, not nested lists)
    if (item.type === 'item' && name.trim().toLowerCase() !== item.name.toLowerCase()) {
      const duplicates = checkForDuplicates(name);
      if (duplicates.length > 0) {
        setPendingPayload(payload);
        setShowDuplicateDialog(true);
        return;
      }
    }

    updateMutation.mutate(
      { listId, itemId: item.id, data: payload },
      {
        onSettled: () => {
          // Close dialog whether online save succeeded or offline save was queued
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          Edit {item.type === 'item' ? 'Item' : 'Nested List'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              autoFocus
              disabled={updateMutation.isPending}
              inputProps={{ 'data-testid': 'edit-item-name-input' }}
            />

            {item.type === 'list' && (
              <TextField
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                disabled={updateMutation.isPending}
              />
            )}

            {item.type === 'item' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Quantity (optional)"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  type="number"
                  inputProps={{ min: 0, step: 0.01, 'data-testid': 'edit-item-quantity-input' }}
                  sx={{ flex: 1 }}
                  disabled={updateMutation.isPending}
                />
                <TextField
                  select
                  label="Unit"
                  value={quantityType}
                  onChange={(e) => setQuantityType(e.target.value)}
                  sx={{ flex: 1 }}
                  disabled={updateMutation.isPending || !quantity}
                >
                  {QUANTITY_TYPES.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {unit}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={updateMutation.isPending || !name.trim()}
            data-testid="edit-item-submit"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>

      {/* Duplicate Item Dialog */}
      <DuplicateItemDialog
        open={showDuplicateDialog}
        itemName={name}
        existingItems={checkForDuplicates(name)}
        onResolve={handleDuplicateResolve}
        onClose={() => setShowDuplicateDialog(false)}
      />
    </Dialog>
  );
}
