import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useLists } from '../../hooks/useLists';
import { useMoveItem } from '../../hooks/useItems';
import type { Item, List as ListType } from '../../types';

interface MoveItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: Item;
  currentListId: string;
}

export default function MoveItemDialog({ 
  open, 
  onClose, 
  item, 
  currentListId 
}: MoveItemDialogProps) {
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const { data: lists, isLoading } = useLists();
  const moveMutation = useMoveItem();

  const handleMove = () => {
    if (selectedListId) {
      moveMutation.mutate(
        {
          sourceListId: currentListId,
          itemId: item.id,
          data: {
            targetListId: selectedListId,
            order: 0,
            version: item.version,
          },
        },
        {
          onSettled: () => {
            onClose();
          },
        }
      );
    }
  };

  const availableLists = lists?.filter((list: ListType) => list.id !== currentListId) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Move Item to Another List</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : availableLists.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No other lists available. Create another list first.
          </Typography>
        ) : (
          <List>
            {availableLists.map((list: ListType) => (
              <ListItem key={list.id} disablePadding>
                <ListItemButton
                  selected={selectedListId === list.id}
                  onClick={() => setSelectedListId(list.id)}
                >
                  <ListItemText
                    primary={list.name}
                    secondary={list.description}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={moveMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleMove}
          variant="contained"
          disabled={!selectedListId || moveMutation.isPending}
        >
          {moveMutation.isPending ? 'Moving...' : 'Move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
