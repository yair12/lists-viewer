import { Box } from '@mui/material';
import { ReactNode, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import OfflineIndicator from '../Common/OfflineIndicator';
import SyncDialogs from '../Common/SyncDialogs';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Header onMenuClick={handleDrawerToggle} />
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            p: 3,
          }}
        >
          {children}
        </Box>
      </Box>
      <OfflineIndicator />
      <SyncDialogs />
    </Box>
  );
}
