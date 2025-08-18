import React, { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { navigationStateManager, QueuedNavigation } from '@/services/NavigationStateManager';

export interface UseNavigationPersistenceOptions {
  /**
   * Whether to automatically save navigation state
   * @default true
   */
  autoSave?: boolean;
  
  /**
   * Whether to restore navigation state on mount
   * @default true
   */
  restoreOnMount?: boolean;
  
  /**
   * Callback when navigation is queued due to offline status
   */
  onNavigationQueued?: (navigation: QueuedNavigation) => void;
  
  /**
   * Callback when queued navigation is processed
   */
  onNavigationProcessed?: (navigation: QueuedNavigation) => void;
  
  /**
   * Callback when navigation fails after retries
   */
  onNavigationFailed?: (navigation: QueuedNavigation, error: any) => void;
}

export interface UseNavigationPersistenceReturn {
  /**
   * Navigate with offline support (queues navigation if offline)
   */
  navigateWithPersistence: (path: string, options?: { replace?: boolean; state?: any }) => void;
  
  /**
   * Manually save current navigation state
   */
  saveCurrentState: () => Promise<void>;
  
  /**
   * Restore saved navigation state
   */
  restoreState: () => Promise<void>;
  
  /**
   * Clear saved navigation state
   */
  clearSavedState: () => Promise<void>;
  
  /**
   * Get number of queued navigations
   */
  getQueuedNavigationCount: () => number;
  
  /**
   * Clear all queued navigations
   */
  clearNavigationQueue: () => Promise<void>;
  
  /**
   * Check if navigation manager is online
   */
  isOnline: boolean;
}

/**
 * Hook for navigation state persistence and offline navigation support
 * 
 * @param options - Configuration options
 * @returns Object with navigation persistence methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { 
 *     navigateWithPersistence, 
 *     saveCurrentState, 
 *     isOnline 
 *   } = useNavigationPersistence({
 *     onNavigationQueued: (nav) => console.log('Navigation queued:', nav),
 *     onNavigationProcessed: (nav) => console.log('Navigation processed:', nav)
 *   });
 * 
 *   const handleNavigate = () => {
 *     // This will queue the navigation if offline
 *     navigateWithPersistence('/dashboard', { state: { from: 'home' } });
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleNavigate}>
 *         Go to Dashboard {!isOnline && '(will queue)'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useNavigationPersistence(
  options: UseNavigationPersistenceOptions = {}
): UseNavigationPersistenceReturn {
  const {
    autoSave = true,
    restoreOnMount = true,
    onNavigationQueued,
    onNavigationProcessed,
    onNavigationFailed
  } = options;

  const location = useLocation();
  const navigate = useNavigate();
  const hasRestoredRef = useRef(false);
  const isOnlineRef = useRef(navigationStateManager.isOnline());

  // Update online status ref
  useEffect(() => {
    isOnlineRef.current = navigationStateManager.isOnline();
  });

  // Auto-save navigation state when location changes
  useEffect(() => {
    if (autoSave && hasRestoredRef.current) {
      const searchParams = new URLSearchParams(location.search);
      navigationStateManager.saveNavigationState(
        location.pathname + location.search,
        searchParams,
        location.state
      );
    }
  }, [location, autoSave]);

  // Restore navigation state on mount
  useEffect(() => {
    if (restoreOnMount && !hasRestoredRef.current) {
      restoreState().then(() => {
        hasRestoredRef.current = true;
      });
    }
  }, [restoreOnMount]);

  // Set up event listeners
  useEffect(() => {
    if (onNavigationQueued) {
      navigationStateManager.onNavigationQueued(onNavigationQueued);
    }
    
    if (onNavigationProcessed) {
      navigationStateManager.onNavigationProcessed(onNavigationProcessed);
    }
    
    if (onNavigationFailed) {
      navigationStateManager.onNavigationFailed(onNavigationFailed);
    }
  }, [onNavigationQueued, onNavigationProcessed, onNavigationFailed]);

  const navigateWithPersistence = useCallback((
    path: string, 
    options: { replace?: boolean; state?: any } = {}
  ) => {
    const { replace = false, state } = options;

    if (navigationStateManager.isOnline()) {
      // Navigate immediately if online
      navigate(path, { replace, state });
    } else {
      // Queue navigation if offline
      navigationStateManager.queueNavigation({
        type: replace ? 'replace' : 'push',
        path,
        state,
        maxRetries: 3
      });
    }
  }, [navigate]);

  const saveCurrentState = useCallback(async (): Promise<void> => {
    const searchParams = new URLSearchParams(location.search);
    await navigationStateManager.saveNavigationState(
      location.pathname + location.search,
      searchParams,
      location.state
    );
  }, [location]);

  const restoreState = useCallback(async (): Promise<void> => {
    try {
      const savedState = await navigationStateManager.restoreNavigationState();
      
      if (savedState && savedState.currentPath !== location.pathname + location.search) {
        // Only restore if it's different from current location
        navigate(savedState.currentPath, { 
          replace: true, 
          state: savedState.state 
        });
      }
    } catch (error) {
      console.error('Failed to restore navigation state:', error);
    }
  }, [location, navigate]);

  const clearSavedState = useCallback(async (): Promise<void> => {
    await navigationStateManager.clearNavigationState();
  }, []);

  const getQueuedNavigationCount = useCallback((): number => {
    return navigationStateManager['navigationQueue']?.length || 0;
  }, []);

  const clearNavigationQueue = useCallback(async (): Promise<void> => {
    await navigationStateManager.clearNavigationQueue();
  }, []);

  return {
    navigateWithPersistence,
    saveCurrentState,
    restoreState,
    clearSavedState,
    getQueuedNavigationCount,
    clearNavigationQueue,
    isOnline: isOnlineRef.current
  };
}

/**
 * Hook to monitor navigation queue status
 */
export function useNavigationQueue() {
  const [queuedCount, setQueuedCount] = React.useState(0);
  const [isProcessing, setIsProcessing] = React.useState(false);

  useEffect(() => {
    const updateQueueCount = () => {
      const count = navigationStateManager['navigationQueue']?.length || 0;
      setQueuedCount(count);
    };

    const handleNavigationQueued = () => {
      updateQueueCount();
    };

    const handleNavigationProcessed = () => {
      updateQueueCount();
      setIsProcessing(false);
    };

    const handleNavigationFailed = () => {
      updateQueueCount();
      setIsProcessing(false);
    };

    // Set up listeners
    navigationStateManager.onNavigationQueued(handleNavigationQueued);
    navigationStateManager.onNavigationProcessed(handleNavigationProcessed);
    navigationStateManager.onNavigationFailed(handleNavigationFailed);

    // Initial count
    updateQueueCount();

    // Check if processing
    if (queuedCount > 0 && navigationStateManager.isOnline()) {
      setIsProcessing(true);
    }

  }, [queuedCount]);

  return {
    queuedCount,
    isProcessing,
    hasQueuedNavigations: queuedCount > 0
  };
}