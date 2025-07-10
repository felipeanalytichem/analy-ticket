import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, LogOut, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  timeRemaining: number; // in milliseconds
  onExtendSession: () => void;
  onLogoutNow: () => void;
  onDismiss: () => void;
}

export function SessionTimeoutWarning({
  isOpen,
  timeRemaining,
  onExtendSession,
  onLogoutNow,
  onDismiss,
}: SessionTimeoutWarningProps) {
  const { signOut } = useAuth();
  const [countdown, setCountdown] = useState(Math.ceil(timeRemaining / 1000));

  // Update countdown every second with real-time sync
  useEffect(() => {
    if (!isOpen) return;

    // Update immediately
    const newCountdown = Math.ceil(timeRemaining / 1000);
    setCountdown(newCountdown);

    // Auto-logout when time reaches 0
    if (newCountdown <= 0) {
      onLogoutNow();
      return;
    }

    const interval = setInterval(() => {
      const updatedCountdown = Math.ceil(timeRemaining / 1000);
      setCountdown(updatedCountdown);

      // Auto-logout when time reaches 0
      if (updatedCountdown <= 0) {
        onLogoutNow();
      }
    }, 100); // Update every 100ms for smoother countdown

    return () => clearInterval(interval);
  }, [isOpen, timeRemaining, onLogoutNow]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const maxWarningTime = Math.ceil(timeRemaining / 1000); // Dynamic based on actual remaining time
  const progressValue = Math.max(0, Math.min(100, (countdown / maxWarningTime) * 100));

  const handleExtendSession = () => {
    onExtendSession();
    onDismiss();
  };

  const handleLogoutNow = async () => {
    try {
      await signOut();
      onLogoutNow();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <Clock className="h-5 w-5" />
            Session Expiring Soon
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Your session will expire due to inactivity in:
              </p>
              <div className="text-2xl font-bold text-amber-600 mb-3">
                {formatTime(countdown)}
              </div>
              <Progress 
                value={progressValue} 
                className="h-2 mb-4"
                // @ts-ignore - Progress component accepts className for styling
                style={{
                  '--progress-background': 'rgb(254 215 170)', // amber-200
                  '--progress-foreground': countdown > 60 ? 'rgb(245 158 11)' : 'rgb(239 68 68)', // amber-500 or red-500
                } as any}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Click "Stay Logged In" to continue using the application, or you'll be automatically logged out.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleLogoutNow}
            className="w-full sm:w-auto order-2 sm:order-1"
            size="sm"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout Now
          </Button>
          <AlertDialogAction
            onClick={handleExtendSession}
            className="w-full sm:w-auto order-1 sm:order-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 