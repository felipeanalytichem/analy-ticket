import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface RealTimeSessionDisplayProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
}

export function RealTimeSessionDisplay({ 
  timeoutMinutes = 60, 
  warningMinutes = 5 
}: RealTimeSessionDisplayProps) {
  const { user } = useAuth();
  const sessionTimeout = useSessionTimeout({
    timeoutMinutes,
    warningMinutes,
    checkIntervalSeconds: 1 // Real-time updates
  });

  if (!user) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Not logged in</p>
        </CardContent>
      </Card>
    );
  }

  const totalTimeMs = timeoutMinutes * 60 * 1000;
  const progressPercentage = Math.max(0, Math.min(100, (sessionTimeout.timeRemaining / totalTimeMs) * 100));
  
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusColor = () => {
    if (sessionTimeout.showWarning) return 'text-red-600';
    if (progressPercentage < 25) return 'text-orange-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (sessionTimeout.showWarning) return 'bg-red-500';
    if (progressPercentage < 25) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-blue-600" />
          Real-Time Session Monitor
        </CardTitle>
        <CardDescription>
          Live countdown showing session timeout status (updates every second)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Timer Display */}
        <div className="text-center space-y-2">
          <div className={`text-4xl font-mono font-bold ${getStatusColor()}`}>
            {formatTime(sessionTimeout.timeRemaining)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Time remaining until logout
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress 
            value={progressPercentage} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span className="font-medium">{Math.round(progressPercentage)}%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${sessionTimeout.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm">
              {sessionTimeout.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {sessionTimeout.showWarning ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            <span className="text-sm">
              {sessionTimeout.showWarning ? 'Warning Active' : 'Normal'}
            </span>
          </div>
        </div>

        {/* Last Activity */}
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Activity className="w-4 h-4" />
            <span>Last activity:</span>
            <Badge variant="outline" className="font-mono text-xs">
              {sessionTimeout.lastActivity?.toLocaleTimeString() || 'Unknown'}
            </Badge>
          </div>
        </div>

        {/* Real-time Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span>Updating in real-time (every second)</span>
        </div>
      </CardContent>
    </Card>
  );
} 