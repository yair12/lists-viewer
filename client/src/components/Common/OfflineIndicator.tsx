import { Chip } from '@mui/material';
import { Sync as SyncIcon, CloudOff as CloudOffIcon } from '@mui/icons-material';
import { useOfflineManager } from '../../hooks/useOfflineManager';

export default function OfflineIndicator() {
  const { isOnline, pendingCount } = useOfflineManager();

  // Don't show anything when online and fully synced
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <Chip
      icon={isOnline ? <SyncIcon /> : <CloudOffIcon />}
      label={
        isOnline
          ? `Syncing ${pendingCount} change${pendingCount !== 1 ? 's' : ''}...`
          : `Offline - ${pendingCount} pending`
      }
      color={isOnline ? 'warning' : 'error'}
      size="small"
      sx={{ 
        position: 'fixed', 
        bottom: 16, 
        right: 16, 
        zIndex: 1300, // Above most MUI components but below modals
        boxShadow: 2
      }}
    />
  );
}
