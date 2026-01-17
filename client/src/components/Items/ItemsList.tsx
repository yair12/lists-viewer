import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material';
import { 
  Add as AddIcon, 
  MoreVert, 
  CheckCircle, 
  DeleteSweep 
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { itemsApi } from '../../services/api/items';
import { useItems } from '../../hooks/useItems';
import ItemRow from './ItemRow';
import CreateItemDialog from './CreateItemDialog';
import ConfirmDialog from '../Common/ConfirmDialog';
import type { Item } from '../../types';

interface ItemsListProps {
  listId: string;
  listColor?: string;
}

export default function ItemsList({ listId, listColor }: ItemsListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [deleteCompletedDialogOpen, setDeleteCompletedDialogOpen] = useState(false);
  const [completeAllDialogOpen, setCompleteAllDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useItems(listId);

  const deleteCompletedMutation = useMutation({
    mutationFn: () => itemsApi.deleteCompleted(listId),
    onSuccess: async () => {
      // Remove the query data to force fresh fetch from server
      queryClient.removeQueries({ queryKey: ['items', listId] });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['items', listId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['lists'], type: 'active' })
      ]);
      setDeleteCompletedDialogOpen(false);
    },
  });

  const completeAllMutation = useMutation({
    mutationFn: () => {
      const openItemIds = openItems.map(item => item.id);
      return itemsApi.bulkComplete(listId, openItemIds);
    },
    onSuccess: async () => {
      // Remove the query data to force fresh fetch from server
      queryClient.removeQueries({ queryKey: ['items', listId] });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['items', listId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['lists'], type: 'active' })
      ]);
      setCompleteAllDialogOpen(false);
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const openItems = items?.filter((item: Item) => !item.completed) || [];
  const completedItems = items?.filter((item: Item) => item.completed) || [];

  const handleCompleteAll = () => {
    setMenuAnchor(null);
    setCompleteAllDialogOpen(true);
  };

  const handleDeleteCompleted = () => {
    setMenuAnchor(null);
    setDeleteCompletedDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Items ({openItems.length})
        </Typography>
        <Box>
          {(openItems.length > 0 || completedItems.length > 0) && (
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            data-testid="add-item-button"
          >
            Add Item
          </Button>
        </Box>
      </Box>

      {openItems.length === 0 && completedItems.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No items yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click "Add Item" to create your first item
          </Typography>
        </Box>
      ) : (
        <>
          {/* Open Items */}
          <Droppable droppableId="items-list">
            {(provided) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{ mb: 4 }}
              >
                {openItems.map((item: Item, index: number) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: snapshot.isDragging ? 0.8 : 1,
                          }}
                        >
                          <ItemRow 
                            item={item} 
                            listId={listId}
                            listColor={listColor}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>

          {/* Completed Items */}
          {completedItems.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
                Completed ({completedItems.length})
              </Typography>
              <Box sx={{ opacity: 0.6 }}>
                {completedItems.map((item: Item) => (
                  <ItemRow key={item.id} item={item} listId={listId} listColor={listColor} />
                ))}
              </Box>
            </>
          )}
        </>
      )}

      <CreateItemDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        listId={listId}
      />

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        {openItems.length > 0 && (
          <MenuItem onClick={handleCompleteAll}>
            <CheckCircle sx={{ mr: 1 }} fontSize="small" />
            Complete All
          </MenuItem>
        )}
        {completedItems.length > 0 && (
          <MenuItem onClick={handleDeleteCompleted}>
            <DeleteSweep sx={{ mr: 1 }} fontSize="small" />
            Delete Completed
          </MenuItem>
        )}
      </Menu>

      <ConfirmDialog
        open={completeAllDialogOpen}
        title="Complete All Items"
        message={`Mark all ${openItems.length} open items as complete?`}
        confirmText="Complete All"
        onConfirm={() => completeAllMutation.mutate()}
        onCancel={() => setCompleteAllDialogOpen(false)}
        isLoading={completeAllMutation.isPending}
      />

      <ConfirmDialog
        open={deleteCompletedDialogOpen}
        title="Delete Completed Items"
        message={`Delete all ${completedItems.length} completed items? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={() => deleteCompletedMutation.mutate()}
        onCancel={() => setDeleteCompletedDialogOpen(false)}
        isLoading={deleteCompletedMutation.isPending}
      />
    </Box>
  );
}
