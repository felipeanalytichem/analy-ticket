import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, Clock, Info, Activity, Zap, Signal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

export enum ConnectionStatus {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

interface ConnectionStatusIndicatorProps {
  status?: ConnectionStatus;
  onRetry?: () => void;
  lastConnected?: Date;
  retryCount?: number;
  className?: string;
  showLabel?: boolean;
  showRetryButton?: boolean;
  showDiagnostics?: boolean;
  compact?: boolean;
}

interface ConnectionDiagnostics {
  latency: number;
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  successRate: number;
  uptime: number;
  lastError?: string;
  networkType?: string;
  serverRegion?: string;
}

export function ConnectionStatusIndicator({
  status: propStatus,
  onRetry,
  lastConnected: propLastConnected,
  retryCount: propRetryCount = 0,
  className,
  showLabel = true,
  showRetryButton = true,
  showDiagnostics = true,
  compact = false
}: ConnectionStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDetails, setShowDetails] = useState(false);
  
  // Use connection monitor hook for real-time data
  const {
    connectionStatus,
    connectionQuality,
    reconnectionState,
    reconnectionMetrics,
    performHealthCheck,
    forceReconnection
  } = useConnectionMonitor();

  // Use prop values if provided, otherwise use hook values
  const status = propStatus || (connectionStatus.isOnline ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED);
  const lastConnected = propLastConnected || connectionStatus.lastConnected;
  const retryCount = propRetryCount || reconnectionState.currentAttempt;

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

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: 'Offline',
        variant: 'destructive' as const,
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        description: 'No internet connection'
      };
    }

    switch (status) {
      case ConnectionStatus.CONNECTED:
        return {
          icon: CheckCircle,
          label: 'Connected',
          variant: 'default' as const,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          description: 'Real-time notifications active'
        };
      
      case ConnectionStatus.CONNECTING:
        return {
          icon: Clock,
          label: 'Connecting',
          variant: 'secondary' as const,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          description: 'Establishing connection...'
        };
      
      case ConnectionStatus.DISCONNECTED:
        return {
          icon: WifiOff,
          label: 'Disconnected',
          variant: 'destructive' as const,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          description: 'Not connected to notification service'
        };
      
      case ConnectionStatus.RECONNECTING:
        return {
          icon: Wifi,
          label: `Reconnecting${retryCount > 0 ? ` (${retryCount})` : ''}`,
          variant: 'secondary' as const,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          description: 'Attempting to reconnect...'
        };
      
      case ConnectionStatus.ERROR:
        return {
          icon: AlertCircle,
          label: 'Error',
          variant: 'destructive' as const,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          description: 'Connection error occurred'
        };
      
      default:
        return {
          icon: AlertCircle,
          label: 'Unknown',
          variant: 'secondary' as const,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          description: 'Unknown connection status'
        };
    }
  };

  const getQualityConfig = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return { color: 'text-green-500', percentage: 100, label: 'Excellent' };
      case 'good':
        return { color: 'text-blue-500', percentage: 75, label: 'Good' };
      case 'poor':
        return { color: 'text-yellow-500', percentage: 50, label: 'Poor' };
      case 'offline':
      default:
        return { color: 'text-red-500', percentage: 0, label: 'Offline' };
    }
  };

  const getDiagnostics = (): ConnectionDiagnostics => {
    return {
      latency: connectionStatus.latency || -1,
      quality: connectionQuality.rating || 'offline',
      successRate: connectionQuality.factors?.successRate || 0,
      uptime: reconnectionMetrics.connectionUptime || 0,
      lastError: reconnectionState.reason || undefined,
      networkType: (navigator as any).connection?.effectiveType || 'unknown',
      serverRegion: 'auto'
    };
  };

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
    } else {
      await forceReconnection('Manual retry');
    }
  };

  const handleHealthCheck = async () => {
    await performHealthCheck();
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const diagnostics = getDiagnostics();
  const qualityConfig = getQualityConfig(diagnostics.quality);

  const formatLastConnected = () => {
    if (!lastConnected) return null;
    
    const now = new Date();
    const diff = now.getTime() - lastConnected.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const shouldShowRetryButton = showRetryButton && 
    (status === ConnectionStatus.DISCONNECTED || status === ConnectionStatus.ERROR) &&
    isOnline;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center", className)}>
              <Icon 
                className={cn(
                  "h-3 w-3",
                  config.color,
                  status === ConnectionStatus.CONNECTING || status === ConnectionStatus.RECONNECTING
                    ? "animate-pulse"
                    : ""
                )} 
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{config.description}</p>
              <p className="text-xs text-muted-foreground">
                Quality: {qualityConfig.label}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Icon 
                className={cn(
                  "h-4 w-4",
                  config.color,
                  status === ConnectionStatus.CONNECTING || status === ConnectionStatus.RECONNECTING
                    ? "animate-pulse"
                    : ""
                )} 
              />
              
              {showLabel && (
                <Badge variant={config.variant} className="text-xs">
                  {config.label}
                </Badge>
              )}

              {/* Connection Quality Indicator */}
              {status === ConnectionStatus.CONNECTED && (
                <div className="flex items-center gap-1 ml-1">
                  <Signal className={cn("h-3 w-3", qualityConfig.color)} />
                  <span className={cn("text-xs", qualityConfig.color)}>
                    {qualityConfig.label}
                  </span>
                </div>
              )}
            </div>
          </TooltipTrigger>
          
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{config.description}</p>
              {status === ConnectionStatus.CONNECTED && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Quality: {qualityConfig.label} ({diagnostics.latency}ms)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Success Rate: {Math.round(diagnostics.successRate * 100)}%
                  </p>
                </>
              )}
              {lastConnected && status !== ConnectionStatus.CONNECTED && (
                <p className="text-xs text-muted-foreground">
                  Last connected: {formatLastConnected()}
                </p>
              )}
              {!isOnline && (
                <p className="text-xs text-muted-foreground">
                  Check your internet connection
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Diagnostics Dialog */}
        {showDiagnostics && (
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                title="Connection Diagnostics"
              >
                <Info className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Connection Diagnostics
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Status Overview */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>

                {/* Connection Quality */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connection Quality</span>
                    <span className={cn("text-sm", qualityConfig.color)}>
                      {qualityConfig.label}
                    </span>
                  </div>
                  <Progress value={qualityConfig.percentage} className="h-2" />
                </div>

                <Separator />

                {/* Detailed Metrics */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Metrics</h4>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Latency</span>
                      <p className="font-mono">
                        {diagnostics.latency > 0 ? `${diagnostics.latency}ms` : 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Success Rate</span>
                      <p className="font-mono">
                        {Math.round(diagnostics.successRate * 100)}%
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Uptime</span>
                      <p className="font-mono">
                        {formatUptime(diagnostics.uptime)}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Network</span>
                      <p className="font-mono capitalize">
                        {diagnostics.networkType}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reconnection Info */}
                {reconnectionState.isReconnecting && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Reconnection</h4>
                      <div className="text-sm space-y-1">
                        <p>Attempt: {reconnectionState.currentAttempt}</p>
                        <p>Strategy: {reconnectionState.strategy}</p>
                        {reconnectionState.nextAttemptIn > 0 && (
                          <p>Next attempt in: {Math.ceil(reconnectionState.nextAttemptIn / 1000)}s</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Last Error */}
                {diagnostics.lastError && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-red-600">Last Error</h4>
                      <p className="text-xs text-muted-foreground bg-red-50 p-2 rounded">
                        {diagnostics.lastError}
                      </p>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleHealthCheck}
                    className="flex-1"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Health Check
                  </Button>
                  
                  {shouldShowRetryButton && (
                    <Button
                      size="sm"
                      onClick={handleRetry}
                      className="flex-1"
                    >
                      Retry Connection
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Retry Button */}
        {shouldShowRetryButton && !showDiagnostics && (
          <Button
            onClick={handleRetry}
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
          >
            Retry
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

// Hook for managing connection status
export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const updateStatus = (newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    
    if (newStatus === ConnectionStatus.CONNECTED) {
      setLastConnected(new Date());
      setRetryCount(0);
    } else if (newStatus === ConnectionStatus.RECONNECTING) {
      setRetryCount(prev => prev + 1);
    }
  };

  const reset = () => {
    setStatus(ConnectionStatus.DISCONNECTED);
    setLastConnected(null);
    setRetryCount(0);
  };

  return {
    status,
    lastConnected,
    retryCount,
    updateStatus,
    reset
  };
}