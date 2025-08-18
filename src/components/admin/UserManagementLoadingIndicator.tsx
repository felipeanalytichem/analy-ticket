import React from 'react';
import { Loader2, RefreshCw, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { UserManagementSkeleton } from './UserManagementSkeleton';
import { SmoothLoadingTransition } from '@/components/ui/SmoothLoadingTransition';

interface UserManagementLoadingState {
  isLoading: boolean;
  loadingType: 'initial' | 'refresh' | 'action' | 'form' | null;
  loadingPhase?: 'initializing' | 'loading' | 'ready' | 'error' | 'partial';
  error: string | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  hasAdminRole: boolean;
  userRole?: string;
  retryCount: number;
  canRetry: boolean;
  operation?: string;
  isPartialData?: boolean;
  missingFeatures?: string[];
  cacheSource?: string;
  isDataLoadingBlocked?: boolean;
  canLoadData?: boolean;
  errorRecovery?: {
    canRetryNow: boolean;
    timeUntilRetry: number;
    recoveryActions: string[];
    errorType: string;
  };
}

interface UserManagementLoadingIndicatorProps extends UserManagementLoadingState {
  onRetry?: () => void;
  onReset?: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Consolidated loading indicator for the UserManagement component
 * Handles all loading states in a single, stable interface to prevent flickering
 */
export const UserManagementLoadingIndicator: React.FC<UserManagementLoadingIndicatorProps> = ({
  isLoading,
  loadingType,
  loadingPhase,
  error,
  authLoading,
  isAuthenticated,
  hasAdminRole,
  userRole,
  retryCount,
  canRetry,
  operation,
  isPartialData,
  missingFeatures,
  cacheSource,
  isDataLoadingBlocked,
  canLoadData,
  errorRecovery,
  onRetry,
  onReset,
  className = '',
  children
}) => {
  // Authentication loading state - only show when auth is actually loading
  if (authLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`} data-testid="loading-indicator">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <span className="text-sm font-medium">Loading...</span>
          <div className="text-xs text-gray-500">
            Verifying credentials and permissions...
          </div>
        </div>
      </div>
    );
  }

  // Data loading blocked by authentication state
  if (isDataLoadingBlocked && !canLoadData) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`} data-testid="loading-indicator">
        <div className="text-center space-y-3">
          <Shield className="h-8 w-8 mx-auto text-yellow-500" />
          <span className="text-sm font-medium">Loading...</span>
          <div className="text-xs text-gray-500">
            Validating authentication and permissions
          </div>
        </div>
      </div>
    );
  }

  // Authentication required state
  if (!isAuthenticated) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please log in to access user management.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Access denied state
  if (!hasAdminRole) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Administrator privileges required to access user management.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Current role: {userRole || 'None'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Enhanced error state with recovery information
  if (error && !isLoading) {
    const canRetryNow = errorRecovery?.canRetryNow ?? canRetry;
    const timeUntilRetry = errorRecovery?.timeUntilRetry ?? 0;
    
    return (
      <div className={className} data-testid="error-state">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <div>
              <div className="font-medium">Failed to load user data</div>
              <div className="text-sm mt-1">{error}</div>
              {retryCount > 0 && (
                <div className="text-xs mt-1 opacity-75">
                  Retry attempt: {retryCount}
                </div>
              )}
              {errorRecovery?.errorType && (
                <div className="text-xs mt-1 opacity-75">
                  Error type: {errorRecovery.errorType}
                </div>
              )}
            </div>
            
            {/* Recovery actions */}
            {errorRecovery?.recoveryActions && errorRecovery.recoveryActions.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Suggested actions:</div>
                <ul className="text-xs space-y-1">
                  {errorRecovery.recoveryActions.slice(0, 3).map((action, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="opacity-50">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  disabled={!canRetryNow}
                  data-testid="retry-button"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {canRetryNow ? 'Try Again' : `Retry in ${Math.ceil(timeUntilRetry / 1000)}s`}
                </Button>
                {onReset && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onReset}
                    data-testid="reset-button"
                  >
                    Reset & Retry
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  data-testid="reload-button"
                >
                  Reload Page
                </Button>
              </div>
              
              {timeUntilRetry > 0 && (
                <div className="text-xs opacity-75">
                  Cooldown: {Math.ceil(timeUntilRetry / 1000)}s
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Partial data state
  if (isPartialData && loadingPhase === 'partial') {
    return (
      <div className={className}>
        <Alert className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="space-y-2">
            <div>
              <div className="font-medium text-yellow-800 dark:text-yellow-200">
                Limited functionality mode
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                Showing cached data. Some features may be unavailable.
              </div>
              {cacheSource && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  Data source: {cacheSource}
                </div>
              )}
            </div>
            
            {missingFeatures && missingFeatures.length > 0 && (
              <div className="text-sm">
                <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Unavailable features:
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300">
                  {missingFeatures.slice(0, 3).join(', ')}
                  {missingFeatures.length > 3 && ` and ${missingFeatures.length - 3} more`}
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-200 dark:hover:bg-yellow-900/30"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Try Full Reload
              </Button>
            </div>
          </AlertDescription>
        </Alert>
        {children}
      </div>
    );
  }

  // Loading states with smooth transitions
  const getLoadingComponent = () => {
    if (loadingType === 'initial') {
      return <UserManagementSkeleton />;
    }
    
    if (loadingType === 'refresh') {
      return (
        <div className="flex items-center justify-center py-8" data-testid="loading-indicator">
          <div className="text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
            <span className="text-sm font-medium">
              {retryCount > 0 ? 'Retrying...' : 'Refreshing user data...'}
            </span>
            {retryCount > 0 && (
              <div className="text-xs text-gray-500">
                Retry attempt: {retryCount}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (loadingType === 'action') {
      return (
        <div className="flex items-center justify-center py-4">
          <div className="text-center space-y-2">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
            <span className="text-sm font-medium">
              {operation ? `Processing ${operation}...` : 'Processing...'}
            </span>
          </div>
        </div>
      );
    }

    // Default loading state
    return (
      <div className="flex items-center justify-center py-8" data-testid="loading-indicator">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <span className="text-sm font-medium">Loading users...</span>
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      <SmoothLoadingTransition
        isLoading={isLoading}
        loadingComponent={getLoadingComponent()}
        minLoadingTime={300}
        fadeTransition={true}
      >
        {children}
      </SmoothLoadingTransition>
    </div>
  );
};