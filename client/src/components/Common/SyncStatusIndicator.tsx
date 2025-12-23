/**
 * Sync Status Indicator Component
 * Shows current sync status and pending operations
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  CloudQueue as CloudQueueIcon,
  Sync as SyncIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useSyncQueueStats, useHasPendingSync } from '../../hooks/useSyncQueue';
import { syncManager } from '../../services/offline/syncManager';
import { conflictResolver } from '../../services/offline/conflictResolver';

export const SyncStatusIndicator: React.FC = () => {
  const { isOnline } = useNetworkStatus();
  const { data: syncStats } = useSyncQueueStats();
  const { data: hasPending } = useHasPendingSync();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [conflicts, setConflicts] = useState<number>(0);

  useEffect(() => {
    // Listen to sync manager status
    const unsubscribe = syncManager.addListener((status) => {
      setSyncStatus(status);
    });

    // Listen to conflicts
    const unsubscribeConflicts = conflictResolver.addListener((conflictList) => {
      setConflicts(conflictList.length);
    });

    return () => {
      unsubscribe();
      unsubscribeConflicts();
    };
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleForceSync = async () => {
    try {
      await syncManager.forceSyncNow();
    } catch (error) {
      console.error('Failed to force sync:', error);
    }
  };

  const open = Boolean(anchorEl);

  // Determine icon and color based on status
  const getStatusIcon = () => {
    if (!isOnline) {
      return <CloudOffIcon fontSize="small" />;
    }
    if (syncStatus === 'syncing') {
      return <SyncIcon fontSize="small" className="rotating" />;
    }
    if (conflicts > 0 || (syncStats?.failed && syncStats.failed > 0)) {
      return <WarningIcon fontSize="small" />;
    }
    if (hasPending) {
      return <CloudQueueIcon fontSize="small" />;
    }
    return <CloudDoneIcon fontSize="small" />;
  };

  const getStatusColor = (): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    if (!isOnline) return 'default';
    if (syncStatus === 'syncing') return 'info';
    if (conflicts > 0 || (syncStats?.failed && syncStats.failed > 0)) return 'warning';
    if (hasPending) return 'secondary';
    return 'success';
  };

  const getStatusLabel = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus === 'syncing') return 'Syncing';
    if (conflicts > 0) return `${conflicts} Conflicts`;
    if (syncStats?.failed && syncStats.failed > 0) return `${syncStats.failed} Failed`;
    if (hasPending) return `${syncStats?.pending || 0} Pending`;
    return 'Synced';
  };

  return (
    <>
      <IconButton onClick={handleClick} size="small" color="inherit">
        <Chip
          icon={getStatusIcon()}
          label={getStatusLabel()}
          color={getStatusColor()}
          size="small"
        />
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="h6" gutterBottom>
            Sync Status
          </Typography>

          {/* Network Status */}
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            {isOnline ? (
              <CloudDoneIcon color="success" />
            ) : (
              <CloudOffIcon color="disabled" />
            )}
            <Typography variant="body2">
              {isOnline ? 'Online' : 'Offline Mode'}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Sync Statistics */}
          {syncStats && (
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                Queue Statistics
              </Typography>
              <List dense>
                {syncStats.pending > 0 && (
                  <ListItem>
                    <ListItemText
                      primary={`${syncStats.pending} pending`}
                      secondary="Waiting to sync"
                    />
                  </ListItem>
                )}
                {syncStats.syncing > 0 && (
                  <ListItem>
                    <ListItemText
                      primary={`${syncStats.syncing} syncing`}
                      secondary="Currently syncing"
                    />
                    <CircularProgress size={20} />
                  </ListItem>
                )}
                {syncStats.failed > 0 && (
                  <ListItem>
                    <ListItemText
                      primary={`${syncStats.failed} failed`}
                      secondary="Will retry automatically"
                    />
                  </ListItem>
                )}
                {syncStats.synced > 0 && (
                  <ListItem>
                    <ListItemText
                      primary={`${syncStats.synced} synced`}
                      secondary="Ready to clear"
                    />
                  </ListItem>
                )}
                {syncStats.total === 0 && (
                  <ListItem>
                    <ListItemText primary="All synced!" secondary="No pending operations" />
                  </ListItem>
                )}
              </List>
            </Box>
          )}

          {/* Conflicts */}
          {conflicts > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {conflicts} conflict{conflicts > 1 ? 's' : ''} need{conflicts === 1 ? 's' : ''}{' '}
              resolution
            </Alert>
          )}

          {/* Actions */}
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleForceSync}
              disabled={!isOnline || syncStatus === 'syncing'}
              fullWidth
            >
              Force Sync
            </Button>
          </Box>
        </Box>
      </Popover>

      <style>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .rotating {
          animation: rotate 2s linear infinite;
        }
      `}</style>
    </>
  );
};

export default SyncStatusIndicator;
