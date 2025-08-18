import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorNotificationProvider } from '@/components/error/ErrorNotificationSystem';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { OfflineModeIndicator, useOfflineMode } from '@/components/error/OfflineModeIndicator';
import { SessionTimeoutManager } from '@/components/auth/SessionTimeoutManager';
import { useEnhancedSession } from '@/hooks/useEnhancedSession';

interface EnhancedSessionManagerProps {
  children: React.ReactNode;
}

function SessionStatusIndicator() {
  const { user } = useAuth();
  const { sessionState } = useEnhancedSession();
  const offlineMode = useOfflineMode();

  if (!user) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <OfflineModeIndicator
        isOnline={offlineMode.isOnline}
        connectionQuality={offlineMode.connectionQuality}
        pendingActions={offlineMode.pendingActions}
        lastSyncTime={offlineMode.lastSyncTime}
        showDetails={false}
        className="text-sm"
      />
    </div>
  );
}

export function EnhancedSessionManager({ children }: EnhancedSessionManagerProps) {
  const { user } = useAuth();

  // Set up global error handling for session issues
  useEffect(() => {
    const handleSessionError = (error: any) => {
      console.log('🚨 Session error detected:', error);
      
      // Dispatch a custom event that can be handled by the enhanced session hook
      window.dispatchEvent(new CustomEvent('session-error', { detail: error }));
    };

    // Listen for authentication errors from API calls
    window.addEventListener('auth-error', handleSessionError);

    return () => {
      window.removeEventListener('auth-error', handleSessionError);
    };
  }, []);

  return (
    <ErrorBoundary level="critical" showDetails={process.env.NODE_ENV === 'development'}>
      <ErrorNotificationProvider>
        <SessionTimeoutManager>
          {children}
          <SessionStatusIndicator />
        </SessionTimeoutManager>
      </ErrorNotificationProvider>
    </ErrorBoundary>
  );
}