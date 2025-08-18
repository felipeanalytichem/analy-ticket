import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectionMonitor } from '../useConnectionMonitor';

// Mock services
vi.mock('@/services/ConnectionMonitor', () => ({
  ConnectionMonitor: {
    getInstance: vi.fn(),
    createInstance: vi.fn(),
    resetInstance: vi.fn()
  }
}));

vi.mock('@/services/AutoReconnectionService', () => ({
  AutoReconnectionService: {
    getInstance: vi.fn(),
    createInstance: vi.fn(),
    resetInstance: vi.fn()
  }
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    })),
    rpc: vi.fn(),
    realtime: {
      isConnected: vi.fn(() => true),
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn()
    }
  }
}));

describe('useConnectionMonitor', () => {
  let mockConnectionMonitor: any;
  let mockAutoReconnectionService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create mock instances
    mockConnectionMonitor = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      performHealthCheck: vi.fn().mockResolvedValue(true),
      getConnectionStatus: vi.fn().mockReturnValue({
        isOnline: true,
        quality: 'excellent',
        latency: 100,
        lastConnected: new Date(),
        reconnectAttempts: 0,
        supabaseConnected: true,
        networkConnected: true
      }),
      getConnectionQuality: vi.fn().mockReturnValue({
        score: 95,
        rating: 'excellent',
        factors: {
          latency: 100,
          successRate: 1.0,
          stability: 1.0
        }
      }),
      onConnectionChange: vi.fn(),
      onReconnected: vi.fn(),
      onConnectionLost: vi.fn(),
      cleanup: vi.fn()
    };

    mockAutoReconnectionService = {
      start: vi.fn(),
      stop: vi.fn(),
      forceReconnection: vi.fn().mockResolvedValue(true),
      updateConfig: vi.fn(),
      getReconnectionState: vi.fn().mockReturnValue({
        isReconnecting: false,
        currentAttempt: 0,
        nextAttemptIn: 0,
        lastAttemptTime: null,
        strategy: 'exponential',
        reason: '',
        circuitBreakerOpen: false,
        fallbackModeActive: false,
        adaptiveDelayMultiplier: 1.0
      }),
      getReconnectionMetrics: vi.fn().mockReturnValue({
        totalAttempts: 0,
        successfulReconnections: 0,
        failedAttempts: 0,
        averageReconnectionTime: 0,
        lastSuccessfulReconnection: null,
        connectionUptime: 0
      }),
      onReconnectionStart: vi.fn(),
      onReconnectionSuccess: vi.fn(),
      onReconnectionFailure: vi.fn(),
      onMaxAttemptsReached: vi.fn(),
      onCircuitBreakerOpen: vi.fn(),
      onFallbackMode: vi.fn(),
      cleanup: vi.fn()
    };

    // Mock the service imports
    const { ConnectionMonitor } = await import('@/services/ConnectionMonitor');
    const { AutoReconnectionService } = await import('@/services/AutoReconnectionService');

    (ConnectionMonitor.getInstance as any).mockReturnValue(mockConnectionMonitor);
    (AutoReconnectionService.getInstance as any).mockReturnValue(mockAutoReconnectionService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      expect(result.current.connectionStatus).toBeDefined();
      expect(result.current.connectionQuality).toBeDefined();
      expect(result.current.reconnectionState).toBeDefined();
      expect(result.current.reconnectionMetrics).toBeDefined();
    });

    it('should initialize services on mount', () => {
      renderHook(() => useConnectionMonitor());

      expect(mockConnectionMonitor.onConnectionChange).toHaveBeenCalled();
      expect(mockConnectionMonitor.onReconnected).toHaveBeenCalled();
      expect(mockConnectionMonitor.onConnectionLost).toHaveBeenCalled();
      expect(mockAutoReconnectionService.onReconnectionStart).toHaveBeenCalled();
    });

    it('should auto-start monitoring when autoStart is true', () => {
      renderHook(() => useConnectionMonitor({ autoStart: true }));

      // Allow for async initialization
      act(() => {
        vi.runAllTimers();
      });

      expect(mockConnectionMonitor.startMonitoring).toHaveBeenCalled();
      expect(mockAutoReconnectionService.start).toHaveBeenCalled();
    });

    it('should not auto-start monitoring when autoStart is false', () => {
      renderHook(() => useConnectionMonitor({ autoStart: false }));

      act(() => {
        vi.runAllTimers();
      });

      expect(mockConnectionMonitor.startMonitoring).not.toHaveBeenCalled();
      expect(mockAutoReconnectionService.start).not.toHaveBeenCalled();
    });

    it('should apply custom reconnection configuration', () => {
      const customConfig = {
        maxAttempts: 10,
        baseDelay: 2000,
        maxDelay: 30000
      };

      renderHook(() => useConnectionMonitor({ 
        reconnectionConfig: customConfig 
      }));

      expect(mockAutoReconnectionService.updateConfig).toHaveBeenCalledWith(customConfig);
    });

    it('should not create AutoReconnectionService when disabled', async () => {
      const { AutoReconnectionService } = await import('@/services/AutoReconnectionService');
      
      renderHook(() => useConnectionMonitor({ 
        enableAutoReconnection: false 
      }));

      expect(AutoReconnectionService.getInstance).not.toHaveBeenCalled();
    });
  });

  describe('Connection Status Management', () => {
    it('should update connection status when ConnectionMonitor changes', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      // Get the connection change callback
      const connectionChangeCallback = mockConnectionMonitor.onConnectionChange.mock.calls[0][0];

      const newStatus = {
        isOnline: false,
        quality: 'offline',
        latency: -1,
        lastConnected: new Date(),
        reconnectAttempts: 1,
        supabaseConnected: false,
        networkConnected: false
      };

      act(() => {
        connectionChangeCallback(newStatus);
      });

      expect(result.current.connectionStatus).toEqual(newStatus);
      expect(result.current.isOnline).toBe(false);
    });

    it('should update connection quality when status changes', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const newQuality = {
        score: 30,
        rating: 'poor' as const,
        factors: {
          latency: 800,
          successRate: 0.6,
          stability: 0.4
        }
      };

      mockConnectionMonitor.getConnectionQuality.mockReturnValue(newQuality);

      // Trigger connection change to update quality
      const connectionChangeCallback = mockConnectionMonitor.onConnectionChange.mock.calls[0][0];
      
      act(() => {
        connectionChangeCallback({
          isOnline: true,
          quality: 'poor',
          latency: 800,
          lastConnected: new Date(),
          reconnectAttempts: 0,
          supabaseConnected: true,
          networkConnected: true
        });
      });

      expect(result.current.connectionQuality).toEqual(newQuality);
    });

    it('should handle connection restored events', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const reconnectedCallback = mockConnectionMonitor.onReconnected.mock.calls[0][0];

      const restoredStatus = {
        isOnline: true,
        quality: 'good',
        latency: 200,
        lastConnected: new Date(),
        reconnectAttempts: 0,
        supabaseConnected: true,
        networkConnected: true
      };

      mockConnectionMonitor.getConnectionStatus.mockReturnValue(restoredStatus);

      act(() => {
        reconnectedCallback();
      });

      expect(result.current.connectionStatus).toEqual(restoredStatus);
    });

    it('should handle connection lost events', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const connectionLostCallback = mockConnectionMonitor.onConnectionLost.mock.calls[0][0];

      const lostStatus = {
        isOnline: false,
        quality: 'offline',
        latency: -1,
        lastConnected: new Date(),
        reconnectAttempts: 1,
        supabaseConnected: false,
        networkConnected: false
      };

      mockConnectionMonitor.getConnectionStatus.mockReturnValue(lostStatus);

      act(() => {
        connectionLostCallback();
      });

      expect(result.current.connectionStatus).toEqual(lostStatus);
    });
  });

  describe('Reconnection State Management', () => {
    it('should update reconnection state on reconnection start', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const reconnectionStartCallback = mockAutoReconnectionService.onReconnectionStart.mock.calls[0][0];

      const newState = {
        isReconnecting: true,
        currentAttempt: 1,
        nextAttemptIn: 2000,
        lastAttemptTime: new Date(),
        strategy: 'exponential' as const,
        reason: 'Connection lost',
        circuitBreakerOpen: false,
        fallbackModeActive: false,
        adaptiveDelayMultiplier: 1.0
      };

      mockAutoReconnectionService.getReconnectionState.mockReturnValue(newState);

      act(() => {
        reconnectionStartCallback(1);
      });

      expect(result.current.reconnectionState).toEqual(newState);
      expect(result.current.isReconnecting).toBe(true);
    });

    it('should update reconnection metrics on success', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const reconnectionSuccessCallback = mockAutoReconnectionService.onReconnectionSuccess.mock.calls[0][0];

      const newMetrics = {
        totalAttempts: 3,
        successfulReconnections: 1,
        failedAttempts: 2,
        averageReconnectionTime: 1500,
        lastSuccessfulReconnection: new Date(),
        connectionUptime: 120000
      };

      mockAutoReconnectionService.getReconnectionMetrics.mockReturnValue(newMetrics);

      act(() => {
        reconnectionSuccessCallback();
      });

      expect(result.current.reconnectionMetrics).toEqual(newMetrics);
    });

    it('should handle reconnection failure events', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const reconnectionFailureCallback = mockAutoReconnectionService.onReconnectionFailure.mock.calls[0][0];

      const failureState = {
        isReconnecting: true,
        currentAttempt: 2,
        nextAttemptIn: 4000,
        lastAttemptTime: new Date(),
        strategy: 'exponential' as const,
        reason: 'Connection lost',
        circuitBreakerOpen: false,
        fallbackModeActive: false,
        adaptiveDelayMultiplier: 1.2
      };

      mockAutoReconnectionService.getReconnectionState.mockReturnValue(failureState);

      act(() => {
        reconnectionFailureCallback(2, new Error('Connection failed'));
      });

      expect(result.current.reconnectionState).toEqual(failureState);
    });

    it('should handle circuit breaker events', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const circuitBreakerCallback = mockAutoReconnectionService.onCircuitBreakerOpen.mock.calls[0][0];

      const circuitBreakerState = {
        isReconnecting: false,
        currentAttempt: 0,
        nextAttemptIn: 0,
        lastAttemptTime: new Date(),
        strategy: 'exponential' as const,
        reason: 'Circuit breaker opened',
        circuitBreakerOpen: true,
        fallbackModeActive: true,
        adaptiveDelayMultiplier: 2.0
      };

      mockAutoReconnectionService.getReconnectionState.mockReturnValue(circuitBreakerState);

      act(() => {
        circuitBreakerCallback();
      });

      expect(result.current.reconnectionState.circuitBreakerOpen).toBe(true);
    });

    it('should handle fallback mode events', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const fallbackModeCallback = mockAutoReconnectionService.onFallbackMode.mock.calls[0][0];

      const fallbackState = {
        isReconnecting: true,
        currentAttempt: 1,
        nextAttemptIn: 1000,
        lastAttemptTime: new Date(),
        strategy: 'linear' as const,
        reason: 'Fallback mode activated',
        circuitBreakerOpen: false,
        fallbackModeActive: true,
        adaptiveDelayMultiplier: 1.5
      };

      mockAutoReconnectionService.getReconnectionState.mockReturnValue(fallbackState);

      act(() => {
        fallbackModeCallback(true);
      });

      expect(result.current.reconnectionState.fallbackModeActive).toBe(true);
      expect(result.current.reconnectionState.strategy).toBe('linear');
    });
  });

  describe('Control Methods', () => {
    it('should start monitoring when startMonitoring is called', () => {
      const { result } = renderHook(() => useConnectionMonitor({ autoStart: false }));

      act(() => {
        result.current.startMonitoring();
      });

      expect(mockConnectionMonitor.startMonitoring).toHaveBeenCalled();
      expect(mockAutoReconnectionService.start).toHaveBeenCalled();
    });

    it('should stop monitoring when stopMonitoring is called', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      act(() => {
        result.current.stopMonitoring();
      });

      expect(mockConnectionMonitor.stopMonitoring).toHaveBeenCalled();
      expect(mockAutoReconnectionService.stop).toHaveBeenCalled();
    });

    it('should perform health check when performHealthCheck is called', async () => {
      const { result } = renderHook(() => useConnectionMonitor());

      let healthCheckResult: boolean;

      await act(async () => {
        healthCheckResult = await result.current.performHealthCheck();
      });

      expect(mockConnectionMonitor.performHealthCheck).toHaveBeenCalled();
      expect(healthCheckResult!).toBe(true);
    });

    it('should force reconnection when forceReconnection is called', async () => {
      const { result } = renderHook(() => useConnectionMonitor());

      let reconnectionResult: boolean;

      await act(async () => {
        reconnectionResult = await result.current.forceReconnection('Manual test');
      });

      expect(mockAutoReconnectionService.forceReconnection).toHaveBeenCalledWith('Manual test');
      expect(reconnectionResult!).toBe(true);
    });

    it('should update reconnection config when updateReconnectionConfig is called', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      const newConfig = {
        maxAttempts: 15,
        baseDelay: 3000
      };

      act(() => {
        result.current.updateReconnectionConfig(newConfig);
      });

      expect(mockAutoReconnectionService.updateConfig).toHaveBeenCalledWith(newConfig);
    });

    it('should handle errors gracefully when services are not available', async () => {
      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useConnectionMonitor({ enableAutoReconnection: false }));

      // These should not throw errors even when AutoReconnectionService is not available
      let forceReconnectionResult: boolean;
      
      await act(async () => {
        forceReconnectionResult = await result.current.forceReconnection();
      });

      act(() => {
        result.current.updateReconnectionConfig({ maxAttempts: 10 });
      });

      expect(forceReconnectionResult!).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AutoReconnectionService not available'));

      consoleSpy.mockRestore();
    });
  });

  describe('Periodic Updates', () => {
    it('should update state periodically', () => {
      renderHook(() => useConnectionMonitor());

      // Clear initial calls
      mockConnectionMonitor.getConnectionStatus.mockClear();
      mockConnectionMonitor.getConnectionQuality.mockClear();

      // Advance time by 5 seconds (update interval)
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockConnectionMonitor.getConnectionStatus).toHaveBeenCalled();
      expect(mockConnectionMonitor.getConnectionQuality).toHaveBeenCalled();
    });

    it('should continue periodic updates after multiple intervals', () => {
      renderHook(() => useConnectionMonitor());

      // Clear initial calls
      mockConnectionMonitor.getConnectionStatus.mockClear();

      // Advance time by multiple intervals
      act(() => {
        vi.advanceTimersByTime(15000); // 3 intervals
      });

      expect(mockConnectionMonitor.getConnectionStatus).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup services on unmount', () => {
      const { unmount } = renderHook(() => useConnectionMonitor());

      unmount();

      expect(mockConnectionMonitor.stopMonitoring).toHaveBeenCalled();
      expect(mockAutoReconnectionService.stop).toHaveBeenCalled();
    });

    it('should clear intervals on unmount', () => {
      const { unmount } = renderHook(() => useConnectionMonitor());

      const initialTimerCount = vi.getTimerCount();

      unmount();

      // Should not have leaked timers
      expect(vi.getTimerCount()).toBeLessThanOrEqual(initialTimerCount);
    });
  });

  describe('Error Handling', () => {
    it('should handle ConnectionMonitor initialization errors', () => {
      const { ConnectionMonitor } = require('@/services/ConnectionMonitor');
      ConnectionMonitor.getInstance.mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      // Should not throw error
      expect(() => {
        renderHook(() => useConnectionMonitor());
      }).not.toThrow();
    });

    it('should handle AutoReconnectionService initialization errors', () => {
      const { AutoReconnectionService } = require('@/services/AutoReconnectionService');
      AutoReconnectionService.getInstance.mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      // Should not throw error
      expect(() => {
        renderHook(() => useConnectionMonitor());
      }).not.toThrow();
    });

    it('should handle callback errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() => useConnectionMonitor());

      // Get callback and make it throw
      const connectionChangeCallback = mockConnectionMonitor.onConnectionChange.mock.calls[0][0];

      // This should not crash the hook
      act(() => {
        expect(() => {
          connectionChangeCallback(null); // Invalid status to trigger error
        }).not.toThrow();
      });

      consoleSpy.mockRestore();
    });
  });
});