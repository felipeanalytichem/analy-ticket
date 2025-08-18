import { useEffect, useRef, useCallback } from 'react';
import { useCleanupManager } from './useCleanupManager';

interface MemoryLeakPreventionOptions {
  componentName: string;
  enableLogging?: boolean;
  trackEventListeners?: boolean;
  trackObservers?: boolean;
}

interface MemoryLeakPreventionReturn {
  addEventListenerWithCleanup: (
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) => void;
  addObserverWithCleanup: (
    observer: MutationObserver | IntersectionObserver | ResizeObserver,
    name?: string
  ) => void;
  addAsyncOperationCleanup: (
    operation: Promise<any>,
    name?: string
  ) => void;
  getMemoryUsage: () => number | null;
  logMemoryStatus: () => void;
}

export function useMemoryLeakPrevention({
  componentName,
  enableLogging = process.env.NODE_ENV === 'development',
  trackEventListeners = true,
  trackObservers = true
}: MemoryLeakPreventionOptions): MemoryLeakPreventionReturn {
  const cleanupManager = useCleanupManager();
  const eventListeners = useRef<Map<string, { element: EventTarget; event: string; handler: EventListener }>>(new Map());
  const observers = useRef<Map<string, MutationObserver | IntersectionObserver | ResizeObserver>>(new Map());
  const asyncOperations = useRef<Map<string, AbortController>>(new Map());
  const componentMountTime = useRef(Date.now());

  // Add event listener with automatic cleanup
  const addEventListenerWithCleanup = useCallback((
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) => {
    if (!trackEventListeners) {
      element.addEventListener(event, handler, options);
      return;
    }

    const listenerId = `${event}_${Date.now()}_${Math.random()}`;
    
    // Add the event listener
    element.addEventListener(event, handler, options);
    
    // Track it
    eventListeners.current.set(listenerId, { element, event, handler });
    
    // Add cleanup
    cleanupManager.addCleanup(() => {
      element.removeEventListener(event, handler);
      eventListeners.current.delete(listenerId);
      
      if (enableLogging) {
        console.log(`[MemoryLeak] Cleaned up event listener: ${event} for ${componentName}`);
      }
    }, `event_${listenerId}`);

    if (enableLogging) {
      console.log(`[MemoryLeak] Added event listener: ${event} for ${componentName}`);
    }
  }, [cleanupManager, componentName, enableLogging, trackEventListeners]);

  // Add observer with automatic cleanup
  const addObserverWithCleanup = useCallback((
    observer: MutationObserver | IntersectionObserver | ResizeObserver,
    name?: string
  ) => {
    if (!trackObservers) return;

    const observerId = name || `observer_${Date.now()}_${Math.random()}`;
    
    // Track it
    observers.current.set(observerId, observer);
    
    // Add cleanup
    cleanupManager.addCleanup(() => {
      observer.disconnect();
      observers.current.delete(observerId);
      
      if (enableLogging) {
        console.log(`[MemoryLeak] Cleaned up observer: ${observerId} for ${componentName}`);
      }
    }, `observer_${observerId}`);

    if (enableLogging) {
      console.log(`[MemoryLeak] Added observer: ${observerId} for ${componentName}`);
    }
  }, [cleanupManager, componentName, enableLogging, trackObservers]);

  // Add async operation with cleanup (for fetch requests, etc.)
  const addAsyncOperationCleanup = useCallback((
    operation: Promise<any>,
    name?: string
  ) => {
    const operationId = name || `async_${Date.now()}_${Math.random()}`;
    const abortController = new AbortController();
    
    // Track it
    asyncOperations.current.set(operationId, abortController);
    
    // Add cleanup
    cleanupManager.addCleanup(() => {
      abortController.abort();
      asyncOperations.current.delete(operationId);
      
      if (enableLogging) {
        console.log(`[MemoryLeak] Aborted async operation: ${operationId} for ${componentName}`);
      }
    }, `async_${operationId}`);

    // Clean up automatically when operation completes
    operation
      .finally(() => {
        asyncOperations.current.delete(operationId);
      })
      .catch(() => {
        // Ignore errors from aborted operations
      });

    if (enableLogging) {
      console.log(`[MemoryLeak] Added async operation: ${operationId} for ${componentName}`);
    }
  }, [cleanupManager, componentName, enableLogging]);

  // Get current memory usage (if available)
  const getMemoryUsage = useCallback((): number | null => {
    if ('memory' in performance) {
      return (performance as any).memory?.usedJSHeapSize || null;
    }
    return null;
  }, []);

  // Log current memory status
  const logMemoryStatus = useCallback(() => {
    const memoryUsage = getMemoryUsage();
    const uptime = Date.now() - componentMountTime.current;
    
    console.log(`[MemoryLeak] Status for ${componentName}:`, {
      uptime: `${(uptime / 1000).toFixed(2)}s`,
      memoryUsage: memoryUsage ? `${(memoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A',
      activeEventListeners: eventListeners.current.size,
      activeObservers: observers.current.size,
      activeAsyncOperations: asyncOperations.current.size,
      totalCleanups: cleanupManager.getActiveCleanups().length
    });
  }, [componentName, getMemoryUsage, cleanupManager]);

  // Log memory status on mount and unmount (in development)
  useEffect(() => {
    if (enableLogging) {
      console.log(`[MemoryLeak] Component mounted: ${componentName}`);
      logMemoryStatus();
    }

    return () => {
      if (enableLogging) {
        console.log(`[MemoryLeak] Component unmounting: ${componentName}`);
        logMemoryStatus();
      }
    };
  }, [componentName, enableLogging, logMemoryStatus]);

  // Periodic memory check in development
  useEffect(() => {
    if (!enableLogging) return;

    const intervalId = setInterval(() => {
      const activeCleanups = cleanupManager.getActiveCleanups().length;
      if (activeCleanups > 50) { // Warn if too many active cleanups
        console.warn(`[MemoryLeak] High cleanup count for ${componentName}: ${activeCleanups}`);
        logMemoryStatus();
      }
    }, 30000); // Check every 30 seconds

    cleanupManager.addTimer(intervalId, 'interval', 'memory_check');

    return () => {
      clearInterval(intervalId);
    };
  }, [componentName, enableLogging, cleanupManager, logMemoryStatus]);

  return {
    addEventListenerWithCleanup,
    addObserverWithCleanup,
    addAsyncOperationCleanup,
    getMemoryUsage,
    logMemoryStatus
  };
}