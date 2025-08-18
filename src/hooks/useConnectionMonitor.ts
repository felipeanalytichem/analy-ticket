import { useEffect, useState, useCallback, useRef } from 'react';
import { ConnectionMonitor, ConnectionStatus, ConnectionQuality } from '@/services/ConnectionMonitor';
import { AutoReconnectionService, ReconnectionState, ReconnectionMetrics } from '@/services/AutoReconnectionService';

export interface UseConnectionMonitorOptions {
  autoStart?: boolean;
  enableAutoReconnection?: boolean;
  reconnectionConfig?: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    qualityThreshold?: number;
  };
}

export interface UseConnectionMonitorReturn {
  // Connection status
  connectionStatus: ConnectionStatus;
  connectionQuality: ConnectionQuality;
  isOnline: boolean;
  
  // Reconnection state
  reconnectionState: ReconnectionState;
  reconnectionMetrics: ReconnectionMetrics;
  isReconnecting: boolean;
  
  // Control methods
  startMonitoring: () => void;
  stopMonitoring: () => void;
  performHealthCheck: () => Promise<boolean>;
  forceReconnection: (reason?: string) => Promise<boolean>;
  
  // Configuration
  updateReconnectionConfig: (config: any) => void;
}

/**
 * Hook for managing connection monitoring and automatic reconnection
 */
