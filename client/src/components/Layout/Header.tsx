import { useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Avatar, Box } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { STORAGE_KEYS } from '../../utils/constants';
import { useIcons } from '../../hooks/useUser';
import { usersApi } from '../../services/api/users';
import ChangeAvatarDialog from '../Common/ChangeAvatarDialog';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  const user = userStr ? JSON.parse(userStr) : null;
  const { data: icons = [] } = useIcons();
  
  const userIcon = user && icons.find(icon => icon.id === user.iconId);

  const handleAvatarChange = async (iconId: string) => {
    if (!user) return;
    
    try {
      const updatedUser = await usersApi.updateIcon(user.username, iconId);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      window.location.reload(); // Reload to update all components
    } catch (error) {
      console.error('Failed to update avatar:', error);
      throw error;
    }
  };

  return (
    <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
          <img src="/icon.svg" alt="Snap" style={{ width: 32, height: 32 }} />
          <Typography variant="h6" component="div">
            Snap
          </Typography>
        </Box>

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {user.username}
            </Typography>
            <IconButton onClick={() => setAvatarDialogOpen(true)} size="small">
              <Avatar
                src={userIcon?.url}
                alt={user.username}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: user.color || 'primary.main',
                }}
              >
                {user.username.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>
        )}
      </Toolbar>
      
      {user && (
        <ChangeAvatarDialog
          open={avatarDialogOpen}
          onClose={() => setAvatarDialogOpen(false)}
          currentIconId={user.iconId}
          icons={icons}
          onSave={handleAvatarChange}
        />
      )}
    </AppBar>
  );
}
