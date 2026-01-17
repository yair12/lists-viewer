import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { CheckBox, List as ListIcon } from '@mui/icons-material';
import { useState, useEffect, useMemo } from 'react';
import { QUANTITY_TYPES, USER_STORAGE_KEY } from '../../utils/constants';
import { useCreateItem, useUpdateItem, useItems } from '../../hooks/useItems';
import type { CreateItemRequest, Item } from '../../types';
import DuplicateItemDialog from '../Common/DuplicateItemDialog';

interface CreateItemDialogProps {
  open: boolean;
  onClose: () => void;
  listId: string;
}

export default function CreateItemDialog({ open, onClose, listId }: CreateItemDialogProps) {
  const [type, setType] = useState<'item' | 'list'>('item');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityType, setQuantityType] = useState<string>(QUANTITY_TYPES[0]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<CreateItemRequest | null>(null);
  const [duplicateItems, setDuplicateItems] = useState<Item[]>([]);

  // Fetch existing items to check for duplicates
  const { data: existingItems = [] } = useItems(listId);

  // Memoize user to prevent re-reads on every render
  const user = useMemo(() => {
    const userStr = localStorage.getItem(USER_STORAGE_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }, []);

  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem();

  // Close dialog when mutation succeeds
  useEffect(() => {
    if ((createMutation.isSuccess || updateMutation.isSuccess) && open) {
      handleClose();
    }
  }, [createMutation.isSuccess, updateMutation.isSuccess, open]);

  const handleClose = () => {
    setType('item');
    setName('');
    setDescription('');
    setQuantity('');
    setQuantityType(QUANTITY_TYPES[0]);
    setShowDuplicateDialog(false);
    setPendingPayload(null);
    setDuplicateItems([]);
    createMutation.reset();
    updateMutation.reset();
    onClose();
  };

  const checkForDuplicates = (itemName: string) => {
    const trimmedName = itemName.trim().toLowerCase();
    return existingItems.filter(
      (item) => item.name.toLowerCase() === trimmedName && !item.completed
    );
  };

  const handleDuplicateResolve = (choice: 'use-existing' | 'override' | 'cancel') => {
    setShowDuplicateDialog(false);
    
    if (choice === 'override' && pendingPayload && duplicateItems.length > 0) {
      // Override the first duplicate item with the new values
      const itemToUpdate = duplicateItems[0];
      updateMutation.mutate({
        listId,
        itemId: itemToUpdate.id,
        data: {
          ...pendingPayload,
          version: itemToUpdate.version,
        },
      });
      // Don't clear pendingPayload yet - let the success handler do it
    } else if (choice === 'use-existing') {
      // Just close the dialog - the existing item is already there
      handleClose();
    } else {
      // Cancel - just clear the pending payload
      setPendingPayload(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: CreateItemRequest = {
      type,
      name: name.trim(),
      ...(type === 'list' && description && { description: description.trim() }),
      ...(type === 'item' && quantity && { quantity: parseInt(quantity, 10) }),
      ...(type === 'item' && quantity && { quantityType }),
      ...(user && { userIconId: user.iconId }),
    };

    // Check for duplicates (only for items, not nested lists)
    if (type === 'item') {
      const duplicates = checkForDuplicates(name);
      if (duplicates.length > 0) {
        setPendingPayload(payload);
        setDuplicateItems(duplicates); // Store duplicates to avoid re-calculating
        setShowDuplicateDialog(true);
        return;
      }
    }

    createMutation.mutate({ listId, data: payload });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Add New Item</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <ToggleButtonGroup
              value={type}
              exclusive
              onChange={(_, newType) => newType && setType(newType)}
              fullWidth
            >
              <ToggleButton value="item">
                <CheckBox sx={{ mr: 1 }} />
                Regular Item
              </ToggleButton>
              <ToggleButton value="list">
                <ListIcon sx={{ mr: 1 }} />
                Nested List
              </ToggleButton>
            </ToggleButtonGroup>

            <TextField
              label={type === 'item' ? 'Item Name' : 'List Name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              autoFocus
              disabled={createMutation.isPending}
              inputProps={{ 'data-testid': 'item-name-input' }}
            />

            {type === 'list' && (
              <TextField
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                disabled={createMutation.isPending}
              />
            )}

            {type === 'item' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Quantity (optional)"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  type="number"
                  inputProps={{ min: 0, step: 0.01, 'data-testid': 'item-quantity-input' }}
                  sx={{ flex: 1 }}
                  disabled={createMutation.isPending}
                />
                <TextField
                  select
                  label="Unit"
                  value={quantityType}
                  onChange={(e) => setQuantityType(e.target.value)}
                  sx={{ flex: 1 }}
                  disabled={createMutation.isPending || !quantity}
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
          <Button onClick={handleClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={createMutation.isPending || !name.trim()}
          >
            {createMutation.isPending ? <CircularProgress size={24} /> : 'Add'}
          </Button>
        </DialogActions>
      </form>

      {/* Duplicate Item Dialog */}
      <DuplicateItemDialog
        open={showDuplicateDialog}
        itemName={name}
        existingItems={duplicateItems}
        onResolve={handleDuplicateResolve}
        onClose={() => setShowDuplicateDialog(false)}
      />
    </Dialog>
  );
}
