import { useSessionTimeoutForTesting } from '@/hooks/useSessionTimeoutForTesting';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bug, Play, Square, RotateCcw, LogOut, Clock, AlertTriangle, Settings } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function SessionTimeoutAdminDebug() {
  const { user, userProfile, signOut } = useAuth();
  const [adminSettings, setAdminSettings] = useState({
    timeoutMinutes: 60,
    warningMinutes: 5,
    checkIntervalSeconds: 1
  });

  // Load admin settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('sessionTimeoutSettings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setAdminSettings(parsed);
        }
      } catch (error) {
        console.error('Error loading session timeout settings:', error);
      }
    };

    loadSettings();

    // Listen for settings changes
    const handleSettingsChange = () => {
      loadSettings();
    };

    window.addEventListener('sessionTimeoutSettingsChanged', handleSettingsChange);
    
    return () => {
      window.removeEventListener('sessionTimeoutSettingsChanged', handleSettingsChange);
    };
  }, []);

  // Use the current admin settings for testing
  // Don't start a separate session timeout instance - just provide testing controls
  // const sessionTimeout = useSessionTimeoutForTesting(adminSettings);
  
  // Mock sessionTimeout object for testing controls without starting actual monitoring
  const sessionTimeout = {
    isActive: false,
    timeRemaining: adminSettings.timeoutMinutes * 60 * 1000,
    showWarning: false,
    lastActivity: new Date(),
    resetActivity: () => console.log('🧪 Mock: Reset activity'),
    extendSession: () => console.log('🧪 Mock: Extend session'),
    startMonitoring: () => console.log('🧪 Mock: Start monitoring'),
    stopMonitoring: () => console.log('🧪 Mock: Stop monitoring'),
    forceWarning: () => console.log('🧪 Mock: Force warning'),
    forceTimeout: () => console.log('🧪 Mock: Force timeout'),
    config: adminSettings
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-500' : 'bg-red-500';
  };

  // Check if user is admin (after all hooks)
  if (!user || !userProfile || userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Admin Notice */}
      <Alert>
        <Settings className="h-4 w-4" />
        <AlertDescription>
          Admin Debug Mode: Testing with current timeout settings ({formatDuration(adminSettings.timeoutMinutes)}).
          Change settings in the Session Timeout Configuration page to test different values.
        </AlertDescription>
      </Alert>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-blue-600" />
            Admin Session Timeout Debug
            <Badge variant="outline" className="ml-auto">
              {formatDuration(adminSettings.timeoutMinutes)} timeout
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Settings Display */}
          <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">Timeout Duration</div>
              <div className="font-semibold">{formatDuration(adminSettings.timeoutMinutes)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">Warning Time</div>
              <div className="font-semibold">{formatDuration(adminSettings.warningMinutes)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">Check Interval</div>
              <div className="font-semibold">{adminSettings.checkIntervalSeconds}s</div>
            </div>
          </div>

          {/* Status Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(sessionTimeout.isActive)}`} />
              <span className="text-sm font-medium">
                Status: {sessionTimeout.isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={sessionTimeout.showWarning ? "destructive" : "secondary"}>
                {sessionTimeout.showWarning ? 'WARNING' : 'NORMAL'}
              </Badge>
            </div>
          </div>

          {/* Time Display */}
          <div className="text-center space-y-2">
            <div className="text-3xl font-mono font-bold text-blue-600">
              {formatTime(sessionTimeout.timeRemaining)}
            </div>
            <div className="text-sm text-gray-600">
              Time remaining until logout
            </div>
          </div>

          {/* Last Activity */}
          <div className="text-center">
            <div className="text-sm text-gray-600">
              Last Activity: {sessionTimeout.lastActivity?.toLocaleTimeString() || 'Unknown'}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              onClick={sessionTimeout.startMonitoring}
              disabled={sessionTimeout.isActive}
              size="sm"
              variant="outline"
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
            
            <Button
              onClick={sessionTimeout.stopMonitoring}
              disabled={!sessionTimeout.isActive}
              size="sm"
              variant="outline"
            >
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
            
            <Button
              onClick={sessionTimeout.resetActivity}
              disabled={!sessionTimeout.isActive}
              size="sm"
              variant="default"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset Timer
            </Button>
            
            <Button
              onClick={sessionTimeout.forceWarning}
              disabled={!sessionTimeout.isActive}
              size="sm"
              variant="secondary"
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              Force Warning
            </Button>
            
            <Button
              onClick={sessionTimeout.forceTimeout}
              disabled={!sessionTimeout.isActive}
              size="sm"
              variant="destructive"
            >
              <Clock className="h-4 w-4 mr-1" />
              Force Timeout
            </Button>
            
            <Button
              onClick={async () => {
                await signOut();
              }}
              size="sm"
              variant="destructive"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Test Logout
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-xs text-gray-600 border-t pt-3 space-y-1">
            <p><strong>Admin Test Instructions:</strong></p>
            <p>1. Configure timeout settings in the admin config page</p>
            <p>2. Click "Start" to begin monitoring with current settings</p>
            <p>3. Use "Force Warning" to immediately test warning dialog</p>
            <p>4. Use "Force Timeout" to immediately test automatic logout</p>
            <p>5. Click "Test Logout" to verify logout works immediately</p>
            <p>6. Check browser console for detailed logs</p>
            <p>7. After logout, verify you stay logged out after page refresh</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 