export function useConnectionMonitor(options: UseConnectionMonitorOptions = {}): UseConnectionMonitorReturn {
  const {
    autoStart = true,
    enableAutoReconnection = true,
    reconnectionConfig = {}
  } = options;

  // Services
  const connectionMonitorRef = useRef<ConnectionMonitor | null>(null);
  const autoReconnectionServiceRef = useRef<AutoReconnectionService | null>(null);

  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isOnline: false,
    quality: 'offline',
    latency: -1,
    lastConnected: new Date(),
    reconnectAttempts: 0,
    supabaseConnected: false,
    networkConnected: navigator.onLine
  });

  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    score: 0,
    rating: 'offline',
    factors: {
      latency: -1,
      successRate: 0,
      stability: 0
    }
  });

  const [reconnectionState, setReconnectionState] = useState<ReconnectionState>({
    isReconnecting: false,
    currentAttempt: 0,
    nextAttemptIn: 0,
    lastAttemptTime: null,
    strategy: 'exponential',
    reason: '',
    circuitBreakerOpen: false,
    fallbackModeActive: false,
    adaptiveDelayMultiplier: 1.0
  });

  const [reconnectionMetrics, setReconnectionMetrics] = useState<ReconnectionMetrics>({
    totalAttempts: 0,
    successfulReconnections: 0,
    failedAttempts: 0,
    averageReconnectionTime: 0,
    lastSuccessfulReconnection: null,
    connectionUptime: 0
  });

  /**
   * Initialize services
   */
  const initializeServices = useCallback(() => {
    if (connectionMonitorRef.current) {
      return; // Already initialized
    }

    console.log('🔍 [useConnectionMonitor] Initializing connection monitoring services');

    // Create ConnectionMonitor instance
    connectionMonitorRef.current = ConnectionMonitor.getInstance();

    // Create AutoReconnectionService if enabled
    if (enableAutoReconnection) {
      autoReconnectionServiceRef.current = AutoReconnectionService.getInstance(
        connectionMonitorRef.current
      );

      // Apply custom configuration
      if (Object.keys(reconnectionConfig).length > 0) {
        autoReconnectionServiceRef.current.updateConfig(reconnectionConfig);
      }
    }

    // Set up event listeners
    setupEventListeners();

    // Update initial state
    updateConnectionState();
    updateReconnectionState();
  }, [enableAutoReconnection, reconnectionConfig]);

  /**
   * Set up event listeners for connection and reconnection events
   */
  const setupEventListeners = useCallback(() => {
    const connectionMonitor = connectionMonitorRef.current;
    const autoReconnectionService = autoReconnectionServiceRef.current;

    if (!connectionMonitor) return;

    // Connection status change events
    connectionMonitor.onConnectionChange((status) => {
      console.log('🔍 [useConnectionMonitor] Connection status changed:', status);
      setConnectionStatus(status);
      updateConnectionQuality();
    });

    connectionMonitor.onReconnected(() => {
      console.log('✅ [useConnectionMonitor] Connection restored');
      updateConnectionState();
      updateConnectionQuality();
    });

    connectionMonitor.onConnectionLost(() => {
      console.log('❌ [useConnectionMonitor] Connection lost');
      updateConnectionState();
      updateConnectionQuality();
    });

    // Auto-reconnection events
    if (autoReconnectionService) {
      autoReconnectionService.onReconnectionStart((attempt) => {
        console.log(`🔄 [useConnectionMonitor] Reconnection attempt ${attempt} started`);
        updateReconnectionState();
      });

      autoReconnectionService.onReconnectionSuccess(() => {
        console.log('✅ [useConnectionMonitor] Reconnection successful');
        updateReconnectionState();
        updateReconnectionMetrics();
      });

      autoReconnectionService.onReconnectionFailure((attempt, error) => {
        console.log(`❌ [useConnectionMonitor] Reconnection attempt ${attempt} failed:`, error);
        updateReconnectionState();
        updateReconnectionMetrics();
      });

      autoReconnectionService.onMaxAttemptsReached(() => {
        console.log('🚫 [useConnectionMonitor] Maximum reconnection attempts reached');
        updateReconnectionState();
        updateReconnectionMetrics();
      });

      autoReconnectionService.onCircuitBreakerOpen(() => {
        console.log('⚡ [useConnectionMonitor] Circuit breaker opened');
        updateReconnectionState();
      });

      autoReconnectionService.onFallbackMode((active) => {
        console.log(`🔄 [useConnectionMonitor] Fallback mode ${active ? 'activated' : 'deactivated'}`);
        updateReconnectionState();
      });
    }
  }, []);

  /**
   * Update connection state from services
   */
  const updateConnectionState = useCallback(() => {
    const connectionMonitor = connectionMonitorRef.current;
    if (!connectionMonitor) return;

    const status = connectionMonitor.getConnectionStatus();
    setConnectionStatus(status);
  }, []);

  /**
   * Update connection quality from services
   */
  const updateConnectionQuality = useCallback(() => {
    const connectionMonitor = connectionMonitorRef.current;
    if (!connectionMonitor) return;

    const quality = connectionMonitor.getConnectionQuality();
    setConnectionQuality(quality);
  }, []);

  /**
   * Update reconnection state from services
   */
  const updateReconnectionState = useCallback(() => {
    const autoReconnectionService = autoReconnectionServiceRef.current;
    if (!autoReconnectionService) return;

    const state = autoReconnectionService.getReconnectionState();
    setReconnectionState(state);
  }, []);

  /**
   * Update reconnection metrics from services
   */
  const updateReconnectionMetrics = useCallback(() => {
    const autoReconnectionService = autoReconnectionServiceRef.current;
    if (!autoReconnectionService) return;

    const metrics = autoReconnectionService.getReconnectionMetrics();
    setReconnectionMetrics(metrics);
  }, []);

  /**
   * Start connection monitoring
   */
  const startMonitoring = useCallback(() => {
    const connectionMonitor = connectionMonitorRef.current;
    const autoReconnectionService = autoReconnectionServiceRef.current;

    if (!connectionMonitor) {
      console.error('❌ [useConnectionMonitor] ConnectionMonitor not initialized');
      return;
    }

    console.log('🔍 [useConnectionMonitor] Starting connection monitoring');
    connectionMonitor.startMonitoring();

    if (autoReconnectionService && enableAutoReconnection) {
      console.log('🔄 [useConnectionMonitor] Starting auto-reconnection service');
      autoReconnectionService.start();
    }

    // Update state
    updateConnectionState();
    updateConnectionQuality();
    updateReconnectionState();
    updateReconnectionMetrics();
  }, [enableAutoReconnection, updateConnectionState, updateConnectionQuality, updateReconnectionState, updateReconnectionMetrics]);

  /**
   * Stop connection monitoring
   */
  const stopMonitoring = useCallback(() => {
    const connectionMonitor = connectionMonitorRef.current;
    const autoReconnectionService = autoReconnectionServiceRef.current;

    console.log('🔍 [useConnectionMonitor] Stopping connection monitoring');

    if (connectionMonitor) {
      connectionMonitor.stopMonitoring();
    }

    if (autoReconnectionService) {
      autoReconnectionService.stop();
    }
  }, []);

  /**
   * Perform manual health check
   */
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    const connectionMonitor = connectionMonitorRef.current;
    if (!connectionMonitor) {
      console.error('❌ [useConnectionMonitor] ConnectionMonitor not initialized');
      return false;
    }

    const result = await connectionMonitor.performHealthCheck();
    
    // Update state after health check
    updateConnectionState();
    updateConnectionQuality();
    
    return result;
  }, [updateConnectionState, updateConnectionQuality]);

  /**
   * Force reconnection attempt
   */
  const forceReconnection = useCallback(async (reason: string = 'Manual trigger'): Promise<boolean> => {
    const autoReconnectionService = autoReconnectionServiceRef.current;
    if (!autoReconnectionService) {
      console.error('❌ [useConnectionMonitor] AutoReconnectionService not available');
      return false;
    }

    const result = await autoReconnectionService.forceReconnection(reason);
    
    // Update state after force reconnection
    updateReconnectionState();
    updateReconnectionMetrics();
    
    return result;
  }, [updateReconnectionState, updateReconnectionMetrics]);

  /**
   * Update reconnection configuration
   */
  const updateReconnectionConfig = useCallback((config: any) => {
    const autoReconnectionService = autoReconnectionServiceRef.current;
    if (!autoReconnectionService) {
      console.error('❌ [useConnectionMonitor] AutoReconnectionService not available');
      return;
    }

    autoReconnectionService.updateConfig(config);
    console.log('🔄 [useConnectionMonitor] Reconnection configuration updated:', config);
  }, []);

  /**
   * Initialize services on mount
   */
  useEffect(() => {
    initializeServices();

    return () => {
      // Cleanup on unmount
      console.log('🧹 [useConnectionMonitor] Cleaning up connection monitoring');
      
      const connectionMonitor = connectionMonitorRef.current;
      const autoReconnectionService = autoReconnectionServiceRef.current;

      if (connectionMonitor) {
        connectionMonitor.stopMonitoring();
      }

      if (autoReconnectionService) {
        autoReconnectionService.stop();
      }
    };
  }, [initializeServices]);

  /**
   * Auto-start monitoring if enabled
   */
  useEffect(() => {
    if (autoStart && connectionMonitorRef.current) {
      startMonitoring();
    }
  }, [autoStart, startMonitoring]);

  /**
   * Periodic state updates
   */
  useEffect(() => {
    const interval = setInterval(() => {
      updateConnectionState();
      updateConnectionQuality();
      updateReconnectionState();
      updateReconnectionMetrics();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [updateConnectionState, updateConnectionQuality, updateReconnectionState, updateReconnectionMetrics]);

  return {
    // Connection status
    connectionStatus,
    connectionQuality,
    isOnline: connectionStatus.isOnline,
    
    // Reconnection state
    reconnectionState,
    reconnectionMetrics,
    isReconnecting: reconnectionState.isReconnecting,
    
    // Control methods
    startMonitoring,
    stopMonitoring,
    performHealthCheck,
    forceReconnection,
    
    // Configuration
    updateReconnectionConfig
  };
}