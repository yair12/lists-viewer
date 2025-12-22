import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Avatar,
  CircularProgress,
} from '@mui/material';
import { usersApi } from '../services/api/users';
import { USER_STORAGE_KEY } from '../utils/constants';
import type { User, Icon } from '../types';

interface OnboardingProps {
  onComplete: (user: User) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'username' | 'icon'>('username');
  const [username, setUsername] = useState('');
  const [selectedIconId, setSelectedIconId] = useState('');
  const [icons, setIcons] = useState<Icon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load icons when moving to icon selection step
  useEffect(() => {
    if (step === 'icon') {
      loadIcons();
    }
  }, [step]);

  const loadIcons = async () => {
    try {
      setLoading(true);
      const iconsData = await usersApi.getIcons();
      setIcons(iconsData);
      if (iconsData.length > 0) {
        setSelectedIconId(iconsData[0].id);
      }
    } catch (err) {
      setError('Failed to load icons');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    setError('');
    setStep('icon');
  };

  const handleIconSubmit = async () => {
    if (!selectedIconId) {
      setError('Please select an icon');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const user = await usersApi.init({
        username: username.trim(),
        iconId: selectedIconId,
      });
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      onComplete(user);
    } catch (err) {
      setError('Failed to initialize user');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 500,
          }}
        >
          {step === 'username' ? (
            <>
              <Typography variant="h4" gutterBottom align="center">
                Welcome to Lists Viewer
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph align="center">
                Let's get started! What should we call you?
              </Typography>
              <Box sx={{ mt: 3 }}>
                <TextField
                  fullWidth
                  label="Your Nickname"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUsernameSubmit()}
                  error={!!error}
                  helperText={error}
                  autoFocus
                  inputProps={{ maxLength: 50 }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleUsernameSubmit}
                  sx={{ mt: 3 }}
                >
                  Continue
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Typography variant="h4" gutterBottom align="center">
                Choose Your Avatar
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph align="center">
                Pick an icon that represents you
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <Grid container spacing={2} sx={{ mt: 2, mb: 3 }}>
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
                  {error && (
                    <Typography color="error" align="center" sx={{ mb: 2 }}>
                      {error}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setStep('username')}
                      disabled={loading}
                      fullWidth
                    >
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleIconSubmit}
                      disabled={loading}
                      fullWidth
                    >
                      {loading ? <CircularProgress size={24} /> : 'Get Started'}
                    </Button>
                  </Box>
                </>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
