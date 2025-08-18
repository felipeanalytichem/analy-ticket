import { useContext, useEffect, useState, useCallback } from 'react';
import { SessionContext } from '@/contexts/SessionContext';
import { SessionStatus } from '@/services/SessionManager';

export interface UseSessionManagerReturn {
  sessionStatus: SessionStatus;
  isSessionActive: boolean;
  timeUntilExpiry: number;
  lastActivity: Date;
  extendSession: () => Promise<boolean>;
  terminateSession: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateActivity: () => void;
}

/**
 * Hook for managing session state and operations
 */
export function useSessionManager(): UseSessionManagerReturn {
  const context = useContext(SessionContext);
  
  if (!context) {
    throw new Error('useSessionManager must be used within a SessionProvider');
  }

  const {
    sessionManager,
    sessionStatus,
    isInitialized
  } = context;

  const [localSessionStatus, setLocalSessionStatus] = useState<SessionStatus>(sessionStatus);

  // Update local state when context changes
  useEffect(() => {
    setLocalSessionStatus(sessionStatus);
  }, [sessionStatus]);

  /**
   * Extend the current session
   */
  const extendSession = useCallback(async (): Promise<boolean> => {
    if (!sessionManager) {
      console.warn('SessionManager not available');
      return false;
    }

    try {
      const result = await sessionManager.refreshSession();
      if (result) {
        console.log('✅ Session extended successfully');
      }
      return result;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }, [sessionManager]);

  /**
   * Terminate the current session
   */
  const terminateSession = useCallback(async (): Promise<void> => {
    if (!sessionManager) {
      console.warn('SessionManager not available');
      return;
    }

    try {
      await sessionManager.terminateSession();
      console.log('✅ Session terminated successfully');
    } catch (error) {
      console.error('Failed to terminate session:', error);
      throw error;
    }
  }, [sessionManager]);

  /**
   * Manually refresh the session
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!sessionManager) {
      console.warn('SessionManager not available');
      return false;
    }

    try {
      const result = await sessionManager.refreshSession();
      if (result) {
        console.log('✅ Session refreshed successfully');
      }
      return result;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
  }, [sessionManager]);

  /**
   * Update user activity timestamp
   */
  const updateActivity = useCallback((): void => {
    if (!sessionManager) {
      return;
    }

    sessionManager.updateActivity();
  }, [sessionManager]);

  return {
    sessionStatus: localSessionStatus,
    isSessionActive: localSessionStatus.isActive,
    timeUntilExpiry: localSessionStatus.timeUntilExpiry,
    lastActivity: localSessionStatus.lastActivity,
    extendSession,
    terminateSession,
    refreshSession,
    updateActivity
  };
}