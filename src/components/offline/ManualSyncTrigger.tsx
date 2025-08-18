import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, Upload, AlertCircle, CheckCircle, XCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { offlineManager } from '@/services/OfflineManager';
import { backgroundSyncManager } from '@/services/BackgroundSyncManager';
import type { SyncProgress, SyncFilter, SyncResult } from '@/services/BackgroundSyncManager';

interface ManualSyncTriggerProps {
  variant?: 'button' | 'card' | 'compact';
  showFilters?: boolean;
  className?: string;
}

export const ManualSyncTrigger: React.FC<ManualSyncTriggerProps> = ({
  variant = 'button',
  showFilters = false,
  className = ''
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [pendingActions, setPendingActions] = useState(0);
  
  // Filter state
  const [syncFilter, setSyncFilter] = useState<SyncFilter>({});
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<('high' | 'medium' | 'low')[]>([]);
  const [selectedActionTypes, setSelectedActionTypes] = useState<('CREATE' | 'UPDATE' | 'DELETE' | 'QUERY')[]>([]);

  useEffect(() => {
    // Initialize services
    offlineManager.initialize().catch(console.error);

    // Set up event listeners
    const handleOfflineStatusChange = (status: any) => {
      setIsOnline(!status.isOffline);
      setPendingActions(status.pendingActions || 0);
    };

    const handleSyncProgress = (progress: SyncProgress) => {
      setSyncProgress(progress);
    };

    const handleSyncComplete = (result: SyncResult) => {
      setIsSyncing(false);
      setSyncProgress(null);
      setLastSyncResult(result);
      
      // Clear result after 5 seconds
      setTimeout(() => setLastSyncResult(null), 5000);
    };

    const handleSyncError = (error: Error) => {
      setIsSyncing(false);
      setSyncProgress(null);
      setLastSyncResult({
        success: false,
        syncedActions: 0,
        failedActions: 0,
        conflicts: [],
        errors: [error.message]
      });
      
      // Clear result after 5 seconds
      setTimeout(() => setLastSyncResult(null), 5000);
    };

    // Register event listeners
    offlineManager.onOfflineStatusChange(handleOfflineStatusChange);
    backgroundSyncManager.onSyncProgress(handleSyncProgress);
    backgroundSyncManager.onSyncComplete(handleSyncComplete);
    backgroundSyncManager.onSyncError(handleSyncError);

    // Get initial status
    setIsOnline(!offlineManager.isOffline());
    const syncStatus = backgroundSyncManager.getSyncStatus();
    setPendingActions(0); // Will be updated by status change

    return () => {
      // Cleanup is handled by the services themselves
    };
  }, []);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      let result: SyncResult;
      
      if (showFilters && Object.keys(syncFilter).length > 0) {
        // Apply filters
        const filter: SyncFilter = {
          ...syncFilter,
          tables: selectedTables.length > 0 ? selectedTables : undefined,
          priorities: selectedPriorities.length > 0 ? selectedPriorities : undefined,
          actionTypes: selectedActionTypes.length > 0 ? selectedActionTypes : undefined
        };
        
        result = await backgroundSyncManager.syncWithFilter(filter);
      } else {
        result = await backgroundSyncManager.forceSyncNow();
      }
      
      // Result will be handled by the event listener
    } catch (error) {
      console.error('Manual sync failed:', error);
      // Error will be handled by the event listener
    }
  };

  const handleFilterChange = (key: keyof SyncFilter, value: any) => {
    setSyncFilter(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const formatSyncResult = (result: SyncResult) => {
    if (result.success) {
      return `✓ Synced ${result.syncedActions} items`;
    } else {
      return `✗ ${result.failedActions} failed, ${result.syncedActions} synced`;
    }
  };

  const renderSyncButton = () => (
    <Button
      onClick={handleSync}
      disabled={!isOnline || isSyncing}
      variant={pendingActions > 0 ? 'default' : 'outline'}
      size={variant === 'compact' ? 'sm' : 'default'}
      className={className}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync {pendingActions > 0 ? `(${pendingActions})` : ''}
        </>
      )}
    </Button>
  );

  if (variant === 'button' || variant === 'compact') {
    return (
      <div className={`space-y-2 ${className}`}>
        {renderSyncButton()}
        
        {/* Progress indicator */}
        {syncProgress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{syncProgress.currentAction || 'Syncing...'}</span>
              <span>{syncProgress.percentage}%</span>
            </div>
            <Progress value={syncProgress.percentage} className="h-1" />
          </div>
        )}
        
        {/* Result indicator */}
        {lastSyncResult && (
          <div className="flex items-center space-x-1">
            {lastSyncResult.success ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <XCircle className="h-3 w-3 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {formatSyncResult(lastSyncResult)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Card variant with filters
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Manual Sync</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isOnline && (
              <Badge variant="destructive" className="text-xs">
                Offline
              </Badge>
            )}
            
            {pendingActions > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingActions} pending
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Sync Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Badge variant="outline" className="text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Sync Progress */}
        {syncProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress:</span>
              <span className="font-medium">{syncProgress.percentage}%</span>
            </div>
            <Progress value={syncProgress.percentage} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {syncProgress.currentAction || 'Syncing...'}
            </div>
            <div className="text-xs text-muted-foreground">
              {syncProgress.completed}/{syncProgress.total} completed
            </div>
          </div>
        )}

        {/* Last Sync Result */}
        {lastSyncResult && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last sync:</span>
              <div className="flex items-center space-x-1">
                {lastSyncResult.success ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs ${
                  lastSyncResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatSyncResult(lastSyncResult)}
                </span>
              </div>
            </div>
            
            {lastSyncResult.conflicts.length > 0 && (
              <div className="text-xs text-orange-600">
                {lastSyncResult.conflicts.length} conflicts detected
              </div>
            )}
            
            {lastSyncResult.errors.length > 0 && (
              <div className="text-xs text-red-600">
                Errors: {lastSyncResult.errors.slice(0, 2).join(', ')}
                {lastSyncResult.errors.length > 2 && '...'}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">Sync Filters</span>
              </div>
              
              {/* Table Filter */}
              <div className="space-y-2">
                <Label className="text-xs">Tables:</Label>
                <div className="flex flex-wrap gap-2">
                  {['tickets', 'users', 'categories', 'knowledge_base'].map(table => (
                    <div key={table} className="flex items-center space-x-1">
                      <Checkbox
                        id={`table-${table}`}
                        checked={selectedTables.includes(table)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTables(prev => [...prev, table]);
                          } else {
                            setSelectedTables(prev => prev.filter(t => t !== table));
                          }
                        }}
                      />
                      <Label htmlFor={`table-${table}`} className="text-xs">
                        {table}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Priority Filter */}
              <div className="space-y-2">
                <Label className="text-xs">Priorities:</Label>
                <div className="flex space-x-2">
                  {(['high', 'medium', 'low'] as const).map(priority => (
                    <div key={priority} className="flex items-center space-x-1">
                      <Checkbox
                        id={`priority-${priority}`}
                        checked={selectedPriorities.includes(priority)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPriorities(prev => [...prev, priority]);
                          } else {
                            setSelectedPriorities(prev => prev.filter(p => p !== priority));
                          }
                        }}
                      />
                      <Label htmlFor={`priority-${priority}`} className="text-xs capitalize">
                        {priority}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Action Type Filter */}
              <div className="space-y-2">
                <Label className="text-xs">Action Types:</Label>
                <div className="flex flex-wrap gap-2">
                  {(['CREATE', 'UPDATE', 'DELETE', 'QUERY'] as const).map(actionType => (
                    <div key={actionType} className="flex items-center space-x-1">
                      <Checkbox
                        id={`action-${actionType}`}
                        checked={selectedActionTypes.includes(actionType)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedActionTypes(prev => [...prev, actionType]);
                          } else {
                            setSelectedActionTypes(prev => prev.filter(a => a !== actionType));
                          }
                        }}
                      />
                      <Label htmlFor={`action-${actionType}`} className="text-xs">
                        {actionType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sync Button */}
        <div className="pt-2">
          {renderSyncButton()}
        </div>
      </CardContent>
    </Card>
  );
};

export default ManualSyncTrigger;