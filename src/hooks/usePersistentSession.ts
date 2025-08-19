import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * Hook to maintain persistent sessions that never expire
 * Users stay logged in until they explicitly logout
 */
export function usePersistentSession() {
  const { user, session } = useAuth();
  const sessionKeeperInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  /**
   * Keep the session alive by periodically refreshing the token
   */
  const keepSessionAlive = useCallback(async () => {
    if (!user || !session) return;

    try {
      // Refresh the session to keep it alive
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.warn('Session refresh warning:', error.message);
        // Don't throw error - let it retry on next interval
        return;
      }

      if (data.session) {
        console.log('✅ Session refreshed successfully - staying persistent');
      }
    } catch (error) {
      console.warn('Session keep-alive error:', error);
      // Don't throw error - keep trying
    }
  }, [user, session]);

  /**
   * Start the session keeper service
   */
  const startSessionKeeper = useCallback(() => {
    if (!user || sessionKeeperInterval.current) return;

    console.log('🔄 Starting persistent session keeper...');
    
    // Refresh session every 30 minutes to keep it alive
    sessionKeeperInterval.current = setInterval(() => {
      keepSessionAlive();
    }, 30 * 60 * 1000); // 30 minutes

    // Also do an immediate refresh to ensure session is fresh
    keepSessionAlive();
  }, [user, keepSessionAlive]);

  /**
   * Stop the session keeper service
   */
  const stopSessionKeeper = useCallback(() => {
    if (sessionKeeperInterval.current) {
      console.log('🛑 Stopping session keeper');
      clearInterval(sessionKeeperInterval.current);
      sessionKeeperInterval.current = null;
    }
  }, []);

  /**
   * Handle visibility change - refresh session when user returns
   */
  const handleVisibilityChange = useCallback(() => {
    if (!document.hidden && user) {
      console.log('👁️ User returned - refreshing session');
      keepSessionAlive();
    }
  }, [user, keepSessionAlive]);

  /**
   * Handle page focus - ensure session is fresh when user interacts
   */
  const handlePageFocus = useCallback(() => {
    if (user) {
      console.log('🎯 Page focused - ensuring session is alive');
      keepSessionAlive();
    }
  }, [user, keepSessionAlive]);

  /**
   * Initialize persistent session management
   */
  useEffect(() => {
    if (user && !isInitialized.current) {
      console.log('🚀 Initializing persistent session for user:', user.email);
      isInitialized.current = true;
      startSessionKeeper();
      
      // Listen for visibility changes
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handlePageFocus);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handlePageFocus);
      };
    }
  }, [user, startSessionKeeper, handleVisibilityChange, handlePageFocus]);

  /**
   * Cleanup when user logs out
   */
  useEffect(() => {
    if (!user && isInitialized.current) {
      console.log('👋 User logged out - cleaning up session keeper');
      isInitialized.current = false;
      stopSessionKeeper();
      
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handlePageFocus);
    }
  }, [user, stopSessionKeeper, handleVisibilityChange, handlePageFocus]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopSessionKeeper();
    };
  }, [stopSessionKeeper]);

  return {
    isSessionPersistent: !!user && !!sessionKeeperInterval.current,
    refreshSession: keepSessionAlive,
    startKeeper: startSessionKeeper,
    stopKeeper: stopSessionKeeper
  };
}
