import React from 'react';
import { ErrorNotificationProvider } from '@/components/error/ErrorNotificationSystem';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { SessionRecoveryProvider } from './SessionRecoveryProvider';
import { ConnectionMonitor } from '@/components/auth/ConnectionMonitor';
import { PersistentSessionManager } from './PersistentSessionManager';

interface SimpleSessionManagerProps {
  children: React.ReactNode;
}

/**
 * Session manager that provides persistent sessions, error boundaries, notifications,
 * and session recovery. Sessions remain active until user explicitly logs out.
 */
export function SimpleSessionManager({ children }: SimpleSessionManagerProps) {
  return (
    <ErrorBoundary level="critical" showDetails={process.env.NODE_ENV === 'development'}>
      <ErrorNotificationProvider>
        <SessionRecoveryProvider>
          <PersistentSessionManager>
            {children}
            <ConnectionMonitor />
          </PersistentSessionManager>
        </SessionRecoveryProvider>
      </ErrorNotificationProvider>
    </ErrorBoundary>
  );
}