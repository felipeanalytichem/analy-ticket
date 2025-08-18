import React, { useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Info, 
  Activity, 
  Zap, 
  Signal,
  Globe,
  Server,
  Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  position?: 'fixed' | 'relative';
}

interface ConnectionDiagnostics {
  latency: number;
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  successRate: number;
  uptime: number;
  lastError?: string;
  networkType?: string;
  serverRegion?: string;
  supabaseConnected: boolean;
  networkConnected: boolean;
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
  compact = false,
  position = 'relative'
}: ConnectionStatusIndicatorProps) {
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

  // Determine actual status based on connection monitor data
  const getActualStatus = (): ConnectionStatus => {
    if (propStatus) return propStatus;
    
    if (!navigator.onLine) return ConnectionStatus.DISCONNECTED;
    if (reconnectionState.isReconnecting) return ConnectionStatus.RECONNECTING;
    if (!connectionStatus.isOnline) return ConnectionStatus.DISCONNECTED;
    if (connectionStatus.supabaseConnected) return ConnectionStatus.CONNECTED;
    
    return ConnectionStatus.CONNECTING;
  };

  const status = getActualStatus();
  const lastConnected = propLastConnected || connectionStatus.lastConnected;
  const retryCount = propRetryCount || reconnectionState.currentAttempt;

  const getStatusConfig = () => {
    if (!navigator.onLine) {
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
          description: 'Connection active and stable'
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
          description: 'Connection lost'
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
        return { color: 'text-green-500', percentage: 100, label: 'Excellent', bars: 4 };
      case 'good':
        return { color: 'text-blue-500', percentage: 75, label: 'Good', bars: 3 };
      case 'poor':
        return { color: 'text-yellow-500', percentage: 50, label: 'Poor', bars: 2 };
      case 'offline':
      default:
        return { color: 'text-red-500', percentage: 0, label: 'Offline', bars: 0 };
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
      serverRegion: 'auto',
      supabaseConnected: connectionStatus.supabaseConnected,
      networkConnected: connectionStatus.networkConnected
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
    navigator.onLine;

  // Signal strength visualization
  const SignalBars = ({ bars, className }: { bars: number; className?: string }) => (
    <div className={cn("flex items-end gap-0.5", className)}>
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1 bg-current transition-opacity",
            bar === 1 ? "h-1" : bar === 2 ? "h-2" : bar === 3 ? "h-3" : "h-4",
            bar <= bars ? "opacity-100" : "opacity-30"
          )}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1", className)}>
              <Icon 
                className={cn(
                  "h-3 w-3",
                  config.color,
                  status === ConnectionStatus.CONNECTING || status === ConnectionStatus.RECONNECTING
                    ? "animate-pulse"
                    : ""
                )} 
              />
              {status === ConnectionStatus.CONNECTED && (
                <SignalBars bars={qualityConfig.bars} className={cn("h-3", qualityConfig.color)} />
              )}
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

  const containerClasses = cn(
    "flex items-center gap-2",
    position === 'fixed' && "fixed bottom-4 right-4 z-50 bg-background/95 backdrop-blur-sm border rounded-lg p-2 shadow-lg",
    className
  );

  return (
    <TooltipProvider>
      <div className={containerClasses}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-1">
                  <SignalBars bars={qualityConfig.bars} className={cn("h-4", qualityConfig.color)} />
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
              {!navigator.onLine && (
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
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Connection Diagnostics
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Status Overview */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Status Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Connection</span>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Network</span>
                      <div className="flex items-center gap-1">
                        <Globe className={cn("h-3 w-3", diagnostics.networkConnected ? "text-green-500" : "text-red-500")} />
                        <span className="text-sm">{diagnostics.networkConnected ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Database</span>
                      <div className="flex items-center gap-1">
                        <Server className={cn("h-3 w-3", diagnostics.supabaseConnected ? "text-green-500" : "text-red-500")} />
                        <span className="text-sm">{diagnostics.supabaseConnected ? 'Connected' : 'Disconnected'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Connection Quality */}
                {status === ConnectionStatus.CONNECTED && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Connection Quality</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Overall Quality</span>
                        <div className="flex items-center gap-2">
                          <SignalBars bars={qualityConfig.bars} className={cn("h-4", qualityConfig.color)} />
                          <span className={cn("text-sm", qualityConfig.color)}>
                            {qualityConfig.label}
                          </span>
                        </div>
                      </div>
                      <Progress value={qualityConfig.percentage} className="h-2" />
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Metrics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Latency</span>
                        <p className="font-mono text-lg">
                          {diagnostics.latency > 0 ? `${diagnostics.latency}ms` : 'N/A'}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Success Rate</span>
                        <p className="font-mono text-lg">
                          {Math.round(diagnostics.successRate * 100)}%
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Uptime</span>
                        <p className="font-mono text-lg">
                          {formatUptime(diagnostics.uptime)}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Network Type</span>
                        <p className="font-mono text-lg capitalize">
                          {diagnostics.networkType}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reconnection Info */}
                {reconnectionState.isReconnecting && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Timer className="h-3 w-3" />
                        Reconnection Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Current Attempt</span>
                        <span className="font-mono">{reconnectionState.currentAttempt}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Strategy</span>
                        <span className="font-mono capitalize">{reconnectionState.strategy}</span>
                      </div>
                      {reconnectionState.nextAttemptIn > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Next Attempt</span>
                          <span className="font-mono">{Math.ceil(reconnectionState.nextAttemptIn / 1000)}s</span>
                        </div>
                      )}
                      {reconnectionState.circuitBreakerOpen && (
                        <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                          Circuit breaker is open - temporarily pausing reconnection attempts
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Last Error */}
                {diagnostics.lastError && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-600">Last Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground bg-red-50 p-2 rounded font-mono">
                        {diagnostics.lastError}
                      </p>
                    </CardContent>
                  </Card>
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
  const {
    connectionStatus,
    reconnectionState,
    performHealthCheck,
    forceReconnection
  } = useConnectionMonitor();

  const getStatus = (): ConnectionStatus => {
    if (!navigator.onLine) return ConnectionStatus.DISCONNECTED;
    if (reconnectionState.isReconnecting) return ConnectionStatus.RECONNECTING;
    if (!connectionStatus.isOnline) return ConnectionStatus.DISCONNECTED;
    if (connectionStatus.supabaseConnected) return ConnectionStatus.CONNECTED;
    return ConnectionStatus.CONNECTING;
  };

  const retry = async () => {
    await forceReconnection('Manual retry from hook');
  };

  const healthCheck = async () => {
    return await performHealthCheck();
  };

  return {
    status: getStatus(),
    lastConnected: connectionStatus.lastConnected,
    retryCount: reconnectionState.currentAttempt,
    isReconnecting: reconnectionState.isReconnecting,
    retry,
    healthCheck
  };
}