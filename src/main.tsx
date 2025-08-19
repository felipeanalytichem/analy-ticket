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
  }
}

window.DatabaseService = DatabaseService;

// Expose utility functions globally for debugging/emergency use
import { clearSupabaseState } from './utils/clearSupabaseState';
import { sessionPersistence } from './services/SessionPersistenceService';

window.clearSupabaseState = clearSupabaseState;
window.refreshSession = () => sessionPersistence.forceRefresh();
window.getSessionStatus = () => sessionPersistence.getStatus();

// Force English language setting - PRESERVE AUTH TOKENS AND THEME
// Save important data before any clearing
const savedAuthToken = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token');
const savedCodeVerifier = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token-code-verifier');
const savedPersistentToken = localStorage.getItem('sb-persistent-auth-token');
const savedTheme = localStorage.getItem('vite-ui-theme'); // Preserve theme setting
const savedSessionPersist = localStorage.getItem('session-should-persist');

// Clear localStorage but preserve auth tokens and theme
localStorage.clear();
sessionStorage.clear();

// Restore auth tokens if they existed
if (savedAuthToken) {
  localStorage.setItem('sb-plbmgjqitlxedsmdqpld-auth-token', savedAuthToken);
}
if (savedCodeVerifier) {
  localStorage.setItem('sb-plbmgjqitlxedsmdqpld-auth-token-code-verifier', savedCodeVerifier);
}
if (savedPersistentToken) {
  localStorage.setItem('sb-persistent-auth-token', savedPersistentToken);
}
if (savedSessionPersist) {
  localStorage.setItem('session-should-persist', savedSessionPersist);
}

// Restore theme preference if it existed
if (savedTheme) {
  localStorage.setItem('vite-ui-theme', savedTheme);
}

// Set English language
localStorage.setItem('i18nextLng', 'en-US');
sessionStorage.setItem('i18nextLng', 'en-US');

// Force English language - but preserve theme preferences
const forceEnglishLanguage = () => {
  // Get current theme preference before clearing userPreferences
  let currentTheme = 'system'; // Default to system theme
  try {
    const existingPrefs = localStorage.getItem('userPreferences');
    if (existingPrefs) {
      const prefs = JSON.parse(existingPrefs);
      currentTheme = prefs.theme || 'system';
    }
  } catch (error) {
    // Could not parse existing preferences, use default
  }
  
  // Only clear language preferences, not theme
  localStorage.removeItem('userPreferences');
  localStorage.removeItem('i18nextLng');
  
  // Set English as the only language
  localStorage.setItem('i18nextLng', 'en-US');
  
  // Set default preferences in English BUT preserve theme choice
  const defaultPreferences = {
    language: 'en-US',
    soundNotifications: true,
    toastNotifications: true,
    notificationFrequency: 'realtime'
    // Note: theme is handled by ThemeProvider via 'vite-ui-theme' key
  };
  localStorage.setItem('userPreferences', JSON.stringify(defaultPreferences));

};

// Force English on every app start
forceEnglishLanguage();

// Create a single QueryClient instance for the whole app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors, let session recovery handle it
        if (error?.status === 401 || error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
      staleTime: 5 * 60 * 1000, // 5 minutes - longer to reduce pressure during idle periods
      gcTime: 10 * 60 * 1000, // 10 minutes - keep data longer for better UX during reconnection
      refetchOnReconnect: true, // Refetch when network reconnects
      refetchOnMount: false, // Don't always refetch on mount to use cached data during recovery
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
