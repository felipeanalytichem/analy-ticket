import { useState, useCallback, useRef } from 'react';
import { NotificationWithTicket } from '@/lib/notificationService';
import { NotificationPagination } from '@/services/NotificationPagination';

interface LazyLoadingState {
  [notificationId: string]: {
    loading: boolean;
    data: NotificationWithTicket | null;
    error: string | null;
    lastLoaded: number;
  };
}

interface UseNotificationLazyLoadingOptions {
  cacheTimeout?: number; // Cache timeout in milliseconds
  maxCacheSize?: number; // Maximum number of cached items
}

export const useNotificationLazyLoading = (options: UseNotificationLazyLoadingOptions = {}) => {
  const { cacheTimeout = 5 * 60 * 1000, maxCacheSize = 100 } = options; // 5 minutes default cache
  
  const [state, setState] = useState<LazyLoadingState>({});
  const loadingPromises = useRef<Map<string, Promise<NotificationWithTicket | null>>>(new Map());

  // Clean up expired cache entries
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    setState(prevState => {
      const newState = { ...prevState };
      let cleanedCount = 0;

      Object.keys(newState).forEach(id => {
        const entry = newState[id];
        if (now - entry.lastLoaded > cacheTimeout) {
          delete newState[id];
          cleanedCount++;
        }
      });

      // If still over max size, remove oldest entries
      if (Object.keys(newState).length > maxCacheSize) {
        const entries = Object.entries(newState).sort(
          ([, a], [, b]) => a.lastLoaded - b.lastLoaded
        );
        
        const toRemove = entries.slice(0, entries.length - maxCacheSize);
        toRemove.forEach(([id]) => {
          delete newState[id];
          cleanedCount++;
        });
      }

      return cleanedCount > 0 ? newState : prevState;
    });
  }, [cacheTimeout, maxCacheSize]);

  // Load notification details
  const loadNotificationDetails = useCallback(async (notificationId: string): Promise<NotificationWithTicket | null> => {
    // Check if already loading
    const existingPromise = loadingPromises.current.get(notificationId);
    if (existingPromise) {
      return existingPromise;
    }

    // Check cache first
    const cached = state[notificationId];
    if (cached && !cached.loading && cached.data && (Date.now() - cached.lastLoaded < cacheTimeout)) {
      return cached.data;
    }

    // Set loading state
    setState(prevState => ({
      ...prevState,
      [notificationId]: {
        loading: true,
        data: cached?.data || null,
        error: null,
        lastLoaded: cached?.lastLoaded || 0
      }
    }));

    // Create loading promise
    const loadingPromise = NotificationPagination.loadNotificationDetails(notificationId)
      .then(data => {
        setState(prevState => ({
          ...prevState,
          [notificationId]: {
            loading: false,
            data,
            error: data ? null : 'Notification not found',
            lastLoaded: Date.now()
          }
        }));
        
        loadingPromises.current.delete(notificationId);
        return data;
      })
      .catch(error => {
        const errorMessage = error.message || 'Failed to load notification details';
        
        setState(prevState => ({
          ...prevState,
          [notificationId]: {
            loading: false,
            data: null,
            error: errorMessage,
            lastLoaded: Date.now()
          }
        }));
        
        loadingPromises.current.delete(notificationId);
        console.error('Error loading notification details:', error);
        return null;
      });

    loadingPromises.current.set(notificationId, loadingPromise);
    return loadingPromise;
  }, [state, cacheTimeout]);

  // Preload notification details (fire and forget)
  const preloadNotificationDetails = useCallback((notificationId: string) => {
    // Don't preload if already cached or loading
    const cached = state[notificationId];
    if (cached && (cached.loading || (cached.data && Date.now() - cached.lastLoaded < cacheTimeout))) {
      return;
    }

    // Fire and forget
    loadNotificationDetails(notificationId).catch(() => {
      // Silently fail preloading
    });
  }, [loadNotificationDetails, state, cacheTimeout]);

  // Batch preload multiple notifications
  const batchPreloadNotifications = useCallback((notificationIds: string[]) => {
    notificationIds.forEach(id => {
      // Add small delay between preloads to avoid overwhelming the server
      setTimeout(() => preloadNotificationDetails(id), Math.random() * 100);
    });
  }, [preloadNotificationDetails]);

  // Get cached notification details
  const getCachedNotificationDetails = useCallback((notificationId: string) => {
    return state[notificationId] || {
      loading: false,
      data: null,
      error: null,
      lastLoaded: 0
    };
  }, [state]);

  // Check if notification is loading
  const isLoading = useCallback((notificationId: string) => {
    return state[notificationId]?.loading || false;
  }, [state]);

  // Check if notification has error
  const hasError = useCallback((notificationId: string) => {
    return !!state[notificationId]?.error;
  }, [state]);

  // Get error message
  const getError = useCallback((notificationId: string) => {
    return state[notificationId]?.error || null;
  }, [state]);

  // Clear cache for specific notification
  const clearCache = useCallback((notificationId: string) => {
    setState(prevState => {
      const newState = { ...prevState };
      delete newState[notificationId];
      return newState;
    });
    loadingPromises.current.delete(notificationId);
  }, []);

  // Clear all cache
  const clearAllCache = useCallback(() => {
    setState({});
    loadingPromises.current.clear();
  }, []);

  // Get cache statistics
  const getCacheStats = useCallback(() => {
    const entries = Object.values(state);
    const now = Date.now();
    
    return {
      totalEntries: entries.length,
      loadingEntries: entries.filter(e => e.loading).length,
      cachedEntries: entries.filter(e => e.data && !e.loading).length,
      errorEntries: entries.filter(e => e.error && !e.loading).length,
      expiredEntries: entries.filter(e => now - e.lastLoaded > cacheTimeout).length,
      activePromises: loadingPromises.current.size
    };
  }, [state, cacheTimeout]);

  // Auto cleanup on interval
  const scheduleCleanup = useCallback(() => {
    const interval = setInterval(cleanupCache, cacheTimeout / 2);
    return () => clearInterval(interval);
  }, [cleanupCache, cacheTimeout]);

  return {
    // Core functions
    loadNotificationDetails,
    preloadNotificationDetails,
    batchPreloadNotifications,
    
    // State accessors
    getCachedNotificationDetails,
    isLoading,
    hasError,
    getError,
    
    // Cache management
    clearCache,
    clearAllCache,
    cleanupCache,
    scheduleCleanup,
    
    // Utilities
    getCacheStats
  };
};

export default useNotificationLazyLoading;