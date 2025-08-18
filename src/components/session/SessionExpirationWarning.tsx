import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useSessionContext } from '@/contexts/SessionContext';
import { cn } from '@/lib/utils';

export interface SessionExpirationWarningProps {
  /**
   * Custom warning threshold in milliseconds
   * @default 5 * 60 * 1000 (5 minutes)
   */
  warningThreshold?: number;
  
  /**
   * Custom warning message
   */
  customMessage?: string;
  
  /**
   * Whether to show the progress bar
   * @default true
   */
  showProgress?: boolean;
  
  /**
   * Whether to auto-hide after extension
   * @default true
   */
  autoHideAfterExtension?: boolean;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Callback when warning is dismissed
   */
  onDismiss?: () => void;
  
  /**
   * Callback when session is extended
   */
  onExtend?: () => void;
}

/**
 * SessionExpirationWarning component displays a warning when the user's session
 * is about to expire, with options to extend the session or dismiss the warning.
 */
export function SessionExpirationWarning({
  warningThreshold = 5 * 60 * 1000, // 5 minutes
  customMessage,
  showProgress = true,
  autoHideAfterExtension = true,
  className,
  onDismiss,
  onExtend
}: SessionExpirationWarningProps) {
  const { sessionStatus, extendSession } = useSessionManager();
  const { isSessionExpiring, expirationWarningTime } = useSessionContext();
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  /**
   * Update countdown timer
   */
  useEffect(() => {
    if (isSessionExpiring && expirationWarningTime && !isDismissed) {
      setTimeLeft(expirationWarningTime);
      setIsVisible(true);
      
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = Math.max(0, prev - 1000);
          if (newTime <= 0) {
            clearInterval(interval);
            setIsVisible(false);
          }
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else if (!isSessionExpiring) {
      setIsVisible(false);
      setIsDismissed(false);
    }
  }, [isSessionExpiring, expirationWarningTime, isDismissed]);

  /**
   * Handle session extension
   */
  const handleExtendSession = useCallback(async () => {
    setIsExtending(true);
    
    try {
      const success = await extendSession();
      
      if (success) {
        console.log('✅ Session extended successfully');
        onExtend?.();
        
        if (autoHideAfterExtension) {
          setIsVisible(false);
          setIsDismissed(true);
        }
      } else {
        console.error('❌ Failed to extend session');
        // Keep warning visible if extension failed
      }
    } catch (error) {
      console.error('❌ Error extending session:', error);
    } finally {
      setIsExtending(false);
    }
  }, [extendSession, onExtend, autoHideAfterExtension]);

  /**
   * Handle warning dismissal
   */
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setIsDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  /**
   * Format time remaining
   */
  const formatTimeRemaining = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  }, []);

  /**
   * Get urgency level based on time remaining
   */
  const getUrgencyLevel = useCallback((ms: number): 'low' | 'medium' | 'high' => {
    if (ms <= 60 * 1000) return 'high'; // Less than 1 minute
    if (ms <= 2 * 60 * 1000) return 'medium'; // Less than 2 minutes
    return 'low';
  }, []);

  /**
   * Calculate progress percentage
   */
  const getProgressPercentage = useCallback((): number => {
    if (!expirationWarningTime || expirationWarningTime <= 0) return 0;
    return Math.max(0, (timeLeft / expirationWarningTime) * 100);
  }, [timeLeft, expirationWarningTime]);

  // Don't render if not visible
  if (!isVisible || !sessionStatus.isActive) {
    return null;
  }

  const urgencyLevel = getUrgencyLevel(timeLeft);
  const progressPercentage = getProgressPercentage();
  const formattedTime = formatTimeRemaining(timeLeft);

  return (
    <div 
      className={cn(
        "fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-top-2",
        className
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <Card className={cn(
        "shadow-lg border-2",
        urgencyLevel === 'high' && "border-red-500 bg-red-50 dark:bg-red-950/20",
        urgencyLevel === 'medium' && "border-orange-500 bg-orange-50 dark:bg-orange-950/20",
        urgencyLevel === 'low' && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className={cn(
                "h-5 w-5",
                urgencyLevel === 'high' && "text-red-600 dark:text-red-400",
                urgencyLevel === 'medium' && "text-orange-600 dark:text-orange-400",
                urgencyLevel === 'low' && "text-yellow-600 dark:text-yellow-400"
              )} />
              <CardTitle className="text-sm font-semibold">
                Session Expiring Soon
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleDismiss}
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <CardDescription className="text-sm">
            {customMessage || (
              <>
                Your session will expire in{' '}
                <span className={cn(
                  "font-mono font-semibold",
                  urgencyLevel === 'high' && "text-red-700 dark:text-red-300",
                  urgencyLevel === 'medium' && "text-orange-700 dark:text-orange-300",
                  urgencyLevel === 'low' && "text-yellow-700 dark:text-yellow-300"
                )}>
                  {formattedTime}
                </span>
              </>
            )}
          </CardDescription>

          {showProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>Time Remaining</span>
                </span>
                <span>{formattedTime}</span>
              </div>
              <Progress 
                value={progressPercentage} 
                className={cn(
                  "h-2",
                  urgencyLevel === 'high' && "[&>div]:bg-red-500",
                  urgencyLevel === 'medium' && "[&>div]:bg-orange-500",
                  urgencyLevel === 'low' && "[&>div]:bg-yellow-500"
                )}
              />
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              size="sm"
              onClick={handleExtendSession}
              disabled={isExtending}
              className="flex-1"
            >
              {isExtending ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Extending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Extend Session
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              disabled={isExtending}
            >
              Dismiss
            </Button>
          </div>

          {urgencyLevel === 'high' && (
            <div className="text-xs text-red-600 dark:text-red-400 font-medium">
              ⚠️ Session will expire very soon! Please extend now to avoid losing your work.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SessionExpirationWarning;