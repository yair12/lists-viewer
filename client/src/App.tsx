import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/api/queryClient';
import { initDB } from './services/storage/indexedDB';
import { syncManager } from './services/offline/syncManager';
import { queueProcessor } from './services/offline/queueProcessor';
import { SyncDialogsProvider } from './services/offline/syncDialogsStore';
import { darkTheme } from './styles/theme';
import { USER_STORAGE_KEY } from './utils/constants';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import ListView from './pages/ListView';
import OfflineToggle from './components/Common/OfflineToggle';
import { ServiceWorkerUpdateNotification } from './components/Common/ServiceWorkerUpdateNotification';
import type { User } from './types';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize IndexedDB
        await initDB();
        console.log('[App] IndexedDB initialized');
        
        // Pre-load cache into React Query
        const { getCachedLists, getCachedItems } = await import('./services/storage/cacheManager');
        const cachedLists = await getCachedLists();
        if (cachedLists.length > 0) {
          queryClient.setQueryData(['lists'], cachedLists);
          console.log('[App] Pre-loaded', cachedLists.length, 'lists from IndexedDB cache');
        }
        
        // Pre-load items for each list
        const allCachedItems = await getCachedItems();
        if (allCachedItems.length > 0) {
          // Group items by listId
          const itemsByList = allCachedItems.reduce((acc, item) => {
            if (!acc[item.listId]) acc[item.listId] = [];
            acc[item.listId].push(item);
            return acc;
          }, {} as Record<string, typeof allCachedItems>);
          
          // Set cache for each list's items
          Object.entries(itemsByList).forEach(([listId, items]) => {
            queryClient.setQueryData(['items', listId], items);
          });
          console.log('[App] Pre-loaded', allCachedItems.length, 'items from IndexedDB cache');
        }
        
        // Start sync manager
        console.log('[App] Sync manager initialized and listening for network changes');
        
        // Start queue processor for background sync
        queueProcessor.start();
        console.log('[App] Queue processor started');
      } catch (error) {
        console.error('[App] Failed to initialize:', error);
      }
    };

    initializeApp();

    // Check if user exists in localStorage
    const userStr = localStorage.getItem(USER_STORAGE_KEY);
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
    setLoading(false);
    
    // Trigger initial sync if there are pending items
    setTimeout(() => {
      syncManager.startSync().catch((err) => {
        console.log('[App] Initial sync check:', err?.message || 'No pending items');
      });
    }, 1000);
  }, []);

  const handleOnboardingComplete = (userData: User) => {
    setUser(userData);
  };

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SyncDialogsProvider>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          {!user ? (
            <Onboarding onComplete={handleOnboardingComplete} />
          ) : (
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/lists/:listId" element={<ListView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          )}
          {/* Development-only offline testing toggle */}
          <OfflineToggle />
          {/* Service worker update notification */}
          <ServiceWorkerUpdateNotification />
        </ThemeProvider>
      </SyncDialogsProvider>
    </QueryClientProvider>
  );
}

export default App;
