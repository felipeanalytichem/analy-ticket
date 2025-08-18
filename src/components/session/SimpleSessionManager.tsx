import React from 'react';
import { ErrorNotificationProvider } from '@/components/error/ErrorNotificationSystem';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { SessionTimeoutManager } from '@/components/auth/SessionTimeoutManager';
import { SessionRecoveryProvider } from './SessionRecoveryProvider';

interface SimpleSessionManagerProps {
  children: React.ReactNode;
}

/**
 * A simplified session manager that provides error boundaries, notifications,
 * and session recovery without the complex connection monitoring that was causing issues.
 * This addresses the blank page issue by automatically recovering from session errors.
 */
export function SimpleSessionManager({ children }: SimpleSessionManagerProps) {
  return (
    <ErrorBoundary level="critical" showDetails={process.env.NODE_ENV === 'development'}>
      <ErrorNotificationProvider>
        <SessionRecoveryProvider>
          <SessionTimeoutManager>
            {children}
          </SessionTimeoutManager>
        </SessionRecoveryProvider>
      </ErrorNotificationProvider>
    </ErrorBoundary>
  );
}