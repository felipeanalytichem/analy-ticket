import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutWarning } from './SessionTimeoutWarning';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

interface SessionTimeoutManagerProps {
  children: React.ReactNode;
  timeoutMinutes?: number;
  warningMinutes?: number;
  checkIntervalSeconds?: number;
}

export function SessionTimeoutManager({
  children,
  timeoutMinutes,
  warningMinutes,
  checkIntervalSeconds,
}: SessionTimeoutManagerProps) {
  const { user } = useAuth();
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  // Pass props to hook - if undefined, hook will load from localStorage
  const sessionTimeout = useSessionTimeout({
    timeoutMinutes,
    warningMinutes,
    checkIntervalSeconds,
  });

  // Show warning dialog when session timeout warning is triggered
  useEffect(() => {
    if (sessionTimeout.showWarning && user) {
      setShowWarningDialog(true);
    } else {
      setShowWarningDialog(false);
    }
  }, [sessionTimeout.showWarning, user]);

  const handleExtendSession = () => {
    sessionTimeout.extendSession();
    setShowWarningDialog(false);
  };

  const handleLogoutNow = () => {
    setShowWarningDialog(false);
    // The actual logout is handled by the useSessionTimeout hook
  };

  const handleDismissWarning = () => {
    setShowWarningDialog(false);
  };

  // Only show session timeout for authenticated users
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      
      {/* Session Timeout Warning Dialog */}
      <SessionTimeoutWarning
        isOpen={showWarningDialog}
        timeRemaining={sessionTimeout.timeRemaining}
        onExtendSession={handleExtendSession}
        onLogoutNow={handleLogoutNow}
        onDismiss={handleDismissWarning}
      />

      {/* Optional: Debug info in development */}
      {process.env.NODE_ENV === 'development' && sessionTimeout.isActive && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-90 text-white p-3 rounded-lg text-xs z-50 font-mono shadow-lg border border-gray-600">
          <div className="text-green-400 font-semibold mb-1">🔒 SESSION DEBUG</div>
          <div className="space-y-1">
            <div>Status: <span className="text-green-300">{sessionTimeout.isActive ? 'ACTIVE' : 'INACTIVE'}</span></div>
            <div>Time Left: <span className="text-yellow-300">{Math.floor(sessionTimeout.timeRemaining / 60000)}m {Math.floor((sessionTimeout.timeRemaining % 60000) / 1000)}s</span></div>
            <div>Warning: <span className={sessionTimeout.showWarning ? 'text-red-300' : 'text-gray-400'}>{sessionTimeout.showWarning ? '🚨 ACTIVE' : 'None'}</span></div>
            <div>Last Activity: <span className="text-blue-300">{sessionTimeout.lastActivity?.toLocaleTimeString()}</span></div>
            <div className="text-xs text-gray-400 mt-1">Updates every second</div>
          </div>
        </div>
      )}
    </>
  );
} 