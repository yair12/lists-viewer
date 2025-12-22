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
} from '@mui/material';
import {
  Add as AddIcon,
  List as ListIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listsApi } from '../../services/api/lists';
import type { List as ListType } from '../../types';
import CreateListDialog from '../Lists/CreateListDialog';

const drawerWidth = 280;

export default function Sidebar() {
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: lists, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: listsApi.getAll,
  });

  const handleListClick = (listId: string) => {
    setSelectedListId(listId);
    // TODO: Navigate to list view
  };

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div">
            My Lists
          </Typography>
          <IconButton
            color="primary"
            onClick={() => setCreateDialogOpen(true)}
            size="small"
          >
            <AddIcon />
          </IconButton>
        </Box>

        <Divider />

        <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedListId === null}
              onClick={() => setSelectedListId(null)}
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
              <ListItem key={list.id} disablePadding>
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
            ))
          ) : (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No lists yet. Create your first list!
              </Typography>
            </Box>
          )}
        </List>
      </Drawer>

      <CreateListDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </>
  );
}
