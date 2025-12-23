import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Avatar,
  Typography,
  CircularProgress,
} from '@mui/material';
import type { Icon } from '../../types';

interface ChangeAvatarDialogProps {
  open: boolean;
  onClose: () => void;
  currentIconId: string;
  icons: Icon[];
  onSave: (iconId: string) => Promise<void>;
}

export default function ChangeAvatarDialog({
  open,
  onClose,
  currentIconId,
  icons,
  onSave,
}: ChangeAvatarDialogProps) {
  const [selectedIconId, setSelectedIconId] = useState(currentIconId);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (selectedIconId === currentIconId) {
      onClose();
      return;
    }

    try {
      setLoading(true);
      await onSave(selectedIconId);
      onClose();
    } catch (error) {
      console.error('Failed to update avatar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Change Avatar</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {icons.map((icon) => (
            <Grid item xs={4} key={icon.id}>
              <Card
                variant={selectedIconId === icon.id ? 'outlined' : 'elevation'}
                sx={{
                  border: selectedIconId === icon.id ? 2 : 0,
                  borderColor: 'primary.main',
                }}
              >
                <CardActionArea onClick={() => setSelectedIconId(icon.id)}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Avatar
                      src={icon.url}
                      alt={icon.name}
                      sx={{ width: 60, height: 60, mx: 'auto' }}
                    />
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      {icon.name}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
