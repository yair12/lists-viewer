import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  CircularProgress,
} from '@mui/material';
import { useState } from 'react';
import { useCreateList } from '../../hooks/useLists';

interface CreateListDialogProps {
  open: boolean;
  onClose: () => void;
}

const colors = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FFC107', '#FF9800', '#FF5722', '#795548',
];

export default function CreateListDialog({ open, onClose }: CreateListDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const createMutation = useCreateList();

  const handleClose = () => {
    setName('');
    setDescription('');
    setSelectedColor(colors[0]);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      color: selectedColor,
    };

    createMutation.mutate(payload, {
      onSettled: () => {
        handleClose();
      },
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New List</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="List Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              autoFocus
              disabled={createMutation.isPending}
            />
            
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              disabled={createMutation.isPending}
            />

            <Box>
              <Box sx={{ mb: 1, fontSize: '0.875rem', color: 'text.secondary' }}>
                Choose a color
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {colors.map((color) => (
                  <Box
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: color,
                      borderRadius: 1,
                      cursor: 'pointer',
                      border: 2,
                      borderColor: selectedColor === color ? 'primary.main' : 'transparent',
                      '&:hover': {
                        opacity: 0.8,
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={createMutation.isPending || !name.trim()}
          >
            {createMutation.isPending ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
