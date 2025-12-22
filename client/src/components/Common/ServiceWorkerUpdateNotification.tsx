import { useEffect, useState } from 'react';
import { Alert, Button, Snackbar } from '@mui/material';

export const ServiceWorkerUpdateNotification = () => {
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setShowUpdateNotification(true);
    };

    window.addEventListener('sw-update-available', handleUpdate);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, []);

  const handleUpdate = () => {
    // Reload the page to activate the new service worker
    window.location.reload();
  };

  const handleClose = () => {
    setShowUpdateNotification(false);
  };

  return (
    <Snackbar
      open={showUpdateNotification}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={handleClose}
    >
      <Alert
        severity="info"
        sx={{ width: '100%' }}
        action={
          <>
            <Button color="inherit" size="small" onClick={handleUpdate}>
              Update
            </Button>
            <Button color="inherit" size="small" onClick={handleClose}>
              Later
            </Button>
          </>
        }
      >
        A new version is available! Click Update to refresh.
      </Alert>
    </Snackbar>
  );
};
