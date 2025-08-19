import { useEffect, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SessionRecoveryState {
  isRecovering: boolean;
  lastRecoveryAttempt: Date | null;
  recoveryAttempts: number;
}

const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_COOLDOWN = 30000; // 30 seconds

export function useSessionRecovery() {
  const { user, signOut } = useAuth();
  const [recoveryState, setRecoveryState] = useState<SessionRecoveryState>({
    isRecovering: false,
    lastRecoveryAttempt: null,
    recoveryAttempts: 0
  });

  // Attempt to recover from session errors
  const attemptRecovery = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    // Check cooldown
    if (recoveryState.lastRecoveryAttempt) {
      const timeSinceLastAttempt = Date.now() - recoveryState.lastRecoveryAttempt.getTime();
      if (timeSinceLastAttempt < RECOVERY_COOLDOWN) {
        console.log('🔄 Recovery attempt blocked by cooldown');
        return false;
      }
    }

    // Check max attempts
    if (recoveryState.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      console.log('🔄 Max recovery attempts reached');
      toast.error('Session Recovery Failed', {
        description: 'Unable to recover your session. Please log in again.',
        action: {
          label: 'Log In',
          onClick: () => signOut()
        }
      });
      return false;
    }

    setRecoveryState(prev => ({
      ...prev,
      isRecovering: true,
      lastRecoveryAttempt: new Date(),
      recoveryAttempts: prev.recoveryAttempts + 1
    }));

    try {
      console.log('🔄 Attempting session recovery...');
      
      // Try to refresh the session
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        console.error('🔄 Session refresh failed:', error);
        
        // Try to get the current session as a fallback
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData.session) {
          throw new Error('No valid session found');
        }
        
        console.log('🔄 Using existing session');
        setRecoveryState(prev => ({ ...prev, isRecovering: false, recoveryAttempts: 0 }));
        
        toast.success('Session Recovered', {
          description: 'Your session has been restored.'
        });
        
        return true;
      }

      console.log('✅ Session recovery successful');
      setRecoveryState(prev => ({ ...prev, isRecovering: false, recoveryAttempts: 0 }));
      
      toast.success('Session Recovered', {
        description: 'Your session has been refreshed successfully.'
      });
      
      return true;

    } catch (error) {
      console.error('❌ Session recovery failed:', error);
      setRecoveryState(prev => ({ ...prev, isRecovering: false }));
      
      if (recoveryState.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS - 1) {
        toast.error('Session Recovery Failed', {
          description: 'Unable to recover your session. Please log in again.',
          action: {
            label: 'Log In',
            onClick: () => signOut()
          }
        });
      } else {
        toast.warning('Session Recovery Failed', {
          description: `Recovery attempt ${recoveryState.recoveryAttempts + 1} failed. Will retry automatically.`,
          action: {
            label: 'Retry Now',
            onClick: () => attemptRecovery()
          }
        });
      }
      
      return false;
    }
  }, [user, signOut, recoveryState]);

  // Handle API errors that might indicate session issues
  const handleApiError = useCallback(async (error: any): Promise<boolean> => {
    // Check if it's an authentication error
    if (error.status === 401 || error.code === 'PGRST301' || error.message?.includes('JWT')) {
      console.log('🚨 Authentication error detected, attempting recovery...');
      return await attemptRecovery();
    }
    
    return false;
  }, [attemptRecovery]);

  // Set up global error listener
  useEffect(() => {
    const handleGlobalError = async (event: any) => {
      const error = event.detail || event.error || event;
      await handleApiError(error);
    };

    // Listen for custom session error events
    window.addEventListener('session-error', handleGlobalError);
    
    // Listen for unhandled promise rejections that might be auth-related
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      if (error && (error.status === 401 || error.message?.includes('JWT'))) {
        handleApiError(error);
      }
    });

    return () => {
      window.removeEventListener('session-error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleGlobalError);
    };
  }, [handleApiError]);

  // Monitor auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('✅ Token refreshed automatically');
        setRecoveryState(prev => ({ ...prev, recoveryAttempts: 0 }));
      } else if (event === 'SIGNED_OUT') {
        setRecoveryState({
          isRecovering: false,
          lastRecoveryAttempt: null,
          recoveryAttempts: 0
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Periodic health check
  useEffect(() => {
    if (!user) return;

    const healthCheck = async () => {
      try {
        // Simple health check - try to get user profile
        const { error } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (error && (error.code === 'PGRST301' || error.message?.includes('JWT'))) {
          console.log('🏥 Health check failed, attempting recovery...');
          await attemptRecovery();
        }
      } catch (error) {
        console.warn('🏥 Health check error:', error);
      }
    };

    // Run health check every 10 minutes - less aggressive to avoid unnecessary requests
    const interval = setInterval(healthCheck, 10 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [user, attemptRecovery]);

  return {
    recoveryState,
    attemptRecovery,
    handleApiError
  };
}