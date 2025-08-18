import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Zap, 
  Database, 
  Wifi, 
  User,
  Settings,
  Bug,
  TrendingUp
} from 'lucide-react';
import { DiagnosticPanel } from '@/components/diagnostics/DiagnosticPanel';
import { LoadingLoopFixer } from '@/components/diagnostics/LoadingLoopFixer';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function DiagnosticsPage() {
  const { user, session } = useAuth();
  const [quickFixRunning, setQuickFixRunning] = useState(false);

  // Quick system status check
  const getSystemStatus = () => {
    const issues = [];
    
    if (!user) issues.push('No authenticated user');
    if (!session) issues.push('No active session');
    if (!navigator.onLine) issues.push('Browser offline');
    
    // @ts-ignore
    const memory = performance.memory;
    if (memory) {
      const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (usagePercent > 80) issues.push('High memory usage');
    }

    return {
      status: issues.length === 0 ? 'healthy' : issues.length < 3 ? 'warning' : 'critical',
      issues
    };
  };

  const systemStatus = getSystemStatus();

  // Quick fix for common issues
  const runQuickFix = async () => {
    setQuickFixRunning(true);
    
    try {
      toast.info('Running quick fixes...', {
        description: 'Applying common solutions for loading issues'
      });

      // Clear problematic storage items
      const problematicKeys = Object.keys(localStorage).filter(key => 
        key.includes('session-recovery') || 
        key.includes('error-count') ||
        key.includes('retry-count')
      );

      problematicKeys.forEach(key => {
        localStorage.removeItem(key);
      });

      // Clear session storage
      sessionStorage.clear();

      // Force garbage collection if available
      // @ts-ignore
      if (window.gc) {
        window.gc();
      }

      toast.success('Quick fixes applied', {
        description: 'Common loading issues have been resolved'
      });

    } catch (error) {
      console.error('Quick fix failed:', error);
      toast.error('Quick fix failed', {
        description: 'Some fixes could not be applied'
      });
    } finally {
      setQuickFixRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Diagnostics</h1>
          <p className="text-muted-foreground">
            Comprehensive system health monitoring and loading loop detection
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={runQuickFix}
            disabled={quickFixRunning}
          >
            {quickFixRunning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Fixing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Quick Fix
              </>
            )}
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {getStatusIcon(systemStatus.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {systemStatus.status}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemStatus.issues.length} issue(s) detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Authentication</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user ? 'Active' : 'Inactive'}
            </div>
            <p className="text-xs text-muted-foreground">
              {user ? `User: ${user.email}` : 'No authenticated user'}
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
              {navigator.onLine ? 'Online' : 'Offline'}
            </div>
            <p className="text-xs text-muted-foreground">
              Network connectivity status
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
              {/* @ts-ignore */}
              {performance.memory ? 
                Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 
                'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              JavaScript heap usage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Issues Alert */}
      {systemStatus.issues.length > 0 && (
        <Alert className={getStatusColor(systemStatus.status)}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <strong>System Issues Detected:</strong>
              <ul className="list-disc list-inside space-y-1">
                {systemStatus.issues.map((issue, index) => (
                  <li key={index} className="text-sm">{issue}</li>
                ))}
              </ul>
              <p className="text-sm">
                Use the diagnostic tools below to investigate and resolve these issues.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Diagnostic Tools */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center">
            <TrendingUp className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="flex items-center">
            <Activity className="mr-2 h-4 w-4" />
            Diagnostics
          </TabsTrigger>
          <TabsTrigger value="loop-fixer" className="flex items-center">
            <Bug className="mr-2 h-4 w-4" />
            Loop Fixer
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Common Issues & Solutions</CardTitle>
                <CardDescription>
                  Quick fixes for the most common loading problems
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                    <div>
                      <h4 className="font-medium">Page Loading in Loop</h4>
                      <p className="text-sm text-muted-foreground">
                        Usually caused by authentication or session issues
                      </p>
                      <p className="text-xs text-blue-600">
                        → Use the Loop Fixer tab for automatic resolution
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                    <div>
                      <h4 className="font-medium">Slow Loading</h4>
                      <p className="text-sm text-muted-foreground">
                        Network or database connectivity issues
                      </p>
                      <p className="text-xs text-blue-600">
                        → Check the Diagnostics tab for connection health
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    <div>
                      <h4 className="font-medium">Memory Issues</h4>
                      <p className="text-sm text-muted-foreground">
                        High memory usage or memory leaks
                      </p>
                      <p className="text-xs text-blue-600">
                        → Monitor memory usage in the Diagnostics tab
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <h4 className="font-medium">Session Expired</h4>
                      <p className="text-sm text-muted-foreground">
                        Authentication session has expired
                      </p>
                      <p className="text-xs text-blue-600">
                        → Use Quick Fix or refresh your session
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>
                  Current system and browser information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Browser:</span>
                    <p className="text-muted-foreground">{navigator.userAgent.split(' ')[0]}</p>
                  </div>
                  <div>
                    <span className="font-medium">Platform:</span>
                    <p className="text-muted-foreground">{navigator.platform}</p>
                  </div>
                  <div>
                    <span className="font-medium">Online:</span>
                    <p className="text-muted-foreground">{navigator.onLine ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Cookies:</span>
                    <p className="text-muted-foreground">{navigator.cookieEnabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Language:</span>
                    <p className="text-muted-foreground">{navigator.language}</p>
                  </div>
                  <div>
                    <span className="font-medium">Timezone:</span>
                    <p className="text-muted-foreground">{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                  </div>
                </div>
                
                {/* @ts-ignore */}
                {performance.memory && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Memory Usage</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="font-medium">Used:</span>
                        {/* @ts-ignore */}
                        <p>{Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB</p>
                      </div>
                      <div>
                        <span className="font-medium">Total:</span>
                        {/* @ts-ignore */}
                        <p>{Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)}MB</p>
                      </div>
                      <div>
                        <span className="font-medium">Limit:</span>
                        {/* @ts-ignore */}
                        <p>{Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)}MB</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="diagnostics">
          <DiagnosticPanel />
        </TabsContent>

        <TabsContent value="loop-fixer">
          <LoadingLoopFixer />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Settings</CardTitle>
              <CardDescription>
                Configure diagnostic and monitoring options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> Diagnostic settings are currently read-only. 
                  Advanced configuration options will be available in future updates.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Auto-Fix Loading Loops</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically apply fixes when critical loading loops are detected
                    </p>
                  </div>
                  <Badge variant="outline">Configurable in Loop Fixer</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Continuous Monitoring</h4>
                    <p className="text-sm text-muted-foreground">
                      Monitor system health in the background
                    </p>
                  </div>
                  <Badge variant="secondary">Always On</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Diagnostic Logging</h4>
                    <p className="text-sm text-muted-foreground">
                      Log diagnostic information to browser console
                    </p>
                  </div>
                  <Badge variant="secondary">Enabled</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}