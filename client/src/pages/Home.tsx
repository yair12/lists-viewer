import { Typography, Box } from '@mui/material';
import MainLayout from '../components/Layout/MainLayout';
import ListsGrid from '../components/Lists/ListsGrid';

export default function Home() {
  return (
    <MainLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          My Lists
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your lists and items
        </Typography>
      </Box>
      <ListsGrid />
    </MainLayout>
  );
}
