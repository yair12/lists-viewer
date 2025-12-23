import {
  Box,
  Checkbox,
  Typography,
  IconButton,
  Chip,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  DragIndicator as DragIcon,
  Edit,
  Delete,
  DriveFileMove,
  ChevronRight,
} from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpdateItem, useDeleteItem } from '../../hooks/useItems';
import { useItemPendingSync } from '../../hooks/useSyncStatus';
import { useIcons } from '../../hooks/useUser';
import EditItemDialog from './EditItemDialog';
import ConfirmDialog from '../Common/ConfirmDialog';
import MoveItemDialog from './MoveItemDialog';
import type { Item } from '../../types';

interface ItemRowProps {
  item: Item;
  listId: string;
  listColor?: string;
}

export default function ItemRow({ item, listId, listColor }: ItemRowProps) {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const updateMutation = useUpdateItem();
  const deleteMutation = useDeleteItem();
  const { data: icons = [] } = useIcons();
  
  // Check if this item has pending sync operations
  const { data: isPendingSync = false } = useItemPendingSync(item.id);
  const isTempId = item.id.startsWith('temp-');
  const showPendingIndicator = isTempId || isPendingSync;

  // Get icon URL for the item's creator
  const userIcon = icons.find(icon => icon.id === item.userIconId);

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    updateMutation.mutate({
      listId,
      itemId: item.id,
      data: {
        name: item.name,
        completed: !item.completed,
        quantity: item.quantity,
        quantityType: item.quantityType,
        version: item.version,
      },
    });
  };

  const handleEdit = () => {
    setMenuAnchor(null);
    setEditDialogOpen(true);
  };

  const handleDelete = () => {
    setMenuAnchor(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(
      { listId, itemId: item.id, version: item.version },
      { onSettled: () => setDeleteDialogOpen(false) }
    );
  };

  const handleMove = () => {
    setMenuAnchor(null);
    setMoveDialogOpen(true);
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't open edit if clicking on checkbox, menu button, or already in a menu
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('[role="checkbox"]') ||
      target.closest('[role="menu"]')
    ) {
      return;
    }
    // Navigate to nested list if item is a list
    if (item.type === 'list') {
      navigate(`/lists/${item.id}`);
    } else {
      setEditDialogOpen(true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box
      onClick={handleRowClick}
      data-item-id={item.id}
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: 1.5,
        px: 1,
        borderRadius: 1,
        borderLeft: listColor ? `3px solid ${listColor}` : 'none',
        cursor: 'pointer',
        bgcolor: showPendingIndicator ? 'warning.dark' : 'transparent',
        '&:hover': {
          bgcolor: showPendingIndicator ? 'warning.main' : 'action.hover',
        },
      }}
    >
      <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', mr: 1 }}>
        <DragIcon fontSize="small" sx={{ color: 'text.disabled' }} />
      </Box>

      {item.type === 'item' && (
        <Checkbox
          checked={item.completed}
          onChange={handleToggle}
          onClick={(e) => e.stopPropagation()}
          disabled={updateMutation.isPending}
          data-testid="item-checkbox"
          sx={{
            '& .MuiSvgIcon-root': { 
              fontSize: { xs: 32, sm: 28 } // Larger on mobile
            },
            p: { xs: 1.5, sm: 1 } // More padding on mobile for easier tapping
          }}
        />
      )}

      <Box sx={{ flex: 1, ml: item.type === 'list' ? 2 : 0 }}>
        <Typography
          variant="body1"
          sx={{
            textDecoration: item.completed ? 'line-through' : 'none',
            color: item.completed ? 'text.secondary' : 'text.primary',
          }}
        >
          {item.name}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {showPendingIndicator && (
            <Chip label="Pending Sync" size="small" color="warning" />
          )}
          
          {item.type === 'list' && (
            <Chip label="List" size="small" color="primary" variant="outlined" />
          )}
          
          {item.quantity && item.quantityType && (
            <Chip
              label={`${item.quantity} ${item.quantityType}`}
              size="small"
              variant="outlined"
            />
          )}
          
          {item.type === 'list' && (
            <Typography variant="caption" color="text.secondary">
              {item.itemCount || 0} items
            </Typography>
          )}
          
          <Typography variant="caption" color="text.secondary">
            {formatDate(item.updatedAt)}
          </Typography>
          
          {item.userIconId && userIcon && (
            <Avatar
              src={userIcon.url}
              alt={userIcon.name}
              sx={{
                width: { xs: 40, sm: 36 },
                height: { xs: 40, sm: 36 },
                fontSize: '1rem',
              }}
            >
              {item.createdBy?.charAt(0).toUpperCase() || '?'}
            </Avatar>
          )}
        </Box>
      </Box>

      {item.type === 'list' && (
        <ChevronRight sx={{ color: 'text.disabled', mr: 1 }} />
      )}

      <IconButton 
        size="small" 
        onClick={(e) => {
          e.stopPropagation();
          setMenuAnchor(e.currentTarget);
        }}
        data-testid="item-menu-button"
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        {item.type === 'item' && (
          <MenuItem onClick={handleMove}>
            <DriveFileMove sx={{ mr: 1 }} fontSize="small" />
            Move to List
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      <EditItemDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        item={item}
        listId={listId}
      />

      <MoveItemDialog
        open={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        item={item}
        currentListId={listId}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title={`Delete ${item.type === 'item' ? 'Item' : 'Nested List'}`}
        message={`Are you sure you want to delete "${item.name}"?${
          item.type === 'list' ? ' This will also delete all items in this nested list.' : ''
        }`}
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
}
