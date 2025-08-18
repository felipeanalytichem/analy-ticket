import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OfflineModeIndicatorProps {
  isOnline: boolean;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'offline';
  pendingActions?: number;
  lastSyncTime?: Date;
  onRetryConnection?: () => void;
  onManualSync?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function OfflineModeIndicator({
  isOnline,
  connectionQuality = 'excellent',
  pendingActions = 0,
  lastSyncTime,
  onRetryConnection,
  onManualSync,
  showDetails = false,
  className = ''
}: OfflineModeIndicatorProps) {
  const [showDetailedView, setShowDetailedView] = useState(showDetails);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Auto-retry connection when offline
  useEffect(() => {
    if (!isOnline && retryAttempts < 3) {
      const timer = setTimeout(() => {
        if (onRetryConnection) {
          setIsRetrying(true);
          onRetryConnection();
          setRetryAttempts(prev => prev + 1);
          setTimeout(() => setIsRetrying(false), 2000);
        }
      }, Math.pow(2, retryAttempts) * 5000); // Exponential backoff: 5s, 10s, 20s

      return () => clearTimeout(timer);
    }
  }, [isOnline, retryAttempts, onRetryConnection]);

  // Reset retry attempts when back online
  useEffect(() => {
    if (isOnline) {
      setRetryAttempts(0);
    }
  }, [isOnline]);

  const getConnectionIcon = () => {
    if (isRetrying) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    
    if (!isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }
    
    return <Wifi className="h-4 w-4" />;
  };

  const getConnectionColor = () => {
    if (!isOnline) return 'text-red-600 dark:text-red-400';
    
    switch (connectionQuality) {
      case 'excellent':
        return 'text-green-600 dark:text-green-400';
      case 'good':
        return 'text-blue-600 dark:text-blue-400';
      case 'poor':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getConnectionText = () => {
    if (isRetrying) return 'Reconnecting...';
    if (!isOnline) return 'Offline';
    
    switch (connectionQuality) {
      case 'excellent':
        return 'Online';
      case 'good':
        return 'Online (Good)';
      case 'poor':
        return 'Online (Poor)';
      default:
        return 'Connected';
    }
  };

  const getQualityProgress = () => {
    switch (connectionQuality) {
      case 'excellent':
        return 100;
      case 'good':
        return 75;
      case 'poor':
        return 40;
      case 'offline':
        return 0;
      default:
        return 0;
    }
  };

  const formatLastSync = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Compact indicator for normal use
  if (!showDetailedView) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`flex items-center space-x-1 ${getConnectionColor()}`}>
          {getConnectionIcon()}
          <span className="text-sm font-medium">{getConnectionText()}</span>
        </div>
        
        {pendingActions > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingActions} pending
          </Badge>
        )}
        
        {showDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetailedView(true)}
            className="h-6 px-2 text-xs"
          >
            Details
          </Button>
        )}
      </div>
    );
  }

  // Detailed view
  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center space-x-2">
            <span className={getConnectionColor()}>
              {getConnectionIcon()}
            </span>
            <span>Connection Status</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetailedView(false)}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>
        <CardDescription>
          {isOnline ? 'You are connected to the internet' : 'You are currently offline'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Quality */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Connection Quality</span>
            <span className={`font-medium ${getConnectionColor()}`}>
              {getConnectionText()}
            </span>
          </div>
          <Progress value={getQualityProgress()} className="h-2" />
        </div>

        {/* Offline Alert */}
        {!isOnline && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You are offline. Some features may not be available until your connection is restored.
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Actions */}
        {pendingActions > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">Pending Actions</span>
            </div>
            <Badge variant="secondary">{pendingActions}</Badge>
          </div>
        )}

        {/* Last Sync */}
        {lastSyncTime && (
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Last synced</span>
            <span>{formatLastSync(lastSyncTime)}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col space-y-2">
          {!isOnline && onRetryConnection && (
            <Button
              onClick={() => {
                setIsRetrying(true);
                onRetryConnection();
                setTimeout(() => setIsRetrying(false), 2000);
              }}
              disabled={isRetrying}
              className="w-full"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Connection
                </>
              )}
            </Button>
          )}
          
          {pendingActions > 0 && onManualSync && (
            <Button
              variant="outline"
              onClick={onManualSync}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </Button>
          )}
        </div>

        {/* Retry Information */}
        {!isOnline && retryAttempts > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Retry attempt {retryAttempts} of 3
            {retryAttempts >= 3 && (
              <span className="block mt-1 text-red-600 dark:text-red-400">
                Automatic retry disabled. Please check your connection.
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for managing offline state
export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('excellent');
  const [pendingActions, setPendingActions] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionQuality('excellent');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionQuality('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addPendingAction = () => {
    setPendingActions(prev => prev + 1);
  };

  const removePendingAction = () => {
    setPendingActions(prev => Math.max(0, prev - 1));
  };

  const updateLastSync = () => {
    setLastSyncTime(new Date());
  };

  const updateConnectionQuality = (quality: 'excellent' | 'good' | 'poor' | 'offline') => {
    setConnectionQuality(quality);
  };

  return {
    isOnline,
    connectionQuality,
    pendingActions,
    lastSyncTime,
    addPendingAction,
    removePendingAction,
    updateLastSync,
    updateConnectionQuality
  };
}