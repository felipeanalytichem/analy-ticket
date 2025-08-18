import { useEffect, useCallback, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useErrorNotifications } from '@/components/error/ErrorNotificationSystem';

interface SessionState {
  isValid: boolean;
  isRefreshing: boolean;
  lastRefresh: Date | null;
  retryCount: number;
  connectionStatus: 'online' | 'offline' | 'poor';
}

const MAX_RETRY_ATTEMPTS = 3;
const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
const HEALTH_CHECK_INTERVAL = 30 * 1000; // 30 seconds

export function useEnhancedSession() {
  const { user, signOut } = useAuth();
  const { showError, showWarning, showSuccess, showNetworkError } = useErrorNotifications();
  
  const [sessionState, setSessionState] = useState<SessionState>({
    isValid: true,
    isRefreshing: false,
    lastRefresh: null,
    retryCount: 0,
    connectionStatus: 'online'
  });

  const healthCheckInterval = useRef<NodeJS.Timeout>();
  const refreshPromise = useRef<Promise<boolean> | null>(null);

  // Check if session is still valid
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session validation error:', error);
        return false;
      }

      if (!session) {
        console.log('No active session found');
        return false;
      }

      // Check if token is about to expire
      const now = new Date().getTime();
      const expiresAt = new Date(session.expires_at! * 1000).getTime();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= 0) {
        console.log('Session has expired');
        return false;
      }

      // If session is about to expire, try to refresh it
      if (timeUntilExpiry <= REFRESH_THRESHOLD) {
        console.log('Session is about to expire, attempting refresh...');
        return await refreshSession();
      }

      return true;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }, []);

  // Refresh the session
  const refreshSession = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous refresh attempts
    if (refreshPromise.current) {
      return refreshPromise.current;
    }

    setSessionState(prev => ({ ...prev, isRefreshing: true }));

    refreshPromise.current = (async () => {
      try {
        console.log('🔄 Attempting to refresh session...');
        
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error || !data.session) {
          console.error('Session refresh failed:', error);
          
          setSessionState(prev => ({
            ...prev,
            isRefreshing: false,
            isValid: false,
            retryCount: prev.retryCount + 1
          }));

          // Show error notification
          if (sessionState.retryCount < MAX_RETRY_ATTEMPTS) {
            showWarning(
              'Session Refresh Failed',
              `Attempting to refresh your session... (${sessionState.retryCount + 1}/${MAX_RETRY_ATTEMPTS})`,
              {
                actions: [{
                  label: 'Retry Now',
                  action: () => refreshSession()
                }]
              }
            );
          } else {
            showError(
              'Session Expired',
              'Your session has expired and could not be refreshed. Please log in again.',
              {
                actions: [{
                  label: 'Log In',
                  action: () => signOut()
                }]
              }
            );
            
            // Force logout after max retries
            setTimeout(() => signOut(), 3000);
          }

          return false;
        }

        console.log('✅ Session refreshed successfully');
        
        setSessionState(prev => ({
          ...prev,
          isRefreshing: false,
          isValid: true,
          lastRefresh: new Date(),
          retryCount: 0
        }));

        showSuccess('Session Refreshed', 'Your session has been refreshed successfully.');
        
        return true;
      } catch (error) {
        console.error('Unexpected error during session refresh:', error);
        
        setSessionState(prev => ({
          ...prev,
          isRefreshing: false,
          isValid: false,
          retryCount: prev.retryCount + 1
        }));

        showNetworkError(
          'Failed to refresh session due to network error.',
          () => refreshSession()
        );

        return false;
      } finally {
        refreshPromise.current = null;
      }
    })();

    return refreshPromise.current;
  }, [sessionState.retryCount, showWarning, showError, showSuccess, showNetworkError, signOut]);

  // Perform health check
  const performHealthCheck = useCallback(async () => {
    if (!user) return;

    try {
      // Simple health check - try to get user profile
      const { error } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (error) {
        console.warn('Health check failed:', error);
        
        // If it's an auth error, try to refresh session
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          console.log('Auth error detected during health check, refreshing session...');
          await refreshSession();
        }
        
        setSessionState(prev => ({ 
          ...prev, 
          connectionStatus: 'poor',
          isValid: false 
        }));
      } else {
        setSessionState(prev => ({ 
          ...prev, 
          connectionStatus: 'online',
          isValid: true 
        }));
      }
    } catch (error) {
      console.error('Health check error:', error);
      setSessionState(prev => ({ 
        ...prev, 
        connectionStatus: 'offline' 
      }));
    }
  }, [user, refreshSession]);

  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network connection restored');
      setSessionState(prev => ({ ...prev, connectionStatus: 'online' }));
      
      // Perform immediate health check when coming back online
      if (user) {
        performHealthCheck();
      }
    };

    const handleOffline = () => {
      console.log('📡 Network connection lost');
      setSessionState(prev => ({ ...prev, connectionStatus: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, performHealthCheck]);

  // Set up periodic health checks
  useEffect(() => {
    if (user) {
      console.log('🏥 Starting session health checks...');
      
      // Immediate health check
      performHealthCheck();
      
      // Set up periodic checks
      healthCheckInterval.current = setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL);
    } else {
      console.log('🛑 Stopping session health checks');
      
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
        healthCheckInterval.current = undefined;
      }
    }

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
      }
    };
  }, [user, performHealthCheck]);

  // Listen for auth state changes from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event);
        
        switch (event) {
          case 'TOKEN_REFRESHED':
            console.log('✅ Token refreshed by Supabase');
            setSessionState(prev => ({
              ...prev,
              isValid: true,
              lastRefresh: new Date(),
              retryCount: 0
            }));
            break;
            
          case 'SIGNED_OUT':
            console.log('👋 User signed out');
            setSessionState({
              isValid: false,
              isRefreshing: false,
              lastRefresh: null,
              retryCount: 0,
              connectionStatus: 'offline'
            });
            break;
            
          case 'SIGNED_IN':
            console.log('👤 User signed in');
            setSessionState(prev => ({
              ...prev,
              isValid: true,
              retryCount: 0
            }));
            break;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Listen for session errors from the global error handler
  useEffect(() => {
    const handleSessionError = (event: CustomEvent) => {
      const error = event.detail;
      console.log('🚨 Handling session error:', error);
      
      // If it's an auth error, try to refresh the session
      if (error.status === 401 || error.code === 'PGRST301' || error.message?.includes('JWT')) {
        console.log('🔄 Auth error detected, attempting session refresh...');
        refreshSession();
      }
    };

    window.addEventListener('session-error', handleSessionError as EventListener);

    return () => {
      window.removeEventListener('session-error', handleSessionError as EventListener);
    };
  }, [refreshSession]);

  // Expose methods for manual session management
  const extendSession = useCallback(async () => {
    console.log('🔄 Manually extending session...');
    const success = await refreshSession();
    
    if (success) {
      showSuccess('Session Extended', 'Your session has been extended successfully.');
    }
    
    return success;
  }, [refreshSession, showSuccess]);

  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing session...');
    
    // Reset retry count for manual refresh
    setSessionState(prev => ({ ...prev, retryCount: 0 }));
    
    return await refreshSession();
  }, [refreshSession]);

  return {
    sessionState,
    validateSession,
    refreshSession,
    extendSession,
    forceRefresh,
    performHealthCheck
  };
}