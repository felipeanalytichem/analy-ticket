import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ConnectionStatus {
  isOnline: boolean;
  supabaseConnected: boolean;
  lastCheck: Date;
  isChecking: boolean;
}

export function ConnectionMonitor() {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    supabaseConnected: false,
    lastCheck: new Date(),
    isChecking: false
  });
  const [showDetails, setShowDetails] = useState(false);

  // Check Supabase connection
  const checkSupabaseConnection = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // First check auth status
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        console.warn('No valid session for database check:', sessionError);
        return false;
      }

      // Test database connection with a simple query
      const { data, error } = await supabase
        .from('tickets_new')
        .select('id')
        .limit(1);
      
      if (error) {
        console.warn('Database connection check failed:', error);
        // Try alternative table if tickets fails
        const { error: altError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .limit(1);
        
        if (altError) {
          console.warn('Alternative database check also failed:', altError);
          return false;
        }
      }
      
      console.log('✅ Database connection check successful');
      return true;
    } catch (error) {
      console.warn('Supabase connection check failed:', error);
      return false;
    }
  }, [user]);

  // Perform full connection check
  const performConnectionCheck = useCallback(async () => {
    setConnectionStatus(prev => ({ ...prev, isChecking: true }));
    
    const isOnline = navigator.onLine;
    const supabaseConnected = await checkSupabaseConnection();
    
    setConnectionStatus({
      isOnline,
      supabaseConnected,
      lastCheck: new Date(),
      isChecking: false
    });

    return { isOnline, supabaseConnected };
  }, [checkSupabaseConnection]);

  // Manual reconnection attempt
  const handleReconnect = useCallback(async () => {
    toast.info('Checking connection...', {
      description: 'Testing network and database connectivity'
    });

    const { isOnline, supabaseConnected } = await performConnectionCheck();

    if (isOnline && supabaseConnected) {
      toast.success('Connection Restored', {
        description: 'Your connection is working properly'
      });
    } else {
      toast.error('Connection Issues', {
        description: !isOnline 
          ? 'No internet connection detected'
          : 'Database connection failed - please try again'
      });
    }
  }, [performConnectionCheck]);

  // Force page refresh
  const handleRefreshPage = useCallback(() => {
    window.location.reload();
  }, []);

  // Set up connection monitoring
  useEffect(() => {
    if (!user) return;

    // Initial check
    performConnectionCheck();

    // Set up periodic checks
    const interval = setInterval(performConnectionCheck, 30000); // Every 30 seconds

    // Listen for online/offline events
    const handleOnline = () => {
      setConnectionStatus(prev => ({ ...prev, isOnline: true }));
      performConnectionCheck();
    };

    const handleOffline = () => {
      setConnectionStatus(prev => ({ ...prev, isOnline: false, supabaseConnected: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, performConnectionCheck]);

  // Don't show for non-authenticated users
  if (!user) return null;

  // Determine overall connection health
  const isHealthy = connectionStatus.isOnline && connectionStatus.supabaseConnected;
  const hasIssues = !connectionStatus.isOnline || !connectionStatus.supabaseConnected;

  // Only show the monitor if there are issues or user wants to see details
  if (!hasIssues && !showDetails) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDetails(true)}
        className="fixed bottom-4 left-4 z-50 opacity-50 hover:opacity-100"
      >
        <Wifi className="h-4 w-4 text-green-500" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-80 shadow-lg border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
            {isHealthy ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="font-medium text-sm">Connection Status</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '−' : '+'}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Internet</span>
            <Badge variant={connectionStatus.isOnline ? "default" : "destructive"}>
              {connectionStatus.isOnline ? 'Connected' : 'Offline'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Database</span>
            <Badge variant={connectionStatus.supabaseConnected ? "default" : "destructive"}>
              {connectionStatus.supabaseConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          
          {showDetails && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Check</span>
              <span className="text-xs text-muted-foreground">
                {connectionStatus.lastCheck.toLocaleTimeString()}
          </span>
            </div>
          )}
        </div>

        {hasIssues && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                {!connectionStatus.isOnline 
                  ? 'No internet connection. Check your network settings.'
                  : 'Database connection lost. This may cause the app to show blank pages.'
                }
              </div>
            </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReconnect}
                disabled={connectionStatus.isChecking}
                className="flex-1"
              >
                {connectionStatus.isChecking ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
            )}
                Reconnect
          </Button>
          
          <Button
            size="sm"
            variant="outline"
                onClick={handleRefreshPage}
                className="flex-1"
          >
                <RotateCcw className="h-3 w-3 mr-1" />
                Refresh Page
          </Button>
        </div>
      </div>
        )}
      </CardContent>
    </Card>
  );
}