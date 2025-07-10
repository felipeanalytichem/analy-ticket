import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Settings, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { formatDistanceToNow } from 'date-fns';

interface SessionTimeoutConfigProps {
  onConfigChange?: (config: { timeoutMinutes: number; warningMinutes: number }) => void;
}

export function SessionTimeoutConfig({ onConfigChange }: SessionTimeoutConfigProps) {
  const [timeoutMinutes, setTimeoutMinutes] = useState(60);
  const [warningMinutes, setWarningMinutes] = useState(5);
  
  // Get current session status for testing
  const sessionTimeout = useSessionTimeout({ 
    timeoutMinutes, 
    warningMinutes,
    checkIntervalSeconds: 1 // Real-time updates every second
  });

  const handleApplyConfig = () => {
    if (onConfigChange) {
      onConfigChange({ timeoutMinutes, warningMinutes });
    }
  };

  const handleResetActivity = () => {
    sessionTimeout.resetActivity();
  };

  const formatTimeRemaining = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const displayMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}:${displayMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${displayMinutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Session Timeout Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic logout settings for security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeout-minutes">Session Timeout (minutes)</Label>
              <Input
                id="timeout-minutes"
                type="number"
                min="5"
                max="480" // 8 hours max
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(parseInt(e.target.value) || 60)}
                placeholder="60"
              />
              <p className="text-xs text-gray-500">
                Time of inactivity before automatic logout (5-480 minutes)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="warning-minutes">Warning Time (minutes)</Label>
              <Input
                id="warning-minutes"
                type="number"
                min="1"
                max="30"
                value={warningMinutes}
                onChange={(e) => setWarningMinutes(parseInt(e.target.value) || 5)}
                placeholder="5"
              />
              <p className="text-xs text-gray-500">
                Show warning before timeout (1-30 minutes)
              </p>
            </div>
          </div>
          
          <Button onClick={handleApplyConfig} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Apply Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Current Session Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Session Status
          </CardTitle>
          <CardDescription>
            Monitor your current session timeout status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Session Active</Label>
              <Badge variant={sessionTimeout.isActive ? "default" : "secondary"}>
                {sessionTimeout.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Label>Time Remaining</Label>
              <div className="font-mono text-lg">
                {formatTimeRemaining(sessionTimeout.timeRemaining)}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Warning Status</Label>
              <Badge variant={sessionTimeout.showWarning ? "destructive" : "outline"}>
                {sessionTimeout.showWarning ? "Warning Active" : "No Warning"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Label>Last Activity</Label>
              <div className="text-sm text-gray-600">
                {sessionTimeout.lastActivity 
                  ? formatDistanceToNow(sessionTimeout.lastActivity, { addSuffix: true })
                  : 'No activity recorded'
                }
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleResetActivity} 
              variant="outline"
              disabled={!sessionTimeout.isActive}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Activity Timer
            </Button>
            
            <Button 
              onClick={sessionTimeout.extendSession} 
              variant="default"
              disabled={!sessionTimeout.isActive}
            >
              <Clock className="h-4 w-4 mr-2" />
              Extend Session
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Testing Instructions */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            Testing Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-700 dark:text-amber-300 space-y-2">
          <p>
            <strong>To test session timeout:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Set a short timeout (e.g., 2 minutes) and warning time (e.g., 30 seconds)</li>
            <li>Click "Apply Configuration" to activate the new settings</li>
            <li>Stop interacting with the application (no mouse movement, clicks, or keyboard input)</li>
            <li>Wait for the warning dialog to appear</li>
            <li>Either extend the session or let it automatically log you out</li>
          </ol>
          <p className="mt-3">
            <strong>Note:</strong> In development mode, you'll see a debug panel in the bottom-right corner 
            showing real-time session information.
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 