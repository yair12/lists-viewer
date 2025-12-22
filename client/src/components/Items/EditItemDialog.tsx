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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../../services/api/items';
import { QUANTITY_TYPES } from '../../utils/constants';
import type { Item, UpdateItemRequest } from '../../types';

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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(item.name);
      setDescription(item.description || '');
      setQuantity(item.quantity?.toString() || '');
      setQuantityType(item.quantityType || QUANTITY_TYPES[0]);
    }
  }, [open, item]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateItemRequest) => itemsApi.update(listId, item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: UpdateItemRequest = {
      name: name.trim(),
      version: item.version,
      ...(item.type === 'list' && description && { description: description.trim() }),
      ...(item.type === 'item' && quantity && { quantity: parseFloat(quantity) }),
      ...(item.type === 'item' && quantity && { quantityType }),
    };

    updateMutation.mutate(payload);
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
                  inputProps={{ min: 0, step: 0.01 }}
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
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
