import React, { createContext, useContext, useEffect } from 'react';
import { useSessionAnalytics } from '@/hooks/useSessionAnalytics';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

interface SessionAnalyticsContextType {
  trackSessionEvent: (type: string, metadata?: Record<string, any>) => void;
  trackPerformanceMetric: (type: string, value: number, unit: string, metadata?: Record<string, any>) => void;
  trackUserBehavior: (type: string, metadata?: Record<string, any>) => void;
  trackError: (error: Error, context?: Record<string, any>) => void;
  trackOfflineAction: (action: string, metadata?: Record<string, any>) => void;
  trackSyncOperation: (duration: number, success: boolean, metadata?: Record<string, any>) => void;
}

const SessionAnalyticsContext = createContext<SessionAnalyticsContextType | null>(null);

export function useSessionAnalyticsContext() {
  const context = useContext(SessionAnalyticsContext);
  if (!context) {
    throw new Error('useSessionAnalyticsContext must be used within SessionAnalyticsProvider');
  }
  return context;
}

interface SessionAnalyticsProviderProps {
  children: React.ReactNode;
}

export function SessionAnalyticsProvider({ children }: SessionAnalyticsProviderProps) {
  const analytics = useSessionAnalytics({
    enablePerformanceTracking: true,
    enableBehaviorTracking: true,
    trackPageViews: true,
    trackFormInteractions: true
  });

  const { sessionStatus } = useSessionManager();
  const { connectionStatus } = useConnectionMonitor();

  // Track session events
  useEffect(() => {
    if (sessionStatus.isActive) {
      analytics.trackSessionEvent('session_refresh', {
        expiresAt: sessionStatus.expiresAt,
        timeUntilExpiry: sessionStatus.timeUntilExpiry
      });
    }
  }, [sessionStatus.isActive, analytics]);

  // Track connection events
  useEffect(() => {
    if (connectionStatus.isOnline) {
      analytics.trackSessionEvent('connection_restored', {
        quality: connectionStatus.quality,
        latency: connectionStatus.latency,
        reconnectAttempts: connectionStatus.reconnectAttempts
      });
      
      if (connectionStatus.latency > 0) {
        analytics.trackPerformanceMetric(
          'connection_latency',
          connectionStatus.latency,
          'ms',
          { quality: connectionStatus.quality }
        );
      }
    } else {
      analytics.trackSessionEvent('connection_lost', {
        lastConnected: connectionStatus.lastConnected,
        reconnectAttempts: connectionStatus.reconnectAttempts
      });
    }
  }, [connectionStatus.isOnline, connectionStatus.quality, analytics]);

  // Track session warnings and expirations
  useEffect(() => {
    if (sessionStatus.timeUntilExpiry <= 5 * 60 * 1000 && sessionStatus.timeUntilExpiry > 0) {
      analytics.trackSessionEvent('session_warning', {
        timeUntilExpiry: sessionStatus.timeUntilExpiry,
        lastActivity: sessionStatus.lastActivity
      });
    }
  }, [sessionStatus.timeUntilExpiry, analytics]);

  const contextValue: SessionAnalyticsContextType = {
    trackSessionEvent: analytics.trackSessionEvent,
    trackPerformanceMetric: analytics.trackPerformanceMetric,
    trackUserBehavior: analytics.trackUserBehavior,
    trackError: analytics.trackError,
    trackOfflineAction: analytics.trackOfflineAction,
    trackSyncOperation: analytics.trackSyncOperation
  };

  return (
    <SessionAnalyticsContext.Provider value={contextValue}>
      {children}
    </SessionAnalyticsContext.Provider>
  );
}