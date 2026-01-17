/**
 * Conflicts List Component
 * Shows all pending conflicts and allows resolution
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Button,
  Alert,
} from '@mui/material';
import {
  VisibilityOutlined as ViewIcon,
  AutoFixHigh as AutoFixIcon,
} from '@mui/icons-material';
import { useConflicts } from '../../hooks/useConflicts';
import ConflictDialog from './ConflictDialog';
import type { ConflictInfo } from '../../services/offline/conflictResolver';

export const ConflictsList: React.FC = () => {
  const { conflicts, conflictCount, resolveConflict, autoResolve } = useConflicts();
  const [selectedConflict, setSelectedConflict] = useState<ConflictInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewConflict = (conflict: ConflictInfo) => {
    setSelectedConflict(conflict);
    setDialogOpen(true);
  };

  const handleAutoResolve = async (conflict: ConflictInfo) => {
    const resolved = await autoResolve(conflict.queueItem.id);
    if (!resolved) {
      // Could not auto-resolve, show dialog
      handleViewConflict(conflict);
    }
  };

  const handleResolve = async (strategy: 'use_local' | 'use_server' | 'merge' | 'cancel') => {
    if (selectedConflict) {
      await resolveConflict(selectedConflict.queueItem.id, strategy);
      setDialogOpen(false);
      setSelectedConflict(null);
    }
  };

  const handleSimpleResolve = (choice: 'local' | 'server') => {
    // Map simple choice to full strategy
    const strategyMap = { local: 'use_local' as const, server: 'use_server' as const };
    handleResolve(strategyMap[choice]);
  };

  if (conflictCount === 0) {
    return null;
  }

  const formatResourceType = (type: string) => {
    return type.charAt(0) + type.slice(1).toLowerCase();
  };

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {conflictCount} Sync Conflict{conflictCount > 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2">
              These items have conflicts that need to be resolved before they can be synced.
            </Typography>
          </Alert>

          <List>
            {conflicts.map((conflict) => (
              <ListItem
                key={conflict.queueItem.id}
                secondaryAction={
                  <Box display="flex" gap={1}>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleAutoResolve(conflict)}
                      title="Try auto-resolve"
                    >
                      <AutoFixIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleViewConflict(conflict)}
                      title="View details"
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
                sx={{
                  border: '1px solid',
                  borderColor: 'warning.light',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {conflict.localVersion.name}
                      </Typography>
                      <Chip
                        label={formatResourceType(conflict.queueItem.resourceType)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      <Chip
                        label={conflict.conflictType.replace('_', ' ')}
                        size="small"
                        color="warning"
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {conflict.queueItem.operationType} operation • {conflict.error.message}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>

          <Box mt={2} display="flex" justifyContent="flex-end">
            <Button
              size="small"
              onClick={() => conflicts.forEach((c) => handleAutoResolve(c))}
            >
              Try Auto-Resolve All
            </Button>
          </Box>
        </CardContent>
      </Card>

      <ConflictDialog
        open={dialogOpen && !!selectedConflict}
        resourceType={selectedConflict?.queueItem.resourceType || 'ITEM'}
        localVersion={selectedConflict?.localVersion!}
        serverVersion={selectedConflict?.serverVersion!}
        onResolve={handleSimpleResolve}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
};

export default ConflictsList;
