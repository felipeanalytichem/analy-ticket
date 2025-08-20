import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

/**
 * Debug hook to track navigation and auth state changes
 * Helps identify when queries might not be executing during navigation
 */
export function useNavigationDebug(hookName: string) {
  const { user, userProfile, loading: authLoading, isInitialized } = useAuth();
  const location = useLocation();
  const prevLocation = useRef(location.pathname);
  
  useEffect(() => {
    if (prevLocation.current !== location.pathname) {
      console.log(`🔄 Navigation detected in ${hookName}:`, {
        from: prevLocation.current,
        to: location.pathname,
        authState: {
          isInitialized,
          authLoading,
          hasUser: !!user,
          hasUserProfile: !!userProfile,
          userId: user?.id,
          userRole: userProfile?.role
        }
      });
      prevLocation.current = location.pathname;
    }
  }, [location.pathname, hookName, isInitialized, authLoading, user, userProfile]);

  useEffect(() => {
    console.log(`🔍 Auth state change in ${hookName}:`, {
      isInitialized,
      authLoading,
      hasUser: !!user,
      hasUserProfile: !!userProfile,
      userId: user?.id,
      userRole: userProfile?.role,
      currentPath: location.pathname
    });
  }, [isInitialized, authLoading, user?.id, userProfile?.role, hookName, location.pathname]);

  return {
    authReady: isInitialized && !authLoading && !!userProfile?.id,
    debugInfo: {
      isInitialized,
      authLoading,
      hasUser: !!user,
      hasUserProfile: !!userProfile,
      currentPath: location.pathname
    }
  };
}
