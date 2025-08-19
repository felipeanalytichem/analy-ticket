import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, RefreshCw, Zap, Settings, Trash2 } from 'lucide-react';
import { loadingLoopDetector, LoadingLoopReport } from '@/services/LoadingLoopDetector';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface FixAction {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoFix: boolean;
  action: () => Promise<boolean>;
}

export function LoadingLoopFixer() {
  const { signOut } = useAuth();
  const [report, setReport] = useState<LoadingLoopReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [fixActions, setFixActions] = useState<FixAction[]>([]);
  const [autoFixEnabled] = useState(false); // Disabled to prevent automatic fixes

  // Initialize fix actions
  useEffect(() => {
    const actions: FixAction[] = [
      {
        id: 'clear-auth-storage',
        name: 'Clear Authentication Storage',
        description: 'Clears all authentication tokens and session data from browser storage',
        severity: 'medium',
        autoFix: true,
        action: clearAuthStorage
      },
      {
        id: 'refresh-session',
        name: 'Refresh Session',
        description: 'Attempts to refresh the current authentication session',
        severity: 'low',
        autoFix: true,
        action: refreshSession
      },
      {
        id: 'clear-all-storage',
        name: 'Clear All Browser Storage',
        description: 'Clears all localStorage and sessionStorage data',
        severity: 'high',
        autoFix: false,
        action: clearAllStorage
      },
      {
        id: 'force-logout',
        name: 'Force Logout',
        description: 'Forces a complete logout and redirects to login page',
        severity: 'high',
        autoFix: false,
        action: forceLogout
      },
      {
        id: 'reload-page',
        name: 'Reload Page',
        description: 'Performs a hard reload of the current page',
        severity: 'medium',
        autoFix: true,
        action: reloadPage
      },
      {
        id: 'clear-cache',
        name: 'Clear Browser Cache',
        description: 'Clears browser cache and forces fresh resource loading',
        severity: 'medium',
        autoFix: false,
        action: clearBrowserCache
      }
    ];

    setFixActions(actions);
  }, [signOut]);

  // Analyze current state
  const analyzeLoadingLoops = async () => {
    setIsAnalyzing(true);
    try {
      // DISABLED: LoadingLoopDetector monitoring disabled to prevent infinite loops
      console.log('⚠️ LoadingLoopDetector monitoring disabled - returning safe report');
      
      // Return a safe mock report instead of starting problematic monitoring
      const mockReport: LoadingLoopReport = {
        isLoopDetected: false,
        severity: 'none',
        patterns: [],
        summary: 'Loading loop monitoring disabled to prevent performance issues',
        recommendations: ['Monitoring has been disabled for system stability'],
        timestamp: new Date()
      };
      
      setReport(mockReport);
      
      // Auto-fix if enabled and critical issues detected
      if (autoFixEnabled && mockReport.severity === 'critical') {
        await performAutoFix(mockReport);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('Analysis failed', {
        description: 'Unable to analyze loading loops. Check console for details.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Perform automatic fixes
  const performAutoFix = async (currentReport: LoadingLoopReport) => {
    if (isFixing) return;

    setIsFixing(true);
    setFixProgress(0);

    try {
      const applicableActions = getApplicableActions(currentReport);
      const autoFixActions = applicableActions.filter(action => action.autoFix);
      
      if (autoFixActions.length === 0) {
        toast.warning('No automatic fixes available', {
          description: 'Manual intervention may be required.'
        });
        return;
      }

      toast.info('Starting automatic fixes...', {
        description: `Applying ${autoFixActions.length} fixes`
      });

      for (let i = 0; i < autoFixActions.length; i++) {
        const action = autoFixActions[i];
        setFixProgress(((i + 1) / autoFixActions.length) * 100);
        
        try {
          console.log(`🔧 Applying fix: ${action.name}`);
          const success = await action.action();
          
          if (success) {
            toast.success(`Fix applied: ${action.name}`);
          } else {
            toast.warning(`Fix failed: ${action.name}`);
          }
        } catch (error) {
          console.error(`Fix failed: ${action.name}`, error);
          toast.error(`Fix error: ${action.name}`);
        }

        // Wait between fixes
        if (i < autoFixActions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Re-analyze after fixes
      setTimeout(() => {
        analyzeLoadingLoops();
      }, 2000);

    } catch (error) {
      console.error('Auto-fix failed:', error);
      toast.error('Auto-fix failed', {
        description: 'Check console for details.'
      });
    } finally {
      setIsFixing(false);
      setFixProgress(0);
    }
  };

  // Manual fix application
  const applyManualFix = async (actionId: string) => {
    const action = fixActions.find(a => a.id === actionId);
    if (!action) return;

    setIsFixing(true);
    try {
      console.log(`🔧 Applying manual fix: ${action.name}`);
      const success = await action.action();
      
      if (success) {
        toast.success(`Fix applied: ${action.name}`);
        // Re-analyze after fix
        setTimeout(() => {
          analyzeLoadingLoops();
        }, 1000);
      } else {
        toast.error(`Fix failed: ${action.name}`);
      }
    } catch (error) {
      console.error(`Manual fix failed: ${action.name}`, error);
      toast.error(`Fix error: ${action.name}`);
    } finally {
      setIsFixing(false);
    }
  };

  // Get applicable actions based on report
  const getApplicableActions = (currentReport: LoadingLoopReport): FixAction[] => {
    if (!currentReport.isLoopDetected) return [];

    const actions: FixAction[] = [];

    // Check for auth-related patterns
    const hasAuthPatterns = currentReport.patterns.some(p => 
      p.id.includes('auth') || p.pattern.includes('auth') || p.pattern.includes('token')
    );

    if (hasAuthPatterns) {
      actions.push(
        fixActions.find(a => a.id === 'clear-auth-storage')!,
        fixActions.find(a => a.id === 'refresh-session')!
      );
    }

    // Check for session patterns
    const hasSessionPatterns = currentReport.patterns.some(p => 
      p.id.includes('session') || p.pattern.includes('session')
    );

    if (hasSessionPatterns) {
      actions.push(
        fixActions.find(a => a.id === 'refresh-session')!,
        fixActions.find(a => a.id === 'clear-auth-storage')!
      );
    }

    // Check for memory patterns
    const hasMemoryPatterns = currentReport.patterns.some(p => 
      p.id.includes('memory') || p.pattern.includes('memory')
    );

    if (hasMemoryPatterns) {
      actions.push(
        fixActions.find(a => a.id === 'reload-page')!,
        fixActions.find(a => a.id === 'clear-cache')!
      );
    }

    // Critical severity - add all fixes
    if (currentReport.severity === 'critical') {
      actions.push(...fixActions);
    }

    // Remove duplicates
    return Array.from(new Set(actions)).filter(Boolean);
  };

  // Fix action implementations
  async function clearAuthStorage(): Promise<boolean> {
    try {
      const authKeys = [
        'sb-plbmgjqitlxedsmdqpld-auth-token',
        'sb-plbmgjqitlxedsmdqpld-auth-token-code-verifier',
        'supabase.auth.token'
      ];

      authKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      // Clear any other auth-related keys
      Object.keys(localStorage).forEach(key => {
        if (key.includes('auth') || key.includes('session') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });

      console.log('✅ Auth storage cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear auth storage:', error);
      return false;
    }
  }

  async function refreshSession(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh failed:', error);
        return false;
      }

      console.log('✅ Session refreshed');
      return true;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
  }

  async function clearAllStorage(): Promise<boolean> {
    try {
      // Save theme preference
      const theme = localStorage.getItem('vite-ui-theme');
      
      localStorage.clear();
      sessionStorage.clear();
      
      // Restore theme
      if (theme) {
        localStorage.setItem('vite-ui-theme', theme);
      }

      console.log('✅ All storage cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  async function forceLogout(): Promise<boolean> {
    try {
      await signOut();
      console.log('✅ Force logout completed');
      return true;
    } catch (error) {
      console.error('Failed to force logout:', error);
      return false;
    }
  }

  async function reloadPage(): Promise<boolean> {
    try {
      window.location.reload();
      return true;
    } catch (error) {
      console.error('Failed to reload page:', error);
      return false;
    }
  }

  async function clearBrowserCache(): Promise<boolean> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      // Force reload with cache bypass
      window.location.reload();
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }

  // DISABLED: Auto-analysis disabled to prevent performance issues
  useEffect(() => {
    console.log('⚠️ LoadingLoopFixer: Auto-analysis disabled for system stability');
    // No automatic analysis to prevent infinite loops
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <RefreshCw className="h-4 w-4" />;
      case 'low':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Loading Loop Fixer</h2>
          <p className="text-muted-foreground">
            Automatically detect and fix loading loop issues
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoFixEnabled(!autoFixEnabled)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Auto-Fix: {autoFixEnabled ? 'ON' : 'OFF'}
          </Button>
          <Button
            onClick={analyzeLoadingLoops}
            disabled={isAnalyzing || isFixing}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Analyze Now
              </>
            )}
          </Button>
        </div>
      </div>

      {isFixing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Applying Fixes...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={fixProgress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">
              Progress: {Math.round(fixProgress)}%
            </p>
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="space-y-4">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  {getSeverityIcon(report.severity)}
                  <span className="ml-2">Loading Loop Status</span>
                </CardTitle>
                <Badge className={getSeverityColor(report.severity)}>
                  {report.severity.toUpperCase()}
                </Badge>
              </div>
              <CardDescription>{report.summary}</CardDescription>
            </CardHeader>
            {report.recommendations.length > 0 && (
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium">Recommendations:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {report.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Detected Patterns */}
          {report.patterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detected Patterns</CardTitle>
                <CardDescription>
                  {report.patterns.length} loading loop pattern(s) detected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.patterns.map((pattern) => (
                    <Alert key={pattern.id} className={getSeverityColor(pattern.severity)}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <strong>{pattern.name}</strong>
                            <Badge variant="outline">
                              Count: {pattern.detectionCount}
                            </Badge>
                          </div>
                          <p className="text-sm">{pattern.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Pattern: {pattern.pattern}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last detected: {pattern.lastDetected.toLocaleTimeString()}
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Fixes */}
          {report.isLoopDetected && (
            <Card>
              <CardHeader>
                <CardTitle>Available Fixes</CardTitle>
                <CardDescription>
                  Click to apply fixes for detected issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getApplicableActions(report).map((action) => (
                    <div
                      key={action.id}
                      className={`p-3 border rounded-lg ${getSeverityColor(action.severity)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{action.name}</h4>
                        <div className="flex items-center space-x-2">
                          {action.autoFix && (
                            <Badge variant="secondary" className="text-xs">
                              Auto
                            </Badge>
                          )}
                          <Badge className={getSeverityColor(action.severity)}>
                            {action.severity}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {action.description}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => applyManualFix(action.id)}
                        disabled={isFixing}
                        className="w-full"
                      >
                        {action.id === 'clear-all-storage' && <Trash2 className="mr-2 h-4 w-4" />}
                        {action.id === 'reload-page' && <RefreshCw className="mr-2 h-4 w-4" />}
                        Apply Fix
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!report && !isAnalyzing && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Click "Analyze Now" to check for loading loop issues
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}