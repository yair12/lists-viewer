/**
 * Development-only offline mode toggle for testing
 */
import { useState, useEffect } from 'react';
import { 
  Fab, 
  Tooltip, 
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { 
  WifiOff, 
  Wifi,
  Close,
} from '@mui/icons-material';
import { networkStatus } from '../../services/offline/networkStatus';

// Only show in development
const isDev = import.meta.env.DEV;

export default function OfflineToggle() {
  const [forceOffline, setForceOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const unsubscribe = networkStatus.addListener(() => {
      // Just listen for changes
    });

    return unsubscribe;
  }, []);

  if (!isDev) return null;

  const handleToggle = () => {
    const newForceOffline = !forceOffline;
    setForceOffline(newForceOffline);
    setShowBanner(newForceOffline);
    
    // Override the network status for testing
    if (newForceOffline) {
      // Simulate offline
      (networkStatus as any)._isOnline = false;
      (networkStatus as any).notifyListeners(false);
      console.log('[DEV] 🔴 Forced OFFLINE mode for testing');
    } else {
      // Restore online
      (networkStatus as any)._isOnline = true;
      (networkStatus as any).notifyListeners(true);
      console.log('[DEV] 🟢 Forced ONLINE mode restored');
    }
  };

  return (
    <>
      {/* Warning Banner */}
      {showBanner && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bgcolor: 'error.main',
            color: 'error.contrastText',
            py: 1,
            px: 2,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WifiOff />
            <Typography variant="body2" fontWeight="bold">
              DEV MODE: Offline Testing Enabled - All API calls will be queued
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setShowBanner(false)}
            sx={{ color: 'inherit' }}
          >
            <Close />
          </IconButton>
        </Box>
      )}

      {/* Floating Action Button */}
      <Tooltip 
        title={forceOffline ? "Click to go ONLINE (testing)" : "Click to go OFFLINE (testing)"}
        placement="left"
      >
        <Fab
          color={forceOffline ? "error" : "success"}
          onClick={handleToggle}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9998,
            opacity: 0.8,
            '&:hover': {
              opacity: 1,
            },
          }}
        >
          {forceOffline ? <WifiOff /> : <Wifi />}
        </Fab>
      </Tooltip>
    </>
  );
}
