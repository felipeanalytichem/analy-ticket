import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthState {
  isAuthenticated: boolean;
  hasAdminRole: boolean;
  userRole: string | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface AuthCache {
  timestamp: number;
  state: AuthState;
  ttl: number; // Time to live in milliseconds
}

interface AuthGuardOptions {
  requireAuth?: boolean;
  requireAdminRole?: boolean;
  allowedRoles?: string[];
  onAuthError?: (error: string) => void;
  onAccessDenied?: (userRole: string | null) => void;
}

/**
 * Optimized authentication state manager that prevents conflicts with data loading,
 * implements proper guards, stable error display, and caches authentication checks.
 */
export function useOptimizedAuth(options: AuthGuardOptions = {}) {
  const {
    requireAuth = true,
    requireAdminRole = false,
    allowedRoles = [],
    onAuthError,
    onAccessDenied
  } = options;

  const { user, userProfile, loading: authLoading, isInitialized } = useAuth();
  
  // Cache for authentication state to reduce redundant checks
  const authCache = useRef<AuthCache | null>(null);
  const CACHE_TTL = 30000; // 30 seconds cache TTL
  
  // Stable error state that doesn't cause re-renders
  const [stableError, setStableError] = useState<string | null>(null);
  const [lastErrorTimestamp, setLastErrorTimestamp] = useState<number>(0);
  
  // Authentication state guards to prevent rapid state changes
  const authStateGuard = useRef<{
    lastAuthCheck: number;
    lastUserProfileCheck: number;
    isProcessingAuthChange: boolean;
  }>({
    lastAuthCheck: 0,
    lastUserProfileCheck: 0,
    isProcessingAuthChange: false
  });

  // Debounce authentication state changes to prevent flickering
  const AUTH_DEBOUNCE_TIME = 100; // 100ms debounce

  /**
   * Get cached authentication state or compute new one
   */
  const getAuthState = useCallback((): AuthState => {
    const now = Date.now();
    
    // Return cached state if still valid
    if (authCache.current && (now - authCache.current.timestamp) < authCache.current.ttl) {
      return authCache.current.state;
    }

    // Compute new authentication state
    const isAuthenticated = !!user && !!userProfile;
    const userRole = userProfile?.role || null;
    const hasAdminRole = userRole === 'admin';
    
    const newState: AuthState = {
      isAuthenticated,
      hasAdminRole,
      userRole,
      isLoading: authLoading && !isInitialized,
      error: null,
      isInitialized
    };

    // Cache the new state
    authCache.current = {
      timestamp: now,
      state: newState,
      ttl: CACHE_TTL
    };

    return newState;
  }, [user, userProfile, authLoading, isInitialized]);

  /**
   * Guarded authentication check that prevents rapid state changes
   */
  const guardedAuthCheck = useCallback(() => {
    const now = Date.now();
    const guard = authStateGuard.current;
    
    // Prevent rapid successive checks
    if (now - guard.lastAuthCheck < AUTH_DEBOUNCE_TIME) {
      return authCache.current?.state || getAuthState();
    }
    
    // Prevent processing during auth state changes
    if (guard.isProcessingAuthChange) {
      return authCache.current?.state || getAuthState();
    }
    
    guard.lastAuthCheck = now;
    return getAuthState();
  }, [getAuthState]);

  /**
   * Stable error handler that prevents error flickering
   */
  const handleAuthError = useCallback((error: string) => {
    const now = Date.now();
    
    // Only update error if it's different or enough time has passed
    if (error !== stableError || (now - lastErrorTimestamp) > 5000) {
      setStableError(error);
      setLastErrorTimestamp(now);
      
      if (onAuthError) {
        onAuthError(error);
      }
    }
  }, [stableError, lastErrorTimestamp, onAuthError]);

  /**
   * Clear stable error state
   */
  const clearError = useCallback(() => {
    setStableError(null);
    setLastErrorTimestamp(0);
  }, []);

  // Get current authentication state with guards
  const authState = useMemo(() => {
    try {
      return guardedAuthCheck();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication error';
      handleAuthError(errorMessage);
      
      return {
        isAuthenticated: false,
        hasAdminRole: false,
        userRole: null,
        isLoading: false,
        error: errorMessage,
        isInitialized: true
      };
    }
  }, [guardedAuthCheck, handleAuthError]);

  /**
   * Check if user has required permissions
   */
  const hasPermission = useCallback((checkOptions?: AuthGuardOptions): boolean => {
    const options = { ...checkOptions } || {};
    const state = authState;
    
    // Check authentication requirement
    if (options.requireAuth !== false && !state.isAuthenticated) {
      return false;
    }
    
    // Check admin role requirement
    if (options.requireAdminRole && !state.hasAdminRole) {
      if (onAccessDenied) {
        onAccessDenied(state.userRole);
      }
      return false;
    }
    
    // Check allowed roles
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      if (!state.userRole || !options.allowedRoles.includes(state.userRole)) {
        if (onAccessDenied) {
          onAccessDenied(state.userRole);
        }
        return false;
      }
    }
    
    return true;
  }, [authState, onAccessDenied]);

  /**
   * Get authentication loading state that doesn't conflict with data loading
   */
  const getAuthLoadingState = useCallback(() => {
    const state = authState;
    
    // Only show auth loading during initial authentication
    const isAuthLoading = state.isLoading && !state.isInitialized;
    
    // Separate auth loading from data loading
    return {
      isAuthLoading,
      isDataLoadingBlocked: isAuthLoading, // Block data loading during auth
      authPhase: isAuthLoading ? 'authenticating' : 'ready',
      canLoadData: state.isAuthenticated && state.isInitialized
    };
  }, [authState]);

  /**
   * Invalidate authentication cache (useful for forced refresh)
   */
  const invalidateCache = useCallback(() => {
    authCache.current = null;
    authStateGuard.current.lastAuthCheck = 0;
    authStateGuard.current.lastUserProfileCheck = 0;
  }, []);

  /**
   * Reset authentication state (useful for error recovery)
   */
  const resetAuthState = useCallback(() => {
    invalidateCache();
    clearError();
    authStateGuard.current.isProcessingAuthChange = false;
  }, [invalidateCache, clearError]);

  // Handle authentication state changes with guards
  useEffect(() => {
    const guard = authStateGuard.current;
    
    // Mark as processing auth change
    guard.isProcessingAuthChange = true;
    
    // Clear processing flag after debounce time
    const timeout = setTimeout(() => {
      guard.isProcessingAuthChange = false;
    }, AUTH_DEBOUNCE_TIME);
    
    return () => {
      clearTimeout(timeout);
      guard.isProcessingAuthChange = false;
    };
  }, [user, userProfile, authLoading, isInitialized]);

  // Auto-clear errors when authentication state improves
  useEffect(() => {
    if (authState.isAuthenticated && stableError) {
      clearError();
    }
  }, [authState.isAuthenticated, stableError, clearError]);

  // Validate permissions on mount and when requirements change
  const permissionCheck = useMemo(() => {
    const hasRequiredPermission = hasPermission({
      requireAuth,
      requireAdminRole,
      allowedRoles
    });
    
    return {
      hasPermission: hasRequiredPermission,
      reason: !authState.isAuthenticated 
        ? 'authentication_required'
        : !hasRequiredPermission 
          ? 'insufficient_permissions'
          : 'authorized'
    };
  }, [hasPermission, requireAuth, requireAdminRole, allowedRoles, authState.isAuthenticated]);

  return {
    // Authentication state (cached and guarded)
    ...authState,
    
    // Stable error state
    stableError,
    hasError: !!stableError,
    
    // Loading state management
    ...getAuthLoadingState(),
    
    // Permission checking
    hasPermission,
    permissionCheck,
    
    // Cache management
    invalidateCache,
    resetAuthState,
    clearError,
    
    // Computed properties
    isReady: authState.isInitialized && !authState.isLoading,
    canAccessUserManagement: authState.isAuthenticated && authState.hasAdminRole,
    authCacheAge: authCache.current ? Date.now() - authCache.current.timestamp : 0,
    
    // Debug information (only in development)
    ...(process.env.NODE_ENV === 'development' && {
      debug: {
        cacheHit: !!authCache.current,
        lastAuthCheck: authStateGuard.current.lastAuthCheck,
        isProcessingAuthChange: authStateGuard.current.isProcessingAuthChange,
        cacheAge: authCache.current ? Date.now() - authCache.current.timestamp : 0
      }
    })
  };
}