import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { sessionAnalyticsLogger } from '@/services/SessionAnalyticsLogger';

interface UseSessionAnalyticsOptions {
  enablePerformanceTracking?: boolean;
  enableBehaviorTracking?: boolean;
  trackPageViews?: boolean;
  trackFormInteractions?: boolean;
}

export function useSessionAnalytics(options: UseSessionAnalyticsOptions = {}) {
  const { user } = useAuth();
  const {
    enablePerformanceTracking = true,
    enableBehaviorTracking = true,
    trackPageViews = true,
    trackFormInteractions = true
  } = options;

  const sessionStartTime = useRef<number>(Date.now());
  const lastActivityTime = useRef<number>(Date.now());
  const performanceObserver = useRef<PerformanceObserver | null>(null);

  // Track session start
  useEffect(() => {
    if (user) {
      sessionAnalyticsLogger.logSessionEvent('session_start', {
        userId: user.id,
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      sessionStartTime.current = Date.now();
    }
  }, [user]);

  // Track session end on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        const sessionDuration = Date.now() - sessionStartTime.current;
        sessionAnalyticsLogger.logSessionEvent('session_end', {
          sessionDuration,
          lastActivity: lastActivityTime.current
        });
        sessionAnalyticsLogger.logPerformanceMetric(
          'session_duration',
          sessionDuration,
          'ms',
          { endReason: 'page_unload' }
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [user]);

  // Track page views
  useEffect(() => {
    if (trackPageViews && enableBehaviorTracking) {
      sessionAnalyticsLogger.logUserBehavior('page_view', {
        path: window.location.pathname,
        search: window.location.search,
        referrer: document.referrer,
        timestamp: Date.now()
      });
    }
  }, [trackPageViews, enableBehaviorTracking]);

  // Track user activity
  useEffect(() => {
    if (!enableBehaviorTracking) return;

    const updateActivity = () => {
      lastActivityTime.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [enableBehaviorTracking]);

  // Track performance metrics
  useEffect(() => {
    if (!enablePerformanceTracking) return;

    // Track navigation timing
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const navigationStart = timing.navigationStart;
      
      if (timing.loadEventEnd > 0) {
        const pageLoadTime = timing.loadEventEnd - navigationStart;
        sessionAnalyticsLogger.logPerformanceMetric(
          'connection_latency',
          pageLoadTime,
          'ms',
          { type: 'page_load' }
        );
      }
    }

    // Set up performance observer for resource timing
    if ('PerformanceObserver' in window) {
      performanceObserver.current = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            sessionAnalyticsLogger.logPerformanceMetric(
              'connection_latency',
              navEntry.responseEnd - navEntry.requestStart,
              'ms',
              { type: 'navigation', name: navEntry.name }
            );
          } else if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.name.includes('/api/') || resourceEntry.name.includes('supabase')) {
              sessionAnalyticsLogger.logPerformanceMetric(
                'connection_latency',
                resourceEntry.responseEnd - resourceEntry.requestStart,
                'ms',
                { type: 'api_call', name: resourceEntry.name }
              );
            }
          }
        });
      });

      performanceObserver.current.observe({ 
        entryTypes: ['navigation', 'resource'] 
      });
    }

    return () => {
      if (performanceObserver.current) {
        performanceObserver.current.disconnect();
      }
    };
  }, [enablePerformanceTracking]);

  // Track form interactions
  useEffect(() => {
    if (!trackFormInteractions || !enableBehaviorTracking) return;

    const handleFormInteraction = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        sessionAnalyticsLogger.logUserBehavior('form_interaction', {
          elementType: target.tagName.toLowerCase(),
          elementName: target.getAttribute('name') || target.getAttribute('id'),
          eventType: event.type,
          formId: target.closest('form')?.getAttribute('id')
        });
      }
    };

    document.addEventListener('focus', handleFormInteraction, true);
    document.addEventListener('change', handleFormInteraction, true);

    return () => {
      document.removeEventListener('focus', handleFormInteraction, true);
      document.removeEventListener('change', handleFormInteraction, true);
    };
  }, [trackFormInteractions, enableBehaviorTracking]);

  // Utility functions for manual tracking
  const trackSessionEvent = useCallback((
    type: 'session_refresh' | 'session_warning' | 'session_expired' | 'token_refresh' | 'connection_lost' | 'connection_restored' | 'offline_mode' | 'sync_completed' | 'error_occurred',
    metadata: Record<string, any> = {}
  ) => {
    sessionAnalyticsLogger.logSessionEvent(type, metadata);
  }, []);

  const trackPerformanceMetric = useCallback((
    type: 'session_duration' | 'connection_latency' | 'sync_time' | 'error_recovery_time' | 'offline_duration',
    value: number,
    unit: 'ms' | 'seconds' | 'minutes' | 'count',
    metadata: Record<string, any> = {}
  ) => {
    sessionAnalyticsLogger.logPerformanceMetric(type, value, unit, metadata);
  }, []);

  const trackUserBehavior = useCallback((
    type: 'page_view' | 'form_interaction' | 'offline_action' | 'manual_sync' | 'session_extension' | 'error_recovery_attempt',
    metadata: Record<string, any> = {}
  ) => {
    sessionAnalyticsLogger.logUserBehavior(type, metadata);
  }, []);

  const trackError = useCallback((error: Error, context: Record<string, any> = {}) => {
    sessionAnalyticsLogger.logSessionEvent('error_occurred', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      context,
      url: window.location.href,
      timestamp: Date.now()
    });
  }, []);

  const trackOfflineAction = useCallback((action: string, metadata: Record<string, any> = {}) => {
    sessionAnalyticsLogger.logUserBehavior('offline_action', {
      action,
      ...metadata,
      isOnline: navigator.onLine
    });
  }, []);

  const trackSyncOperation = useCallback((
    duration: number,
    success: boolean,
    metadata: Record<string, any> = {}
  ) => {
    sessionAnalyticsLogger.logPerformanceMetric('sync_time', duration, 'ms', {
      success,
      ...metadata
    });
    
    if (success) {
      sessionAnalyticsLogger.logSessionEvent('sync_completed', metadata);
    }
  }, []);

  return {
    trackSessionEvent,
    trackPerformanceMetric,
    trackUserBehavior,
    trackError,
    trackOfflineAction,
    trackSyncOperation,
    getSessionDuration: () => Date.now() - sessionStartTime.current,
    getLastActivityTime: () => lastActivityTime.current
  };
}