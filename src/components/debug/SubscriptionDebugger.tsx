import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase, getSessionInfo } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Bug, RefreshCw, Trash2, Eye, EyeOff } from 'lucide-react';

interface DebugLog {
  id: string;
  timestamp: string;
  type: 'subscription' | 'session' | 'component' | 'error' | 'warning' | 'info';
  source: string;
  message: string;
  data?: any;
  level: 'low' | 'medium' | 'high' | 'critical' | 'info';
}

interface SubscriptionInfo {
  channelName: string;
  status: string;
  createdAt: string;
  component: string;
  userId?: string;
}

export const SubscriptionDebugger: React.FC = () => {
  const { userProfile } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [sessionInfo, setSessionInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [wasOpen, setWasOpen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const logCountRef = useRef(0);
  const isLoggingRef = useRef(false); // Prevent recursive logging
  const isVisibleRef = useRef(false); // Track visibility state persistently

  // Initialize visibility from localStorage
  useEffect(() => {
    try {
      const storedVisible = localStorage.getItem('debugger-visible') === 'true';
      setIsVisible(storedVisible);
      isVisibleRef.current = storedVisible;
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Global page visibility listener that ALWAYS runs (even when debug tool is hidden)
  useEffect(() => {
    const handleGlobalVisibilityChange = () => {
      const pageIsVisible = document.visibilityState === 'visible';
      
      // If page becomes visible, check if debug tool should be restored
      if (pageIsVisible) {
        try {
          const wasVisible = localStorage.getItem('debugger-visible') === 'true';
          if (wasVisible && !isVisible) {
            console.log('🔧 Debug tool was open, restoring visibility after tab switch');
            setIsVisible(true);
          }
        } catch {
          // Ignore localStorage errors
        }
      }
    };

    // This listener runs regardless of debug tool visibility
    document.addEventListener('visibilitychange', handleGlobalVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleGlobalVisibilityChange);
    };
  }, []); // No dependencies - this should always run

  // Add log entry
  const addLog = (
    type: DebugLog['type'],
    source: string,
    message: string,
    data?: any,
    level: DebugLog['level'] = 'info'
  ) => {
    const log: DebugLog = {
      id: `${Date.now()}-${++logCountRef.current}`,
      timestamp: new Date().toISOString(),
      type,
      source,
      message,
      data,
      level
    };
    
    setLogs(prev => [log, ...prev.slice(0, 199)]); // Keep last 200 logs
    
    // Don't log to console to avoid infinite loops
    // The debug tool should be silent in the console
  };

  // Monitor Supabase channels
  const monitorChannels = () => {
    try {
      // Access internal channel list (this is a hack but useful for debugging)
      const channels = (supabase as any).channels || [];
      const channelInfo: SubscriptionInfo[] = channels.map((channel: any, index: number) => ({
        channelName: channel.topic || `unknown-${index}`,
        status: channel.state || 'unknown',
        createdAt: new Date().toISOString(),
        component: 'unknown',
        userId: channel.params?.config?.presence?.key || 'unknown'
      }));
      
      setSubscriptions(channelInfo);
      
      // Log detailed channel information
      addLog('subscription', 'ChannelMonitor', `Found ${channels.length} active channels`, {
        totalChannels: channels.length,
        channelDetails: channelInfo.map(ch => ({
          name: ch.channelName,
          status: ch.status,
          userId: ch.userId
        }))
      });

      // Check for potential duplicate channels
      const channelNames = channelInfo.map(ch => ch.channelName);
      const duplicates = channelNames.filter((name, index) => channelNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        addLog('warning', 'ChannelMonitor', `Potential duplicate channels detected`, { duplicates }, 'high');
      }

      // Check for channels with similar names (potential conflicts)
      const similarChannels = channelNames.filter(name => 
        channelNames.some(otherName => 
          name !== otherName && 
          (name.includes(otherName) || otherName.includes(name))
        )
      );
      if (similarChannels.length > 0) {
        addLog('warning', 'ChannelMonitor', `Similar channel names detected`, { similarChannels }, 'medium');
      }

    } catch (error) {
      addLog('error', 'ChannelMonitor', 'Failed to access channel information', { error: error?.toString() }, 'high');
    }
  };

  // Monitor session info
  const monitorSession = async () => {
    try {
      const info = await getSessionInfo();
      setSessionInfo(info);
      
      if (!info.hasSession) {
        addLog('session', 'SessionMonitor', 'No active session found', info, 'high');
      } else if (info.isExpired) {
        addLog('session', 'SessionMonitor', 'Session is expired', info, 'critical');
      } else if (info.expiresWithin5Min) {
        addLog('session', 'SessionMonitor', 'Session expires within 5 minutes', info, 'high');
      } else if (info.expiresWithin1Min) {
        addLog('session', 'SessionMonitor', 'Session expires within 1 minute', info, 'critical');
      } else {
        addLog('session', 'SessionMonitor', `Session healthy (${info.timeLeftMinutes} min left)`, info);
      }
    } catch (error) {
      addLog('error', 'SessionMonitor', 'Failed to get session info', error, 'critical');
    }
  };

  // Monitor component states
  const monitorComponents = () => {
    addLog('component', 'ComponentMonitor', 'Auth Context State', {
      userProfile: userProfile ? { id: userProfile.id, role: userProfile.role } : null,
      loading: loading
    });
  };

  // Update visibility ref when state changes
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Hook into Supabase realtime events
  useEffect(() => {
    if (!isVisible) return;

    // Detect React Strict Mode
    const isStrictMode = React.version && document.querySelector('[data-reactroot]') !== null;
    addLog('component', 'StrictModeDetection', `React Strict Mode: ${isStrictMode ? 'ENABLED' : 'DISABLED'}`, { isStrictMode }, isStrictMode ? 'high' : 'info');

    // Disable console interception to prevent infinite loops
    // Focus on direct monitoring instead

    // Track component lifecycle
    addLog('component', 'ComponentLifecycle', 'Component mounted');

    // Initial monitoring
    addLog('component', 'DebuggerInit', 'Subscription Debugger initialized');
    monitorChannels();
    monitorSession();
    monitorComponents();

    // Auto refresh
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        monitorChannels();
        monitorSession();
        monitorComponents();
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      addLog('component', 'DebuggerCleanup', 'Subscription Debugger cleaned up');
    };
  }, [isVisible, autoRefresh]);

  // Esconder debug para usuários finais
  if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'agent')) {
    return null;
  }

  const clearLogs = () => {
    setLogs([]);
    addLog('component', 'DebuggerAction', 'Logs cleared');
  };

  const refreshAll = () => {
    monitorChannels();
    monitorSession();
    monitorComponents();
    addLog('component', 'DebuggerAction', 'Manual refresh triggered');
  };

  const getLogColor = (log: DebugLog) => {
    switch (log.level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeColor = (type: DebugLog['type']) => {
    switch (type) {
      case 'subscription': return 'bg-blue-100 text-blue-800';
      case 'session': return 'bg-green-100 text-green-800';
      case 'component': return 'bg-purple-100 text-purple-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredLogs = filterType === 'all' ? logs : logs.filter(log => log.type === filterType);

  if (!isVisible) {
    // Check if debug tool was previously open
    const wasOpen = (() => {
      try {
        return localStorage.getItem('debugger-visible') === 'true';
      } catch {
        return false;
      }
    })();

    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className={`bg-white shadow-lg ${wasOpen ? 'animate-pulse border-blue-500' : ''}`}
        >
          <Bug className="h-4 w-4 mr-2" />
          Debug Subscriptions
          {wasOpen && <span className="ml-2 text-xs text-blue-600">(was open)</span>}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-4 z-50 bg-white border rounded-lg shadow-2xl flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Subscription Debugger
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto: {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button onClick={refreshAll} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={clearLogs} variant="outline" size="sm">
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <Button onClick={() => setIsVisible(false)} variant="outline" size="sm">
              <EyeOff className="h-4 w-4" />
              Hide
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 flex gap-4 p-4 pt-0 overflow-hidden">
        {/* Left Panel - Status */}
        <div className="w-1/3 space-y-4">
          {/* Session Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Session Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {sessionInfo ? (
                <>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant={sessionInfo.hasSession ? 'default' : 'destructive'}>
                      {sessionInfo.hasSession ? 'Active' : 'None'}
                    </Badge>
                  </div>
                  {sessionInfo.hasSession && (
                    <>
                      <div className="flex justify-between">
                        <span>User:</span>
                        <span className="font-mono">{sessionInfo.userId?.slice(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expires:</span>
                        <span className="font-mono">{sessionInfo.timeLeftMinutes}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expired:</span>
                        <Badge variant={sessionInfo.isExpired ? 'destructive' : 'default'}>
                          {sessionInfo.isExpired ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div>Loading...</div>
              )}
            </CardContent>
          </Card>

          {/* Active Subscriptions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Channels ({subscriptions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                {subscriptions.length === 0 ? (
                  <div className="text-xs text-gray-500">No active channels</div>
                ) : (
                  <div className="space-y-1">
                    {subscriptions.map((sub, index) => (
                      <div key={index} className="text-xs p-2 bg-gray-50 rounded">
                        <div className="font-mono">{sub.channelName}</div>
                        <div className="flex justify-between mt-1">
                          <Badge variant="outline" className="text-xs">
                            {sub.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Component State */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Component State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>User:</span>
                <span>{userProfile?.id ? `${userProfile.role}` : 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span>Loading:</span>
                <Badge variant={loading ? 'destructive' : 'default'}>
                  {loading ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Page:</span>
                <Badge variant={document.visibilityState === 'visible' ? 'default' : 'secondary'}>
                  {document.visibilityState}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Logs */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium">Filter:</span>
            {['all', 'subscription', 'session', 'component', 'error', 'warning'].map(type => (
              <Button
                key={type}
                onClick={() => setFilterType(type)}
                variant={filterType === type ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
              >
                {type}
              </Button>
            ))}
          </div>

          <ScrollArea className="flex-1 border rounded">
            <div className="p-2 space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No logs to display</div>
              ) : (
                filteredLogs.map(log => (
                  <div
                    key={log.id}
                    className={`p-2 rounded border text-xs ${getLogColor(log)}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getTypeColor(log.type)}`}>
                          {log.type}
                        </Badge>
                        <span className="font-medium">{log.source}</span>
                      </div>
                      <span className="text-xs opacity-60">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="font-mono">{log.message}</div>
                    {log.data && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs opacity-60">Data</summary>
                        <pre className="mt-1 text-xs bg-black/5 p-1 rounded overflow-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}; 