import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Box,
  CircularProgress,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  List as ListIcon,
  Edit,
  Delete,
} from '@mui/icons-material';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listsApi } from '../../services/api/lists';
import EditListDialog from './EditListDialog';
import ConfirmDialog from '../Common/ConfirmDialog';
import type { List } from '../../types';

export default function ListsGrid() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: lists, isLoading, error } = useQuery({
    queryKey: ['lists'],
    queryFn: listsApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (list: List) => listsApi.delete(list.id, list.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setDeleteDialogOpen(false);
    },
  });

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, list: List) => {
    e.stopPropagation();
    setSelectedList(list);
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    setEditDialogOpen(true);
  };

  const handleDelete = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedList) {
      deleteMutation.mutate(selectedList);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="error">
          Failed to load lists. Please try again.
        </Typography>
      </Box>
    );
  }

  if (!lists || lists.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <ListIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No lists yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first list using the + button in the sidebar
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {lists.map((list: List) => (
        <Grid item xs={12} sm={6} md={4} key={list.id}>
          <Card
            onClick={() => navigate(`/lists/${list.id}`)}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4,
              },
              cursor: 'pointer',
            }}
          >
            <Box
              sx={{
                height: 8,
                bgcolor: list.color,
              }}
            />
            <CardContent sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom noWrap>
                {list.name}
              </Typography>
              {list.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {list.description}
                </Typography>
              )}
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {list.itemCount || 0} items
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Updated {new Date(list.updatedAt).toLocaleDateString()}
                </Typography>
              </Box>
            </CardContent>
            <CardActions sx={{ justifyContent: 'flex-end' }}>
              <IconButton 
                size="small" 
                onClick={(e) => handleMenuOpen(e, list)}
              >
                <MoreVertIcon />
              </IconButton>
            </CardActions>
          </Card>
        </Grid>
      ))}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {selectedList && (
        <>
          <EditListDialog
            open={editDialogOpen}
            onClose={() => setEditDialogOpen(false)}
            list={selectedList}
          />
          <ConfirmDialog
            open={deleteDialogOpen}
            title="Delete List"
            message={`Are you sure you want to delete "${selectedList.name}"? This will also delete all items in this list.`}
            confirmText="Delete"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteDialogOpen(false)}
            isLoading={deleteMutation.isPending}
          />
        </>
      )}
    </Grid>
  );
}
