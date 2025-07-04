import { useEffect, useState } from 'react';
import { supabase, isSessionReadyForRealtime } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const ConnectionMonitor = () => {
  const { user, session } = useAuth();
  const [showConnectionIssue, setShowConnectionIssue] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  useEffect(() => {
    if (!user || !session) {
      setShowConnectionIssue(false);
      return;
    }

    // Wait for auth to be fully established before monitoring
    const monitoringDelay = setTimeout(() => {
      const monitorConnection = async () => {
        try {
          // Check if session is ready for realtime
          const sessionReady = await isSessionReadyForRealtime();
          
          if (!sessionReady) {
            setConsecutiveFailures(prev => prev + 1);
          } else {
            // Check if realtime is actually connected
            const isConnected = supabase.realtime.isConnected();
            
            if (!isConnected) {
              setConsecutiveFailures(prev => prev + 1);
            } else {
              setConsecutiveFailures(0);
              setShowConnectionIssue(false);
            }
          }

          // Only show connection issue after 3 consecutive failures
          if (consecutiveFailures >= 3) {
            console.log('❌ Multiple connection failures detected, showing reconnect option');
            setShowConnectionIssue(true);
          }
          
        } catch (error) {
          console.error('Error monitoring connection:', error);
          setConsecutiveFailures(prev => prev + 1);
        }
      };

      // Check connection status every 45 seconds (less frequent)
      const connectionInterval = setInterval(monitorConnection, 45000);
      
      // Initial check after delay
      setTimeout(monitorConnection, 10000); // Wait 10 seconds for initial check

      return () => {
        clearInterval(connectionInterval);
      };
    }, 8000); // Wait 8 seconds after auth is ready

    return () => {
      clearTimeout(monitoringDelay);
    };
  }, [user, session, consecutiveFailures]);

  const handleReconnect = async () => {
    setReconnecting(true);
    setShowConnectionIssue(false);
    setConsecutiveFailures(0);
    
    try {
      console.log('🔄 Attempting to reconnect real-time connection...');
      
      // First check if session is ready
      const sessionReady = await isSessionReadyForRealtime();
      
      if (!sessionReady) {
        console.log('❌ Session not ready for reconnection');
        setShowConnectionIssue(true);
        return;
      }
      
      // Disconnect and reconnect
      supabase.realtime.disconnect();
      
      setTimeout(() => {
        supabase.realtime.connect();
        
        // Check if reconnection was successful
        setTimeout(() => {
          const isConnected = supabase.realtime.isConnected();
          if (!isConnected) {
            console.log('❌ Reconnection failed');
            setShowConnectionIssue(true);
          } else {
            console.log('✅ Reconnection successful');
          }
          setReconnecting(false);
        }, 5000);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error during reconnection:', error);
      setReconnecting(false);
      setShowConnectionIssue(true);
    }
  };

  // Don't show for non-authenticated users or if session is not ready
  if (!user || !session) return null;

  // Only show if there are confirmed connection issues
  if (!showConnectionIssue) return null;

  return (
    <Alert className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-red-600" />
        <AlertDescription className="flex-1">
          <span className="text-red-700 dark:text-red-300">
            ⚠️ Conexão em tempo real perdida. Você pode não receber notificações instantâneas.
          </span>
        </AlertDescription>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReconnect}
            disabled={reconnecting}
            className="border-yellow-300 hover:bg-yellow-100 dark:border-yellow-700 dark:hover:bg-yellow-900"
          >
            {reconnecting ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Reconectando...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Reconectar
              </>
            )}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
            className="border-yellow-300 hover:bg-yellow-100 dark:border-yellow-700 dark:hover:bg-yellow-900"
          >
            Atualizar Página
          </Button>
        </div>
      </div>
    </Alert>
  );
};
