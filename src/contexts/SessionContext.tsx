import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { SessionManager, SessionStatus, SessionEventType } from '@/services/SessionManager';
import { TokenRefreshService } from '@/services/TokenRefreshService';
import { useAuth } from '@/contexts/AuthContext';

export interface SessionContextType {
  sessionManager: SessionManager | null;
  tokenRefreshService: TokenRefreshService | null;
  sessionStatus: SessionStatus;
  isInitialized: boolean;
  isSessionExpiring: boolean;
  expirationWarningTime: number | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export interface SessionProviderProps {
  children: ReactNode;
  sessionManager?: SessionManager;
  tokenRefreshService?: TokenRefreshService;
}

export function SessionProvider({ 
  children, 
  sessionManager: providedSessionManager,
  tokenRefreshService: providedTokenRefreshService 
}: SessionProviderProps) {
  const { session, isInitialized: authInitialized } = useAuth();
  
  // Use provided services or create new instances
  const [sessionManager] = useState(() => providedSessionManager || new SessionManager());
  const [tokenRefreshService] = useState(() => providedTokenRefreshService || new TokenRefreshService());
  
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(() => 
    sessionManager.getSessionStatus()
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSessionExpiring, setIsSessionExpiring] = useState(false);
  const [expirationWarningTime, setExpirationWarningTime] = useState<number | null>(null);

  /**
   * Update session status from SessionManager
   */
  const updateSessionStatus = useCallback(() => {
    const status = sessionManager.getSessionStatus();
    setSessionStatus(status);
  }, [sessionManager]);

  /**
   * Handle session expiring event
   */
  const handleSessionExpiring = useCallback((data: { timeLeft: number }) => {
    console.log('⚠️ Session expiring warning received:', data);
    setIsSessionExpiring(true);
    setExpirationWarningTime(data.timeLeft);
  }, []);

  /**
   * Handle session expired event
   */
  const handleSessionExpired = useCallback((data: any) => {
    console.log('❌ Session expired:', data);
    setIsSessionExpiring(false);
    setExpirationWarningTime(null);
    updateSessionStatus();
  }, [updateSessionStatus]);

  /**
   * Handle session refreshed event
   */
  const handleSessionRefreshed = useCallback((data: any) => {
    console.log('✅ Session refreshed:', data);
    setIsSessionExpiring(false);
    setExpirationWarningTime(null);
    updateSessionStatus();
  }, [updateSessionStatus]);

  /**
   * Handle session validated event
   */
  const handleSessionValidated = useCallback((data: any) => {
    console.log('✅ Session validated:', data);
    updateSessionStatus();
  }, [updateSessionStatus]);

  /**
   * Handle session terminated event
   */
  const handleSessionTerminated = useCallback((data: any) => {
    console.log('🚪 Session terminated:', data);
    setIsSessionExpiring(false);
    setExpirationWarningTime(null);
    updateSessionStatus();
  }, [updateSessionStatus]);

  /**
   * Initialize session management when auth is ready
   */
  useEffect(() => {
    if (!authInitialized) {
      return;
    }

    const initializeSession = async () => {
      try {
        console.log('🔐 SessionContext: Initializing session management...');

        // Set up event listeners
        sessionManager.onSessionExpiring(handleSessionExpiring);
        sessionManager.onSessionExpired(handleSessionExpired);
        sessionManager.onSessionRefreshed(handleSessionRefreshed);
        sessionManager.on('validated', handleSessionValidated);
        sessionManager.on('terminated', handleSessionTerminated);

        // Initialize session if we have an active auth session
        if (session) {
          await sessionManager.initializeSession();
        }

        // Update initial status
        updateSessionStatus();
        setIsInitialized(true);

        console.log('✅ SessionContext: Session management initialized');
      } catch (error) {
        console.error('❌ SessionContext: Failed to initialize session management:', error);
        setIsInitialized(true); // Still mark as initialized to prevent blocking
      }
    };

    initializeSession();

    // Cleanup function
    return () => {
      console.log('🧹 SessionContext: Cleaning up session management...');
      sessionManager.destroy();
      tokenRefreshService.destroy();
    };
  }, [
    authInitialized,
    session,
    sessionManager,
    tokenRefreshService,
    handleSessionExpiring,
    handleSessionExpired,
    handleSessionRefreshed,
    handleSessionValidated,
    handleSessionTerminated,
    updateSessionStatus
  ]);

  /**
   * Update session status periodically
   */
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const interval = setInterval(() => {
      updateSessionStatus();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [isInitialized, updateSessionStatus]);

  /**
   * Handle token refresh events
   */
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const handleTokenRefreshed = (data: any) => {
      console.log('🔄 Token refreshed:', data);
      updateSessionStatus();
    };

    const handleTokenSynced = (data: any) => {
      console.log('📡 Token synced from another tab:', data);
      updateSessionStatus();
    };

    const handleTokenFailed = (data: any) => {
      console.error('❌ Token refresh failed:', data);
      updateSessionStatus();
    };

    tokenRefreshService.on('refreshed', handleTokenRefreshed);
    tokenRefreshService.on('synced', handleTokenSynced);
    tokenRefreshService.on('failed', handleTokenFailed);

    return () => {
      tokenRefreshService.off('refreshed', handleTokenRefreshed);
      tokenRefreshService.off('synced', handleTokenSynced);
      tokenRefreshService.off('failed', handleTokenFailed);
    };
  }, [isInitialized, tokenRefreshService, updateSessionStatus]);

  const contextValue: SessionContextType = {
    sessionManager,
    tokenRefreshService,
    sessionStatus,
    isInitialized,
    isSessionExpiring,
    expirationWarningTime
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export { SessionContext };

/**
 * Hook to use session context
 */
export function useSessionContext(): SessionContextType {
  const context = useContext(SessionContext);
  
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  
  return context;
}