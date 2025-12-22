import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Box,
  CircularProgress,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  List as ListIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { listsApi } from '../../services/api/lists';
import type { List } from '../../types';

export default function ListsGrid() {
  const { data: lists, isLoading, error } = useQuery({
    queryKey: ['lists'],
    queryFn: listsApi.getAll,
  });

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
              <IconButton size="small">
                <MoreVertIcon />
              </IconButton>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
