import React, { useState, useEffect } from 'react';
import { AlertCircle, Wifi, WifiOff, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { offlineManager } from '@/services/OfflineManager';
import { backgroundSyncManager } from '@/services/BackgroundSyncManager';
import type { OfflineStatus, SyncProgress } from '@/services/BackgroundSyncManager';

interface OfflineModeBannerProps {
  className?: string;
  showWhenOnline?: boolean;
  position?: 'top' | 'bottom';
}

export const OfflineModeBanner: React.FC<OfflineModeBannerProps> = ({
  className = '',
  showWhenOnline = false,
  position = 'top'
}) => {
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>({
    isOffline: false,
    lastSync: null,
    pendingActions: 0,
    cachedDataSize: 0,
    syncInProgress: false
  });
  
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    // Initialize offline manager
    offlineManager.initialize().catch(console.error);

    // Set up event listeners
    const handleOfflineStatusChange = (status: OfflineStatus) => {
      setOfflineStatus(status);
    };

    const handleSyncProgress = (progress: SyncProgress) => {
      setSyncProgress(progress);
    };

    const handleSyncComplete = (result: any) => {
      setIsManualSyncing(false);
      setSyncProgress(null);
      setLastSyncResult(result.success ? 'success' : 'error');
      
      // Clear result after 3 seconds
      setTimeout(() => setLastSyncResult(null), 3000);
    };

    const handleSyncError = () => {
      setIsManualSyncing(false);
      setSyncProgress(null);
      setLastSyncResult('error');
      
      // Clear result after 3 seconds
      setTimeout(() => setLastSyncResult(null), 3000);
    };

    // Register event listeners
    offlineManager.onOfflineStatusChange(handleOfflineStatusChange);
    backgroundSyncManager.onSyncProgress(handleSyncProgress);
    backgroundSyncManager.onSyncComplete(handleSyncComplete);
    backgroundSyncManager.onSyncError(handleSyncError);

    // Get initial status
    const initialStatus = backgroundSyncManager.getSyncStatus();
    setOfflineStatus({
      isOffline: offlineManager.isOffline(),
      lastSync: initialStatus.lastSync,
      pendingActions: 0, // Will be updated by status change
      cachedDataSize: 0, // Will be updated by status change
      syncInProgress: initialStatus.isRunning
    });

    return () => {
      // Cleanup is handled by the services themselves
    };
  }, []);

  const handleManualSync = async () => {
    if (isManualSyncing || offlineStatus.isOffline) return;

    setIsManualSyncing(true);
    setLastSyncResult(null);

    try {
      await backgroundSyncManager.forceSyncNow();
    } catch (error) {
      console.error('Manual sync failed:', error);
      setIsManualSyncing(false);
      setLastSyncResult('error');
      setTimeout(() => setLastSyncResult(null), 3000);
    }
  };

  const formatLastSync = (lastSync: Date | null) => {
    if (!lastSync) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastSync.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatDataSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Don't show banner if online and showWhenOnline is false
  if (!offlineStatus.isOffline && !showWhenOnline && !syncProgress && !isManualSyncing) {
    return null;
  }

  const positionClasses = position === 'top' 
    ? 'top-4 left-4 right-4' 
    : 'bottom-4 left-4 right-4';

  return (
    <div className={`fixed ${positionClasses} z-50 ${className}`}>
      <Card className={`shadow-lg border-l-4 ${
        offlineStatus.isOffline 
          ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-950' 
          : 'border-l-green-500 bg-green-50 dark:bg-green-950'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Status Icon and Text */}
            <div className="flex items-center space-x-3">
              {offlineStatus.isOffline ? (
                <WifiOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              ) : (
                <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
              )}
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className={`font-medium ${
                    offlineStatus.isOffline 
                      ? 'text-orange-800 dark:text-orange-200' 
                      : 'text-green-800 dark:text-green-200'
                  }`}>
                    {offlineStatus.isOffline ? 'Working Offline' : 'Online'}
                  </span>
                  
                  {/* Status Badges */}
                  <div className="flex items-center space-x-1">
                    {offlineStatus.pendingActions > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {offlineStatus.pendingActions} pending
                      </Badge>
                    )}
                    
                    {offlineStatus.syncInProgress && (
                      <Badge variant="outline" className="text-xs">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Syncing
                      </Badge>
                    )}
                    
                    {lastSyncResult === 'success' && (
                      <Badge variant="outline" className="text-xs text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Synced
                      </Badge>
                    )}
                    
                    {lastSyncResult === 'error' && (
                      <Badge variant="outline" className="text-xs text-red-600">
                        <XCircle className="h-3 w-3 mr-1" />
                        Sync Failed
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Additional Info */}
                <div className={`text-sm mt-1 ${
                  offlineStatus.isOffline 
                    ? 'text-orange-600 dark:text-orange-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {offlineStatus.isOffline ? (
                    <>
                      {offlineStatus.cachedDataSize > 0 && (
                        <span>{formatDataSize(offlineStatus.cachedDataSize)} cached • </span>
                      )}
                      Changes will sync when online
                    </>
                  ) : (
                    <>
                      Last sync: {formatLastSync(offlineStatus.lastSync)}
                      {offlineStatus.cachedDataSize > 0 && (
                        <span> • {formatDataSize(offlineStatus.cachedDataSize)} cached</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {!offlineStatus.isOffline && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={isManualSyncing || offlineStatus.syncInProgress}
                  className="text-xs"
                >
                  {isManualSyncing || offlineStatus.syncInProgress ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Syncing
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Sync Now
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Sync Progress Bar */}
          {syncProgress && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {syncProgress.currentAction || 'Syncing...'}
                </span>
                <span className="text-muted-foreground">
                  {syncProgress.completed}/{syncProgress.total} ({syncProgress.percentage}%)
                </span>
              </div>
              <Progress value={syncProgress.percentage} className="h-2" />
              {syncProgress.estimatedTimeRemaining && (
                <div className="text-xs text-muted-foreground text-right">
                  ~{Math.ceil(syncProgress.estimatedTimeRemaining / 1000)}s remaining
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OfflineModeBanner;