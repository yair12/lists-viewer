import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Divider, CircularProgress, Menu, MenuItem } from '@mui/material';
import { ArrowBack, MoreVert, Edit, Delete } from '@mui/icons-material';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import MainLayout from '../components/Layout/MainLayout';
import ItemsList from '../components/Items/ItemsList';
import EditListDialog from '../components/Lists/EditListDialog';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import { listsApi } from '../services/api/lists';
import { itemsApi } from '../services/api/items';
import { queryKeys } from '../services/api/queryClient';
import { useList } from '../hooks/useLists';
import { useReorderItems } from '../hooks/useItems';
import type { Item } from '../types';

export default function ListView() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: list, isLoading } = useList(listId!);
  const reorderMutation = useReorderItems();

  const deleteMutation = useMutation({
    mutationFn: () => listsApi.delete(listId!, list?.version || 1),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      navigate('/');
    },
  });

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
  };

  const handleDragEnd = (result: DropResult) => {
    try {
      console.log('[ListView] handleDragEnd called', result);
      if (!result.destination) {
        console.log('[ListView] No destination, returning');
        return;
      }

      const { source, destination } = result;
      console.log('[ListView] source:', source, 'destination:', destination);

    // Check if dropping on a sidebar list
    if (destination.droppableId.startsWith('sidebar-list-')) {
      const targetListId = destination.droppableId.replace('sidebar-list-', '');
      const itemId = result.draggableId;

      // Get the item being moved - use optional chaining
      const items = queryClient.getQueryData<any[]>(queryKeys.items.byList(listId!));
      const item = items?.find((i: any) => i.id === itemId);
      
      if (item && targetListId !== listId) {
        // Move item to the target list
        itemsApi.move(listId!, itemId, {
          targetListId,
          order: 0,
          version: item.version,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(listId!) });
          queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(targetListId) });
          queryClient.invalidateQueries({ queryKey: ['lists'] });
        }).catch((error) => {
          console.error('Error moving item:', error);
        });
      }
    } else if (destination.droppableId === 'items-list' && source.droppableId === 'items-list') {
      // Reordering within the same list
      console.log('[ListView] Reordering items in same list');
      const items = queryClient.getQueryData<Item[]>(queryKeys.items.byList(listId!));
      console.log('[ListView] Got items from cache:', items?.length, 'items');
      if (!items) {
        console.warn('[ListView] handleDragEnd - no items found in cache');
        return;
      }

      const sourceIndex = source.index;
      const destIndex = destination.index;

      if (sourceIndex === destIndex) {
        console.log('[ListView] handleDragEnd - source and dest index are the same, skipping');
        return;
      }

      // Only work with open (non-completed) items
      const openItems = items.filter(item => !item.completed);
      console.log('[ListView] handleDragEnd - reordering', openItems.length, 'open items');
      console.log('[ListView] Original order:', openItems.map(i => i.name));
      
      // Reorder the open items
      const reorderedOpenItems = Array.from(openItems);
      const [removed] = reorderedOpenItems.splice(sourceIndex, 1);
      reorderedOpenItems.splice(destIndex, 0, removed);

      console.log('[ListView] After drag order:', reorderedOpenItems.map(i => i.name));

      // Filter out pending items (with temporary IDs) from the reorder payload
      // Only send items that have been synced to the server
      const syncedItems = reorderedOpenItems.filter(item => !item.pending);
      
      if (syncedItems.length === 0) {
        console.log('[ListView] No synced items to reorder - skipping');
        return;
      }

      // Prepare the reorder payload - only send synced items with new orders
      const reorderPayload = syncedItems.map((item, index) => ({
        id: item.id,
        order: index,
      }));

      console.log('[ListView] Calling reorderMutation.mutate with', reorderPayload.length, 'items');
      // Use the hook with offline support (it handles optimistic updates)
      reorderMutation.mutate({
        listId: listId!,
        data: { items: reorderPayload }
      });
    }
    } catch (error) {
      console.error('[ListView] Error in handleDragEnd:', error);
    }
  };

  if (isLoading) {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <MainLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        </MainLayout>
      </DragDropContext>
    );
  }

  if (!list) {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <MainLayout>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="error">
              List not found
            </Typography>
          </Box>
        </MainLayout>
      </DragDropContext>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <MainLayout>
        <Box>
          {list.color && (
            <Box
              sx={{
                height: 4,
                bgcolor: list.color,
                borderRadius: 1,
                mb: 2,
                boxShadow: `0 2px 8px ${list.color}40`,
              }}
            />
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={() => navigate('/')} sx={{ mr: 1 }}>
              <ArrowBack />
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" gutterBottom>
                {list.name}
              </Typography>
              {list.description && (
                <Typography variant="body2" color="text.secondary">
                  {list.description}
                </Typography>
              )}
            </Box>
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <ItemsList listId={listId!} listColor={list.color} />
        </Box>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setEditDialogOpen(true);
            }}
          >
            <Edit sx={{ mr: 1 }} fontSize="small" />
            Edit List
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDeleteDialogOpen(true);
            }}
          >
            <Delete sx={{ mr: 1 }} fontSize="small" />
            Delete List
          </MenuItem>
        </Menu>

        {list && (
          <>
            <EditListDialog
              open={editDialogOpen}
              onClose={() => setEditDialogOpen(false)}
              list={list}
            />
            <ConfirmDialog
              open={deleteDialogOpen}
              title="Delete List"
              message={`Are you sure you want to delete "${list.name}"? This will also delete all items in this list.`}
              confirmText="Delete"
              onConfirm={handleDeleteConfirm}
              onCancel={() => setDeleteDialogOpen(false)}
              isLoading={deleteMutation.isPending}
            />
          </>
        )}
      </MainLayout>
    </DragDropContext>
  );
}
