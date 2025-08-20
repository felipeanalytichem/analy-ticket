import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePersistentSession } from '@/hooks/usePersistentSession';
import { sessionPersistence } from '@/services/SessionPersistenceService';
import { useQueryClient } from '@tanstack/react-query';

interface PersistentSessionManagerProps {
  children: React.ReactNode;
}

/**
 * Component that manages persistent sessions
 * Ensures users stay logged in until they explicitly logout
 */
export function PersistentSessionManager({ children }: PersistentSessionManagerProps) {
  const { user } = useAuth();
  const { isSessionPersistent } = usePersistentSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user) {
      console.log('🔐 User authenticated - initializing persistent session');
      
      // Set the query client for data refetching
      sessionPersistence.setQueryClient(queryClient);
      
      // Start the session persistence service
      sessionPersistence.start();
      
      // Setup enhanced persistence features
      sessionPersistence.setupEnhancedPersistence();
    } else {
      console.log('👤 No user - session persistence not needed');
      // Service will stop automatically when user logs out
    }
  }, [user, queryClient]);

  // Debug info in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && user) {
      const logStatus = () => {
        const status = sessionPersistence.getStatus();
        console.log('📊 Persistent Session Status:', {
          user: user.email,
          isActive: status.isActive,
          lastRefresh: status.lastRefresh?.toLocaleTimeString(),
          hasKeepAlive: status.hasKeepAlive,
          isSessionPersistent
        });
      };

      // Log status every 5 minutes in development
      const statusInterval = setInterval(logStatus, 5 * 60 * 1000);
      
      // Log initial status
      logStatus();

      return () => {
        clearInterval(statusInterval);
      };
    }
  }, [user, isSessionPersistent]);

  return <>{children}</>;
}
