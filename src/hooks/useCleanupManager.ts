import { useRef, useEffect, useCallback } from 'react';

interface CleanupFunction {
  (): void;
}

interface TimerHandle {
  id: number | NodeJS.Timeout;
  type: 'timeout' | 'interval';
  name?: string;
}

interface SubscriptionHandle {
  unsubscribe: () => void;
  name?: string;
}

interface CleanupManagerReturn {
  addCleanup: (cleanup: CleanupFunction, name?: string) => void;
  addTimer: (id: number | NodeJS.Timeout, type: 'timeout' | 'interval', name?: string) => void;
  addSubscription: (subscription: SubscriptionHandle) => void;
  clearTimer: (id: number | NodeJS.Timeout) => void;
  clearSubscription: (name: string) => void;
  clearAll: () => void;
  getActiveCleanups: () => string[];
}

export function useCleanupManager(): CleanupManagerReturn {
  const cleanupFunctions = useRef<Map<string, CleanupFunction>>(new Map());
  const timers = useRef<Map<number | NodeJS.Timeout, TimerHandle>>(new Map());
  const subscriptions = useRef<Map<string, SubscriptionHandle>>(new Map());
  const cleanupCounter = useRef(0);

  // Add a cleanup function
  const addCleanup = useCallback((cleanup: CleanupFunction, name?: string) => {
    const cleanupName = name || `cleanup_${++cleanupCounter.current}`;
    cleanupFunctions.current.set(cleanupName, cleanup);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CleanupManager] Added cleanup: ${cleanupName}`);
    }
  }, []);

  // Add a timer for tracking
  const addTimer = useCallback((id: number | NodeJS.Timeout, type: 'timeout' | 'interval', name?: string) => {
    const timerHandle: TimerHandle = { id, type, name };
    timers.current.set(id, timerHandle);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CleanupManager] Added ${type}: ${name || id}`);
    }

    // Add cleanup function for this timer
    const cleanupName = `timer_${name || id}`;
    addCleanup(() => {
      if (type === 'timeout') {
        clearTimeout(id as NodeJS.Timeout);
      } else {
        clearInterval(id as NodeJS.Timeout);
      }
      timers.current.delete(id);
    }, cleanupName);
  }, [addCleanup]);

  // Add a subscription for tracking
  const addSubscription = useCallback((subscription: SubscriptionHandle) => {
    const subName = subscription.name || `subscription_${++cleanupCounter.current}`;
    subscriptions.current.set(subName, subscription);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CleanupManager] Added subscription: ${subName}`);
    }

    // Add cleanup function for this subscription
    addCleanup(() => {
      subscription.unsubscribe();
      subscriptions.current.delete(subName);
    }, `sub_${subName}`);
  }, [addCleanup]);

  // Clear a specific timer
  const clearTimer = useCallback((id: number | NodeJS.Timeout) => {
    const timer = timers.current.get(id);
    if (timer) {
      if (timer.type === 'timeout') {
        clearTimeout(id as NodeJS.Timeout);
      } else {
        clearInterval(id as NodeJS.Timeout);
      }
      timers.current.delete(id);
      
      // Remove associated cleanup
      const cleanupName = `timer_${timer.name || id}`;
      cleanupFunctions.current.delete(cleanupName);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CleanupManager] Cleared ${timer.type}: ${timer.name || id}`);
      }
    }
  }, []);

  // Clear a specific subscription
  const clearSubscription = useCallback((name: string) => {
    const subscription = subscriptions.current.get(name);
    if (subscription) {
      subscription.unsubscribe();
      subscriptions.current.delete(name);
      
      // Remove associated cleanup
      cleanupFunctions.current.delete(`sub_${name}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CleanupManager] Cleared subscription: ${name}`);
      }
    }
  }, []);

  // Clear all cleanups
  const clearAll = useCallback(() => {
    const cleanupCount = cleanupFunctions.current.size;
    const timerCount = timers.current.size;
    const subscriptionCount = subscriptions.current.size;

    // Execute all cleanup functions
    cleanupFunctions.current.forEach((cleanup, name) => {
      try {
        cleanup();
      } catch (error) {
        console.error(`[CleanupManager] Error in cleanup ${name}:`, error);
      }
    });

    // Clear all maps
    cleanupFunctions.current.clear();
    timers.current.clear();
    subscriptions.current.clear();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[CleanupManager] Cleared all: ${cleanupCount} cleanups, ${timerCount} timers, ${subscriptionCount} subscriptions`);
    }
  }, []);

  // Get list of active cleanups (for debugging)
  const getActiveCleanups = useCallback((): string[] => {
    return [
      ...Array.from(cleanupFunctions.current.keys()),
      ...Array.from(timers.current.values()).map(t => `timer_${t.name || t.id}`),
      ...Array.from(subscriptions.current.keys()).map(s => `sub_${s}`)
    ];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAll();
    };
  }, [clearAll]);

  return {
    addCleanup,
    addTimer,
    addSubscription,
    clearTimer,
    clearSubscription,
    clearAll,
    getActiveCleanups
  };
}