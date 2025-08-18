import React, { useState, useEffect } from 'react';
import { WifiOff, Upload, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface QueuedOperation {
  id: string;
  type: 'markAsRead' | 'delete' | 'markAllAsRead';
  notificationId?: string;
  userId?: string;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
}

interface OfflineNotificationQueueProps {
  isOnline: boolean;
  onSync?: (operations: QueuedOperation[]) => Promise<void>;
  className?: string;
}

export function OfflineNotificationQueue({
  isOnline,
  onSync,
  className
}: OfflineNotificationQueueProps) {
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem('notificationQueue');
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue);
        const operations = parsed.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }));
        setQueue(operations);
      } catch (error) {
        console.error('Failed to load notification queue:', error);
        localStorage.removeItem('notificationQueue');
      }
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    if (queue.length > 0) {
      localStorage.setItem('notificationQueue', JSON.stringify(queue));
    } else {
      localStorage.removeItem('notificationQueue');
    }
  }, [queue]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !isSyncing) {
      handleSync();
    }
  }, [isOnline, queue.length]);

  // Show/hide queue based on offline status and queue size
  useEffect(() => {
    setIsVisible(!isOnline || queue.length > 0);
  }, [isOnline, queue.length]);

  const addToQueue = (operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>) => {
    const queuedOperation: QueuedOperation = {
      ...operation,
      id: `${operation.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending'
    };

    setQueue(prev => [...prev, queuedOperation]);
    return queuedOperation.id;
  };

  const removeFromQueue = (operationId: string) => {
    setQueue(prev => prev.filter(op => op.id !== operationId));
  };

  const updateOperationStatus = (operationId: string, status: QueuedOperation['status'], error?: string) => {
    setQueue(prev => prev.map(op => 
      op.id === operationId 
        ? { ...op, status, error, retryCount: status === 'failed' ? op.retryCount + 1 : op.retryCount }
        : op
    ));
  };

  const handleSync = async () => {
    if (!onSync || isSyncing || queue.length === 0) return;

    setIsSyncing(true);
    const pendingOperations = queue.filter(op => op.status === 'pending' || op.status === 'failed');

    try {
      // Mark operations as syncing
      pendingOperations.forEach(op => {
        updateOperationStatus(op.id, 'syncing');
      });

      await onSync(pendingOperations);

      // Mark successful operations as synced
      pendingOperations.forEach(op => {
        updateOperationStatus(op.id, 'synced');
      });

      // Remove synced operations after a short delay
      setTimeout(() => {
        setQueue(prev => prev.filter(op => op.status !== 'synced'));
      }, 2000);

    } catch (error) {
      console.error('Failed to sync operations:', error);
      
      // Mark failed operations
      pendingOperations.forEach(op => {
        updateOperationStatus(op.id, 'failed', error instanceof Error ? error.message : 'Sync failed');
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearQueue = () => {
    setQueue([]);
    localStorage.removeItem('notificationQueue');
  };

  const getOperationIcon = (operation: QueuedOperation) => {
    switch (operation.status) {
      case 'syncing':
        return <Upload className="h-4 w-4 animate-pulse text-blue-500" />;
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getOperationDescription = (operation: QueuedOperation) => {
    switch (operation.type) {
      case 'markAsRead':
        return `Mark notification as read`;
      case 'delete':
        return `Delete notification`;
      case 'markAllAsRead':
        return `Mark all notifications as read`;
      default:
        return 'Unknown operation';
    }
  };

  const getStatusBadge = (status: QueuedOperation['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'syncing':
        return <Badge variant="default">Syncing</Badge>;
      case 'synced':
        return <Badge variant="default" className="bg-green-100 text-green-800">Synced</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (!isVisible) return null;

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-sm">
              {isOnline ? 'Sync Queue' : 'Offline Mode'}
            </CardTitle>
          </div>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-xs">
          {isOnline 
            ? `${queue.length} operations queued for sync`
            : 'Changes will be synced when connection is restored'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {!isOnline && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription className="text-xs">
              You're currently offline. Your actions are being saved and will sync automatically when you're back online.
            </AlertDescription>
          </Alert>
        )}

        {queue.length > 0 && (
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {queue.map((operation) => (
                <div
                  key={operation.id}
                  className="flex items-center justify-between p-2 bg-muted rounded-sm"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getOperationIcon(operation)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {getOperationDescription(operation)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {operation.timestamp.toLocaleTimeString()}
                      </p>
                      {operation.error && (
                        <p className="text-xs text-red-600 truncate">
                          {operation.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(operation.status)}
                    {operation.status === 'failed' && (
                      <Button
                        onClick={() => updateOperationStatus(operation.id, 'pending')}
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-2">
          {isOnline && queue.length > 0 && (
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              size="sm"
              className="flex-1"
            >
              {isSyncing ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  Syncing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          )}
          
          {queue.length > 0 && (
            <Button
              onClick={handleClearQueue}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              Clear Queue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for managing offline operations
export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueOperation = (operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>) => {
    if (isOnline) {
      // If online, execute immediately
      return null;
    }

    // If offline, add to queue
    const queuedOperation: QueuedOperation = {
      ...operation,
      id: `${operation.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending'
    };

    // Store in localStorage
    const existingQueue = JSON.parse(localStorage.getItem('notificationQueue') || '[]');
    existingQueue.push(queuedOperation);
    localStorage.setItem('notificationQueue', JSON.stringify(existingQueue));

    return queuedOperation.id;
  };

  return {
    isOnline,
    queueOperation
  };
}