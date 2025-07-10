import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SessionTimeoutConfig {
  timeoutMinutes?: number;
  warningMinutes?: number;
  checkIntervalSeconds?: number;
}

export interface SessionTimeoutState {
  isActive: boolean;
  timeRemaining: number;
  showWarning: boolean;
  lastActivity: Date | null;
}

const DEFAULT_CONFIG: Required<SessionTimeoutConfig> = {
  timeoutMinutes: 60, // 1 hour
  warningMinutes: 5, // Show warning 5 minutes before timeout
  checkIntervalSeconds: 1, // Check every second for real-time updates
};

// Load settings from localStorage with fallback to defaults
const loadConfigFromStorage = (): Required<SessionTimeoutConfig> => {
  try {
    const saved = localStorage.getItem('sessionTimeoutSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (error) {
    console.error('Error loading session timeout settings:', error);
  }
  return DEFAULT_CONFIG;
};

export function useSessionTimeout(config: SessionTimeoutConfig = {}) {
  const { user, signOut } = useAuth();
  
  // State for dynamic config that can be updated
  const [dynamicConfig, setDynamicConfig] = useState<Required<SessionTimeoutConfig>>(() => loadConfigFromStorage());
  
  // Apply any overrides from props
  const finalConfig = { ...dynamicConfig, ...config };
  
  const [state, setState] = useState<SessionTimeoutState>({
    isActive: false,
    timeRemaining: finalConfig.timeoutMinutes * 60 * 1000,
    showWarning: false,
    lastActivity: null,
  });

  const lastActivityRef = useRef<Date>(new Date());
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const warningShownRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false);
  const configRef = useRef(finalConfig);

  // Update config ref when config changes
  useEffect(() => {
    configRef.current = finalConfig;
  }, [finalConfig]);

  // Listen for settings changes from admin config page
  useEffect(() => {
    const handleSettingsChange = () => {
      console.log('⚙️ Session timeout settings changed, reloading...');
      setDynamicConfig(loadConfigFromStorage());
    };

    window.addEventListener('sessionTimeoutSettingsChanged', handleSettingsChange);
    
    return () => {
      window.removeEventListener('sessionTimeoutSettingsChanged', handleSettingsChange);
    };
  }, []);

  // Reset activity timer
  const resetActivity = useCallback(() => {
    if (!isActiveRef.current) return;
    
    const now = new Date();
    lastActivityRef.current = now;
    warningShownRef.current = false;
    
    setState(prev => ({
      ...prev,
      lastActivity: now,
      showWarning: false,
      timeRemaining: configRef.current.timeoutMinutes * 60 * 1000,
    }));

    console.log('🔄 Activity detected, session timer reset at', now.toLocaleTimeString());
  }, []);

  // Handle automatic logout
  const handleAutoLogout = useCallback(async () => {
    console.log('⏰ Session timeout - automatically logging out user');
    
    // Stop monitoring immediately to prevent multiple logout attempts
    isActiveRef.current = false;
    
    setState(prev => ({
      ...prev,
      isActive: false,
      showWarning: false,
    }));

    // Clear the interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = undefined;
    }
    
    // Show notification
    toast.error('Session Expired', {
      description: 'You have been automatically logged out due to inactivity.',
      duration: 5000,
    });

    try {
      // Perform logout
      console.log('🔐 Calling signOut function...');
      await signOut();
      console.log('✅ SignOut completed');
    } catch (error) {
      console.error('❌ Error during automatic logout:', error);
      
      // Force redirect even if signOut fails
      setTimeout(() => {
        console.log('🔄 Force redirecting after signOut error...');
        window.location.href = '/login';
      }, 1000);
    }
  }, [signOut]);

  // Show warning notification
  const showTimeoutWarning = useCallback(() => {
    if (warningShownRef.current) return;
    
    warningShownRef.current = true;
    const remainingMinutes = configRef.current.warningMinutes;
    
    console.log(`⚠️ Showing session timeout warning - ${remainingMinutes} minutes remaining`);
    
    setState(prev => ({
      ...prev,
      showWarning: true,
    }));

    toast.warning('Session Expiring Soon', {
      description: `Your session will expire in ${remainingMinutes} minutes. Please interact with the page to stay logged in.`,
      duration: 10000,
      action: {
        label: 'Stay Logged In',
        onClick: resetActivity,
      },
    });
  }, [resetActivity]);

  // Check session status
  const checkSessionStatus = useCallback(() => {
    if (!user || !isActiveRef.current) {
      return;
    }

    const now = new Date();
    const timeSinceLastActivity = now.getTime() - lastActivityRef.current.getTime();
    const timeoutMs = configRef.current.timeoutMinutes * 60 * 1000;
    const warningMs = configRef.current.warningMinutes * 60 * 1000;
    const timeRemaining = timeoutMs - timeSinceLastActivity;

    setState(prev => ({
      ...prev,
      timeRemaining: Math.max(0, timeRemaining),
    }));

    // Check if session should timeout
    if (timeSinceLastActivity >= timeoutMs) {
      console.log('⏰ Session timed out! Logging out user');
      handleAutoLogout();
      return;
    }

    // Check if warning should be shown
    if (timeRemaining <= warningMs && !warningShownRef.current) {
      console.log('⚠️ Showing timeout warning');
      showTimeoutWarning();
    }

    // Log every 10 seconds for debugging or when warning is shown
    const shouldLog = timeRemaining <= warningMs || (Math.floor(timeSinceLastActivity / 1000) % 10 === 0);
    if (shouldLog) {
      console.log(`🕐 Session check: ${Math.round(timeRemaining / 1000)}s remaining (${Math.round(timeSinceLastActivity / 1000)}s since last activity)`);
    }
  }, [user, handleAutoLogout, showTimeoutWarning]);

  // Activity event handlers
  const handleActivity = useCallback((event: Event) => {
    // Only reset on meaningful user interactions
    const meaningfulEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    if (meaningfulEvents.includes(event.type) && isActiveRef.current) {
      // Log only non-mousemove events to avoid spam
      if (event.type !== 'mousemove') {
        console.log(`👆 Activity detected: ${event.type}`);
      }
      resetActivity();
    }
  }, [resetActivity]);

  // Extend session manually
  const extendSession = useCallback(() => {
    resetActivity();
    toast.success('Session Extended', {
      description: 'Your session has been extended.',
      duration: 3000,
    });
  }, [resetActivity]);

  // Start session timeout monitoring
  const startMonitoring = useCallback(() => {
    if (!user || isActiveRef.current) {
      console.log('⚠️ Cannot start monitoring - user:', !!user, 'already active:', isActiveRef.current);
      return;
    }

    console.log(`🔒 Starting session timeout monitoring (${configRef.current.timeoutMinutes} minutes, checking every ${configRef.current.checkIntervalSeconds}s)`);
    
    const now = new Date();
    lastActivityRef.current = now;
    isActiveRef.current = true;
    warningShownRef.current = false;
    
    setState(prev => ({
      ...prev,
      isActive: true,
      lastActivity: now,
      timeRemaining: configRef.current.timeoutMinutes * 60 * 1000,
      showWarning: false,
    }));

    // Set up periodic session checks
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    checkIntervalRef.current = setInterval(() => {
      checkSessionStatus();
    }, configRef.current.checkIntervalSeconds * 1000);
    
    console.log('✅ Session monitoring started successfully');
  }, [user, checkSessionStatus]);

  // Stop session timeout monitoring
  const stopMonitoring = useCallback(() => {
    console.log('🔓 Stopping session timeout monitoring');
    
    setState(prev => ({
      ...prev,
      isActive: false,
      showWarning: false,
    }));
    
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = undefined;
    }
    
    isActiveRef.current = false;
    warningShownRef.current = false;
  }, []);

  // Set up activity listeners
  useEffect(() => {
    if (!user) {
      console.log('👥 No user - skipping activity listeners');
      return;
    }

    console.log('👂 Setting up activity listeners');
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    console.log(`✅ Activity listeners set up for events: ${events.join(', ')}`);

    return () => {
      console.log('🧹 Cleaning up activity listeners');
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [user, handleActivity]);

  // Initialize monitoring when user logs in
  useEffect(() => {
    console.log('🔧 Session timeout initialization - user:', !!user, 'isActive:', isActiveRef.current);
    
    if (user && !isActiveRef.current) {
      console.log('🚀 User logged in, starting session monitoring');
      startMonitoring();
    } else if (!user && isActiveRef.current) {
      console.log('🛑 User logged out, stopping session monitoring');
      stopMonitoring();
    } else {
      console.log('ℹ️ No action needed - current state is correct');
    }

    return () => {
      if (!user) {
        console.log('🧹 Cleanup: User not present, ensuring monitoring is stopped');
        stopMonitoring();
      }
    };
  }, [user, startMonitoring, stopMonitoring]);

  return {
    ...state,
    resetActivity,
    extendSession,
    startMonitoring,
    stopMonitoring,
    config: finalConfig,
  };
} 