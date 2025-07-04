import React from 'react'
import ReactDOM from 'react-dom/client'
import DatabaseService from './lib/database'
import App from './App.tsx'
import './index.css'
import './i18n'
import './lib/scheduledTasks' // Import scheduled tasks to auto-start them
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Expose DatabaseService globally for debugging
declare global {
  interface Window {
    DatabaseService: typeof DatabaseService;
  }
}

window.DatabaseService = DatabaseService;

// Force English language setting - PRESERVE AUTH TOKENS AND THEME
// Save important data before any clearing
const savedAuthToken = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token');
const savedCodeVerifier = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token-code-verifier');
const savedTheme = localStorage.getItem('vite-ui-theme'); // Preserve theme setting

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
      retry: 1,
      staleTime: 1000 * 60, // 1 min
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
