import React from 'react'
import ReactDOM from 'react-dom/client'
import DatabaseService from './lib/database'
import App from './App.tsx'
import './index.css'
import './i18n'
import './lib/scheduledTasks' // Import scheduled tasks to auto-start them
import './utils/clearSupabaseState' // Auto-fix for _acquireLock errors
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Expose DatabaseService globally for debugging
declare global {
  interface Window {
    DatabaseService: typeof DatabaseService;
    clearSupabaseState: () => void;
    refreshSession: () => Promise<boolean>;
    getSessionStatus: () => any;
    testDatabaseConnection: () => Promise<any>;
    quickHealthCheck: () => Promise<boolean>;
    forceRefreshQueries: () => void;
    handleStuckLoading: () => void;
  }
}

window.DatabaseService = DatabaseService;

// Expose utility functions globally for debugging/emergency use
import { clearSupabaseState } from './utils/clearSupabaseState';
import { sessionPersistence } from './services/SessionPersistenceService';
import './utils/databaseConnectionTest'; // Auto-expose database testing utilities

window.clearSupabaseState = clearSupabaseState;
window.refreshSession = () => sessionPersistence.forceRefresh();
window.getSessionStatus = () => sessionPersistence.getStatus();

// Global query management utilities
window.forceRefreshQueries = () => {
  console.log('🔄 Force refreshing all queries...');
  queryClient.invalidateQueries();
  queryClient.refetchQueries({ type: 'active' });
};

window.handleStuckLoading = () => {
  console.log('🚨 Handling stuck loading state...');
  queryClient.cancelQueries();
  queryClient.refetchQueries({ type: 'active', stale: true });
};

// Initialize app without clearing localStorage to preserve persistent sessions
// Only set default language if not already configured
const initializeAppSettings = () => {
  // Set default language only if not already set
  const currentLanguage = localStorage.getItem('i18nextLng');
  if (!currentLanguage) {
    localStorage.setItem('i18nextLng', 'en-US');
    sessionStorage.setItem('i18nextLng', 'en-US');
  }
};

// Initialize app settings without clearing existing data
initializeAppSettings();

// Setup default user preferences (only if not already set)
const setupDefaultPreferences = () => {
  const existingPrefs = localStorage.getItem('userPreferences');
  if (!existingPrefs) {
    const defaultPreferences = {
      language: 'en-US',
      soundNotifications: true,
      toastNotifications: true,
      notificationFrequency: 'realtime'
      // Note: theme is handled by ThemeProvider via 'vite-ui-theme' key
    };
    localStorage.setItem('userPreferences', JSON.stringify(defaultPreferences));
  }
};

// Setup defaults only if needed (don't override existing preferences)
setupDefaultPreferences();

// Create a single QueryClient instance for the whole app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Refetch when user returns after idle
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors, let session recovery handle it
        if (error?.status === 401 || error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
      staleTime: 2 * 60 * 1000, // 2 minutes - shorter to ensure fresh data after idle
      gcTime: 10 * 60 * 1000, // 10 minutes - keep data longer for better UX during reconnection
      refetchOnReconnect: true, // Refetch when network reconnects
      refetchOnMount: true, // Refetch on mount to ensure fresh data after navigation
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry mutations on auth errors
        if (error?.status === 401 || error?.code === 'PGRST301') {
          return false;
        }
        return failureCount < 1; // Only retry mutations once
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
