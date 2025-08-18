import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Activity, Database, Wifi, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DiagnosticManager } from '@/services/DiagnosticManager';
import { toast } from 'sonner';

interface DiagnosticResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'running';
  message: string;
  details?: any;
  timestamp: Date;
}

interface SystemMetrics {
  memoryUsage: number;
  connectionLatency: number;
  authTokenValid: boolean;
  sessionActive: boolean;
  lastActivity: Date;
  errorCount: number;
  recoveryAttempts: number;
}

export function DiagnosticPanel() {
  const { user, session, loading: authLoading } = useAuth();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const diagnosticManager = new DiagnosticManager();

  // Add log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [logEntry, ...prev.slice(0, 99)]); // Keep last 100 logs
    console.log('🔍 Diagnostic:', logEntry);
  };

  // Run comprehensive diagnostics
  const runDiagnostics = async () => {
    setIsRunning(true);
    addLog('Starting comprehensive diagnostics...');
    
    const results: DiagnosticResult[] = [];

    try {
      // 1. Authentication Status Check
      addLog('Checking authentication status...');
      const authResult = await checkAuthenticationStatus();
      results.push(authResult);

      // 2. Session Validity Check
      addLog('Checking session validity...');
      const sessionResult = await checkSessionValidity();
      results.push(sessionResult);

      // 3. Database Connection Check
      addLog('Checking database connection...');
      const dbResult = await checkDatabaseConnection();
      results.push(dbResult);

      // 4. API Endpoint Health Check
      addLog('Checking API endpoints...');
      const apiResult = await checkApiEndpoints();
      results.push(apiResult);

      // 5. Token Refresh Check
      addLog('Checking token refresh capability...');
      const tokenResult = await checkTokenRefresh();
      results.push(tokenResult);

      // 6. Local Storage Check
      addLog('Checking local storage...');
      const storageResult = await checkLocalStorage();
      results.push(storageResult);

      // 7. Network Connectivity Check
      addLog('Checking network connectivity...');
      const networkResult = await checkNetworkConnectivity();
      results.push(networkResult);

      // 8. Memory Usage Check
      addLog('Checking memory usage...');
      const memoryResult = await checkMemoryUsage();
      results.push(memoryResult);

      // 9. Loading Loop Detection
      addLog('Checking for loading loops...');
      const loopResult = await checkLoadingLoops();
      results.push(loopResult);

      // 10. Session Recovery Check
      addLog('Checking session recovery system...');
      const recoveryResult = await checkSessionRecovery();
      results.push(recoveryResult);

      setDiagnostics(results);
      
      // Update metrics
      await updateMetrics();
      
      addLog(`Diagnostics completed. Found ${results.filter(r => r.status === 'fail').length} failures, ${results.filter(r => r.status === 'warning').length} warnings.`);
      
    } catch (error) {
      addLog(`Diagnostics failed: ${error}`);
      console.error('Diagnostics error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  // Individual diagnostic checks
  const checkAuthenticationStatus = async (): Promise<DiagnosticResult> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return {
          id: 'auth-status',
          name: 'Authentication Status',
          status: 'fail',
          message: `Authentication error: ${error.message}`,
          details: error,
          timestamp: new Date()
        };
      }

      if (!session) {
        return {
          id: 'auth-status',
          name: 'Authentication Status',
          status: 'warning',
          message: 'No active session found',
          timestamp: new Date()
        };
      }

      return {
        id: 'auth-status',
        name: 'Authentication Status',
        status: 'pass',
        message: 'User authenticated successfully',
        details: { userId: session.user.id, email: session.user.email },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'auth-status',
        name: 'Authentication Status',
        status: 'fail',
        message: `Authentication check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkSessionValidity = async (): Promise<DiagnosticResult> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return {
          id: 'session-validity',
          name: 'Session Validity',
          status: 'fail',
          message: 'No session available',
          timestamp: new Date()
        };
      }

      const now = new Date().getTime();
      const expiresAt = new Date(session.expires_at! * 1000).getTime();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= 0) {
        return {
          id: 'session-validity',
          name: 'Session Validity',
          status: 'fail',
          message: 'Session has expired',
          details: { expiresAt: new Date(expiresAt), timeUntilExpiry },
          timestamp: new Date()
        };
      }

      if (timeUntilExpiry < 5 * 60 * 1000) { // Less than 5 minutes
        return {
          id: 'session-validity',
          name: 'Session Validity',
          status: 'warning',
          message: `Session expires in ${Math.floor(timeUntilExpiry / 60000)} minutes`,
          details: { expiresAt: new Date(expiresAt), timeUntilExpiry },
          timestamp: new Date()
        };
      }

      return {
        id: 'session-validity',
        name: 'Session Validity',
        status: 'pass',
        message: `Session valid for ${Math.floor(timeUntilExpiry / 60000)} minutes`,
        details: { expiresAt: new Date(expiresAt), timeUntilExpiry },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'session-validity',
        name: 'Session Validity',
        status: 'fail',
        message: `Session validity check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkDatabaseConnection = async (): Promise<DiagnosticResult> => {
    try {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        return {
          id: 'db-connection',
          name: 'Database Connection',
          status: 'fail',
          message: `Database error: ${error.message}`,
          details: { error, latency },
          timestamp: new Date()
        };
      }

      const status = latency > 2000 ? 'warning' : 'pass';
      const message = latency > 2000 
        ? `Database connection slow (${latency}ms)`
        : `Database connection healthy (${latency}ms)`;

      return {
        id: 'db-connection',
        name: 'Database Connection',
        status,
        message,
        details: { latency, recordCount: data?.length || 0 },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'db-connection',
        name: 'Database Connection',
        status: 'fail',
        message: `Database connection failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkApiEndpoints = async (): Promise<DiagnosticResult> => {
    try {
      const endpoints = [
        { name: 'Users', table: 'users' },
        { name: 'Tickets', table: 'tickets' },
        { name: 'Categories', table: 'categories' }
      ];

      const results = await Promise.allSettled(
        endpoints.map(async endpoint => {
          const startTime = Date.now();
          const { error } = await supabase
            .from(endpoint.table)
            .select('id')
            .limit(1);
          
          return {
            name: endpoint.name,
            latency: Date.now() - startTime,
            error
          };
        })
      );

      const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
      const slowEndpoints = results.filter(r => r.status === 'fulfilled' && r.value.latency > 1000);

      if (failures.length > 0) {
        return {
          id: 'api-endpoints',
          name: 'API Endpoints',
          status: 'fail',
          message: `${failures.length} endpoints failed`,
          details: results,
          timestamp: new Date()
        };
      }

      if (slowEndpoints.length > 0) {
        return {
          id: 'api-endpoints',
          name: 'API Endpoints',
          status: 'warning',
          message: `${slowEndpoints.length} endpoints are slow`,
          details: results,
          timestamp: new Date()
        };
      }

      return {
        id: 'api-endpoints',
        name: 'API Endpoints',
        status: 'pass',
        message: 'All API endpoints healthy',
        details: results,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'api-endpoints',
        name: 'API Endpoints',
        status: 'fail',
        message: `API endpoint check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkTokenRefresh = async (): Promise<DiagnosticResult> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return {
          id: 'token-refresh',
          name: 'Token Refresh',
          status: 'fail',
          message: 'No session to refresh',
          timestamp: new Date()
        };
      }

      // Check if refresh token exists
      if (!session.refresh_token) {
        return {
          id: 'token-refresh',
          name: 'Token Refresh',
          status: 'fail',
          message: 'No refresh token available',
          timestamp: new Date()
        };
      }

      // Test token refresh (this will actually refresh the token)
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return {
          id: 'token-refresh',
          name: 'Token Refresh',
          status: 'fail',
          message: `Token refresh failed: ${error.message}`,
          details: error,
          timestamp: new Date()
        };
      }

      return {
        id: 'token-refresh',
        name: 'Token Refresh',
        status: 'pass',
        message: 'Token refresh successful',
        details: { newExpiresAt: new Date(data.session!.expires_at! * 1000) },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'token-refresh',
        name: 'Token Refresh',
        status: 'fail',
        message: `Token refresh check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkLocalStorage = async (): Promise<DiagnosticResult> => {
    try {
      const authKey = 'sb-plbmgjqitlxedsmdqpld-auth-token';
      const authData = localStorage.getItem(authKey);
      
      if (!authData) {
        return {
          id: 'local-storage',
          name: 'Local Storage',
          status: 'warning',
          message: 'No auth token in localStorage',
          timestamp: new Date()
        };
      }

      try {
        const parsed = JSON.parse(authData);
        const hasValidStructure = parsed && parsed.access_token && parsed.refresh_token;
        
        if (!hasValidStructure) {
          return {
            id: 'local-storage',
            name: 'Local Storage',
            status: 'fail',
            message: 'Invalid auth token structure in localStorage',
            details: parsed,
            timestamp: new Date()
          };
        }

        // Check token expiry
        const expiresAt = parsed.expires_at ? new Date(parsed.expires_at * 1000) : null;
        const now = new Date();
        
        if (expiresAt && expiresAt < now) {
          return {
            id: 'local-storage',
            name: 'Local Storage',
            status: 'warning',
            message: 'Stored auth token has expired',
            details: { expiresAt },
            timestamp: new Date()
          };
        }

        return {
          id: 'local-storage',
          name: 'Local Storage',
          status: 'pass',
          message: 'Auth token stored correctly',
          details: { expiresAt },
          timestamp: new Date()
        };
      } catch (parseError) {
        return {
          id: 'local-storage',
          name: 'Local Storage',
          status: 'fail',
          message: 'Cannot parse auth token from localStorage',
          details: { parseError },
          timestamp: new Date()
        };
      }
    } catch (error) {
      return {
        id: 'local-storage',
        name: 'Local Storage',
        status: 'fail',
        message: `Local storage check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkNetworkConnectivity = async (): Promise<DiagnosticResult> => {
    try {
      if (!navigator.onLine) {
        return {
          id: 'network',
          name: 'Network Connectivity',
          status: 'fail',
          message: 'Browser reports offline status',
          timestamp: new Date()
        };
      }

      // Test actual connectivity with a simple request
      const startTime = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', { 
        mode: 'no-cors',
        cache: 'no-cache'
      });
      const latency = Date.now() - startTime;

      return {
        id: 'network',
        name: 'Network Connectivity',
        status: 'pass',
        message: `Network connection active (${latency}ms)`,
        details: { latency },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'network',
        name: 'Network Connectivity',
        status: 'fail',
        message: `Network connectivity check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkMemoryUsage = async (): Promise<DiagnosticResult> => {
    try {
      // @ts-ignore - performance.memory is not in all browsers
      const memory = performance.memory;
      
      if (!memory) {
        return {
          id: 'memory',
          name: 'Memory Usage',
          status: 'warning',
          message: 'Memory usage information not available',
          timestamp: new Date()
        };
      }

      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
      
      const usagePercent = (usedMB / limitMB) * 100;
      
      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let message = `Memory usage: ${usedMB}MB / ${limitMB}MB (${usagePercent.toFixed(1)}%)`;
      
      if (usagePercent > 80) {
        status = 'fail';
        message = `High memory usage: ${usagePercent.toFixed(1)}%`;
      } else if (usagePercent > 60) {
        status = 'warning';
        message = `Moderate memory usage: ${usagePercent.toFixed(1)}%`;
      }

      return {
        id: 'memory',
        name: 'Memory Usage',
        status,
        message,
        details: { usedMB, totalMB, limitMB, usagePercent },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'memory',
        name: 'Memory Usage',
        status: 'fail',
        message: `Memory usage check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkLoadingLoops = async (): Promise<DiagnosticResult> => {
    try {
      // Check for common loading loop indicators
      const indicators = {
        multipleAuthCalls: 0,
        rapidSessionChecks: 0,
        excessiveRenders: 0,
        memoryLeaks: false
      };

      // Monitor console for repeated auth calls (simplified check)
      const originalConsoleLog = console.log;
      let authCallCount = 0;
      
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('🔐') || message.includes('auth') || message.includes('session')) {
          authCallCount++;
        }
        originalConsoleLog.apply(console, args);
      };

      // Wait a bit to collect data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Restore console
      console.log = originalConsoleLog;
      
      indicators.multipleAuthCalls = authCallCount;

      // Check for excessive re-renders by looking at React DevTools data
      // This is a simplified check - in a real implementation you'd use React DevTools API
      
      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let message = 'No loading loop indicators detected';
      
      if (indicators.multipleAuthCalls > 10) {
        status = 'fail';
        message = `Potential loading loop: ${indicators.multipleAuthCalls} auth calls in 1 second`;
      } else if (indicators.multipleAuthCalls > 5) {
        status = 'warning';
        message = `High auth activity: ${indicators.multipleAuthCalls} calls in 1 second`;
      }

      return {
        id: 'loading-loops',
        name: 'Loading Loop Detection',
        status,
        message,
        details: indicators,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'loading-loops',
        name: 'Loading Loop Detection',
        status: 'fail',
        message: `Loading loop check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  const checkSessionRecovery = async (): Promise<DiagnosticResult> => {
    try {
      // Check if session recovery is working properly
      const recoveryData = localStorage.getItem('session-recovery-state');
      let recoveryState = null;
      
      if (recoveryData) {
        try {
          recoveryState = JSON.parse(recoveryData);
        } catch (e) {
          // Invalid recovery data
        }
      }

      // Check for excessive recovery attempts
      if (recoveryState && recoveryState.recoveryAttempts > 3) {
        return {
          id: 'session-recovery',
          name: 'Session Recovery',
          status: 'fail',
          message: `Excessive recovery attempts: ${recoveryState.recoveryAttempts}`,
          details: recoveryState,
          timestamp: new Date()
        };
      }

      if (recoveryState && recoveryState.isRecovering) {
        return {
          id: 'session-recovery',
          name: 'Session Recovery',
          status: 'warning',
          message: 'Session recovery in progress',
          details: recoveryState,
          timestamp: new Date()
        };
      }

      return {
        id: 'session-recovery',
        name: 'Session Recovery',
        status: 'pass',
        message: 'Session recovery system healthy',
        details: recoveryState,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'session-recovery',
        name: 'Session Recovery',
        status: 'fail',
        message: `Session recovery check failed: ${error}`,
        timestamp: new Date()
      };
    }
  };

  // Update system metrics
  const updateMetrics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // @ts-ignore
      const memory = performance.memory;
      const memoryUsage = memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0;

      // Test connection latency
      const startTime = Date.now();
      await supabase.from('users').select('id').limit(1);
      const connectionLatency = Date.now() - startTime;

      const newMetrics: SystemMetrics = {
        memoryUsage,
        connectionLatency,
        authTokenValid: !!session,
        sessionActive: !!session && new Date(session.expires_at! * 1000) > new Date(),
        lastActivity: new Date(),
        errorCount: diagnostics.filter(d => d.status === 'fail').length,
        recoveryAttempts: 0 // This would come from session recovery state
      };

      setMetrics(newMetrics);
    } catch (error) {
      console.error('Failed to update metrics:', error);
    }
  };

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      runDiagnostics();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Initial load
  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pass: 'default',
      warning: 'secondary',
      fail: 'destructive',
      running: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Diagnostics</h2>
          <p className="text-muted-foreground">
            Comprehensive system health and loading loop detection
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Stop Auto-Refresh' : 'Start Auto-Refresh'}
          </Button>
          <Button
            onClick={runDiagnostics}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                Run Diagnostics
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Auth Status</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {user ? 'Authenticated' : 'Not Authenticated'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {user ? `User: ${user.email}` : 'No active session'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connection</CardTitle>
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.connectionLatency || 0}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Database latency
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.memoryUsage || 0}MB
                </div>
                <p className="text-xs text-muted-foreground">
                  JavaScript heap usage
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Issues</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {diagnostics.filter(d => d.status === 'fail').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Failed diagnostics
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-4">
          <div className="space-y-4">
            {diagnostics.map((diagnostic) => (
              <Card key={diagnostic.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(diagnostic.status)}
                      <CardTitle className="text-lg">{diagnostic.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(diagnostic.status)}
                      <span className="text-sm text-muted-foreground">
                        {diagnostic.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <CardDescription>{diagnostic.message}</CardDescription>
                </CardHeader>
                {diagnostic.details && (
                  <CardContent>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(diagnostic.details, null, 2)}
                    </pre>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {metrics && (
            <Card>
              <CardHeader>
                <CardTitle>System Metrics</CardTitle>
                <CardDescription>Real-time system performance data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Memory Usage</label>
                      <div className="text-2xl font-bold">{metrics.memoryUsage}MB</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Connection Latency</label>
                      <div className="text-2xl font-bold">{metrics.connectionLatency}ms</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Auth Token Valid</label>
                      <div className="text-2xl font-bold">
                        {metrics.authTokenValid ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Session Active</label>
                      <div className="text-2xl font-bold">
                        {metrics.sessionActive ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Logs</CardTitle>
              <CardDescription>Real-time diagnostic activity log</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}