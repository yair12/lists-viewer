import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  IconButton,
  Divider,
  CircularProgress,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  List as ListIcon,
  Inbox as InboxIcon,
  MoreVert,
  Edit,
  Delete,
} from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Droppable } from '@hello-pangea/dnd';
import { listsApi } from '../../services/api/lists';
import EditListDialog from '../Lists/EditListDialog';
import ConfirmDialog from '../Common/ConfirmDialog';
import type { List as ListType } from '../../types';
import CreateListDialog from '../Lists/CreateListDialog';

const drawerWidth = 280;

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedListForMenu, setSelectedListForMenu] = useState<ListType | null>(null);

  const { data: lists, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: listsApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (list: ListType) => listsApi.delete(list.id, list.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setDeleteDialogOpen(false);
      navigate('/');
    },
  });

  const selectedListId = location.pathname.startsWith('/lists/') 
    ? location.pathname.split('/')[2] 
    : null;

  const handleListClick = (listId: string) => {
    navigate(`/lists/${listId}`);
    if (isMobile) {
      onMobileClose();
    }
  };

  const drawerContent = (
    <>
        <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
          <ListItem 
            disablePadding
            secondaryAction={
              <IconButton
                color="primary"
                onClick={() => setCreateDialogOpen(true)}
                size="small"
              >
                <AddIcon />
              </IconButton>
            }
          >
            <ListItemButton
              selected={selectedListId === null}
              onClick={() => navigate('/')}
            >
              <ListItemIcon>
                <InboxIcon />
              </ListItemIcon>
              <ListItemText primary="All Lists" />
            </ListItemButton>
          </ListItem>

          <Divider sx={{ my: 1 }} />

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : lists && lists.length > 0 ? (
            lists.map((list: ListType) => (
              <Droppable key={list.id} droppableId={`sidebar-list-${list.id}`}>
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps}
                    style={{
                      backgroundColor: snapshot.isDraggingOver ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <ListItem 
                      disablePadding
                      secondaryAction={
                        selectedListId === list.id ? (
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedListForMenu(list);
                              setMenuAnchor(e.currentTarget);
                            }}
                          >
                            <MoreVert fontSize="small" />
                          </IconButton>
                        ) : null
                      }
                    >
                      <ListItemButton
                        selected={selectedListId === list.id}
                        onClick={() => handleListClick(list.id)}
                      >
                        <ListItemIcon>
                          <ListIcon sx={{ color: list.color }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={list.name}
                          secondary={list.description}
                          secondaryTypographyProps={{
                            noWrap: true,
                            sx: { fontSize: '0.75rem' },
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))
          ) : (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No lists yet. Create your first list!
              </Typography>
            </Box>
          )}
        </List>

      <CreateListDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />

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
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteDialogOpen(true);
          }}
        >
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {selectedListForMenu && (
        <>
          <EditListDialog
            open={editDialogOpen}
            onClose={() => setEditDialogOpen(false)}
            list={selectedListForMenu}
          />
          <ConfirmDialog
            open={deleteDialogOpen}
            title="Delete List"
            message={`Are you sure you want to delete "${selectedListForMenu.name}"? This will also delete all items in this list.`}
            confirmText="Delete"
            onConfirm={() => deleteMutation.mutate(selectedListForMenu)}
            onCancel={() => setDeleteDialogOpen(false)}
            isLoading={deleteMutation.isPending}
          />
        </>
      )}
    </>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}
