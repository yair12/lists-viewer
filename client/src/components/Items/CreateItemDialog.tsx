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
import { useCreateItem } from '../../hooks/useItems';
import type { CreateItemRequest } from '../../types';

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

  // Memoize user to prevent re-reads on every render
  const user = useMemo(() => {
    const userStr = localStorage.getItem(USER_STORAGE_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }, []);

  const createMutation = useCreateItem();

  // Close dialog when mutation succeeds
  useEffect(() => {
    if (createMutation.isSuccess) {
      handleClose();
    }
  }, [createMutation.isSuccess]);

  const handleClose = () => {
    setType('item');
    setName('');
    setDescription('');
    setQuantity('');
    setQuantityType(QUANTITY_TYPES[0]);
    onClose();
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
    </Dialog>
  );
}
