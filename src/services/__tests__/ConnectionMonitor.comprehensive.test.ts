/**
 * Comprehensive unit tests for ConnectionMonitor
 * Tests connection monitoring, health checks, and recovery mechanisms
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionMonitor } from '../ConnectionMonitor';
import {
  createMockSupabaseClient,
  ConnectionSimulator,
  TimerUtils,
  ErrorSimulator,
  PerformanceTestUtils,
  MemoryTestUtils
} from '../../test/utils/sessionTestUtils';

// Mock Supabase
const mockSupabase = createMockSupabaseClient();
vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('ConnectionMonitor', () => {
  let connectionMonitor: ConnectionMonitor;
  let connectionSimulator: ConnectionSimulator;
  let memoryTracker: ReturnType<typeof MemoryTestUtils.trackTimers>;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    memoryTracker = MemoryTestUtils.trackTimers();
    connectionSimulator = new ConnectionSimulator();
    connectionMonitor = new ConnectionMonitor();
  });

  afterEach(() => {
    connectionMonitor.cleanup?.();
    memoryTracker.cleanup();
    TimerUtils.useRealTimers();
  });

  describe('Connection Monitoring Initialization', () => {
    it('should start monitoring successfully', () => {
      connectionMonitor.startMonitoring();

      expect(connectionMonitor.isMonitoring).toBe(true);
      expect(memoryTracker.getActiveTimers().size).toBeGreaterThan(0);
    });

    it('should not start monitoring if already monitoring', () => {
      connectionMonitor.startMonitoring();
      const initialTimers = memoryTracker.getActiveTimers().size;
      
      connectionMonitor.startMonitoring(); // Second call

      expect(memoryTracker.getActiveTimers().size).toBe(initialTimers);
    });

    it('should stop monitoring successfully', () => {
      connectionMonitor.startMonitoring();
      connectionMonitor.stopMonitoring();

      expect(connectionMonitor.isMonitoring).toBe(false);
      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should handle stop monitoring when not monitoring', () => {
      expect(() => connectionMonitor.stopMonitoring()).not.toThrow();
    });

    it('should setup event listeners on start', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      connectionMonitor.startMonitoring();

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should check initial connection status', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      connectionMonitor.startMonitoring();

      // Wait for initial check
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('Health Check Functionality', () => {
    beforeEach(() => {
      connectionMonitor.startMonitoring();
    });

    it('should perform health check successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.isOnline).toBe(true);
      expect(status.latency).toBeGreaterThan(0);
    });

    it('should handle health check failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(ErrorSimulator.networkError())
          })
        })
      });

      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.isOnline).toBe(false);
      expect(status.quality).toBe('offline');
    });

    it('should calculate connection quality based on latency', async () => {
      // Mock fast response
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              return new Promise(resolve => {
                setTimeout(() => resolve({ data: null, error: null }), 50);
              });
            })
          })
        })
      });

      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.quality).toBe('excellent');
    });

    it('should perform periodic health checks', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Advance timer to trigger periodic check
      TimerUtils.advanceTimersByTime(30000); // 30 seconds

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should handle PGRST116 error as success', async () => {
      const pgrst116Error = new Error('No rows returned');
      (pgrst116Error as any).code = 'PGRST116';

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(pgrst116Error)
          })
        })
      });

      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.isOnline).toBe(true);
    });
  });

  describe('Network Event Handling', () => {
    beforeEach(() => {
      connectionMonitor.startMonitoring();
    });

    it('should handle online event', () => {
      const callback = vi.fn();
      connectionMonitor.onConnectionChange(callback);

      connectionSimulator.setOnline(true);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        isOnline: true
      }));
    });

    it('should handle offline event', () => {
      const callback = vi.fn();
      connectionMonitor.onConnectionChange(callback);

      connectionSimulator.setOnline(false);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        isOnline: false,
        quality: 'offline'
      }));
    });

    it('should trigger reconnected callback when coming back online', () => {
      const reconnectedCallback = vi.fn();
      connectionMonitor.onReconnected(reconnectedCallback);

      // Go offline then online
      connectionSimulator.setOnline(false);
      connectionSimulator.setOnline(true);

      expect(reconnectedCallback).toHaveBeenCalled();
    });

    it('should trigger connection lost callback when going offline', () => {
      const connectionLostCallback = vi.fn();
      connectionMonitor.onConnectionLost(connectionLostCallback);

      connectionSimulator.setOnline(false);

      expect(connectionLostCallback).toHaveBeenCalled();
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      connectionMonitor.startMonitoring();
    });

    it('should attempt reconnection after connection failure', async () => {
      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.reject(ErrorSimulator.networkError());
              }
              return Promise.resolve({ data: null, error: null });
            })
          })
        })
      });

      await connectionMonitor.performHealthCheck();

      // Should schedule reconnection
      expect(memoryTracker.getActiveTimers().size).toBeGreaterThan(1);
    });

    it('should use exponential backoff for reconnection attempts', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(ErrorSimulator.networkError())
          })
        })
      });

      // First failure
      await connectionMonitor.performHealthCheck();
      const firstDelay = connectionMonitor.getReconnectionDelay();

      // Second failure
      await connectionMonitor.performHealthCheck();
      const secondDelay = connectionMonitor.getReconnectionDelay();

      expect(secondDelay).toBeGreaterThan(firstDelay);
    });

    it('should limit maximum reconnection attempts', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(ErrorSimulator.networkError())
          })
        })
      });

      // Perform multiple failed health checks
      for (let i = 0; i < 10; i++) {
        await connectionMonitor.performHealthCheck();
      }

      const status = connectionMonitor.getConnectionStatus();
      expect(status.reconnectAttempts).toBeLessThanOrEqual(5); // MAX_RECONNECT_ATTEMPTS
    });

    it('should reset reconnection attempts on successful connection', async () => {
      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 2) {
                return Promise.reject(ErrorSimulator.networkError());
              }
              return Promise.resolve({ data: null, error: null });
            })
          })
        })
      });

      // Fail twice, then succeed
      await connectionMonitor.performHealthCheck();
      await connectionMonitor.performHealthCheck();
      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.reconnectAttempts).toBe(0);
    });

    it('should cap reconnection delay at maximum value', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(ErrorSimulator.networkError())
          })
        })
      });

      // Perform many failed attempts to reach max delay
      for (let i = 0; i < 10; i++) {
        await connectionMonitor.performHealthCheck();
      }

      const delay = connectionMonitor.getReconnectionDelay();
      expect(delay).toBeLessThanOrEqual(30000); // 30 seconds max
    });
  });

  describe('Connection Status', () => {
    it('should return correct initial connection status', () => {
      const status = connectionMonitor.getConnectionStatus();

      expect(status.isOnline).toBe(true); // Default online
      expect(status.quality).toBe('excellent');
      expect(status.latency).toBe(0);
      expect(status.reconnectAttempts).toBe(0);
    });

    it('should update connection status after health check', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              return new Promise(resolve => {
                setTimeout(() => resolve({ data: null, error: null }), 100);
              });
            })
          })
        })
      });

      connectionMonitor.startMonitoring();
      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.latency).toBeGreaterThan(0);
      expect(status.lastConnected).toBeInstanceOf(Date);
    });

    it('should determine connection quality from latency', () => {
      const testCases = [
        { latency: 50, expectedQuality: 'excellent' },
        { latency: 150, expectedQuality: 'good' },
        { latency: 500, expectedQuality: 'poor' },
        { latency: 2000, expectedQuality: 'poor' }
      ];

      testCases.forEach(({ latency, expectedQuality }) => {
        const quality = connectionMonitor.getQualityFromLatency(latency);
        expect(quality).toBe(expectedQuality);
      });
    });

    it('should return offline status when not connected', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(ErrorSimulator.networkError())
          })
        })
      });

      connectionMonitor.startMonitoring();
      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.isOnline).toBe(false);
      expect(status.quality).toBe('offline');
      expect(status.latency).toBe(-1);
    });
  });

  describe('Event Callbacks', () => {
    beforeEach(() => {
      connectionMonitor.startMonitoring();
    });

    it('should register and call connection change callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      connectionMonitor.onConnectionChange(callback1);
      connectionMonitor.onConnectionChange(callback2);

      connectionSimulator.setOnline(false);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should register and call reconnected callbacks', () => {
      const callback = vi.fn();
      connectionMonitor.onReconnected(callback);

      connectionSimulator.setOnline(false);
      connectionSimulator.setOnline(true);

      expect(callback).toHaveBeenCalled();
    });

    it('should register and call connection lost callbacks', () => {
      const callback = vi.fn();
      connectionMonitor.onConnectionLost(callback);

      connectionSimulator.setOnline(false);

      expect(callback).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      connectionMonitor.onConnectionChange(errorCallback);
      connectionMonitor.onConnectionChange(normalCallback);

      expect(() => {
        connectionSimulator.setOnline(false);
      }).not.toThrow();

      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should perform health check within performance threshold', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => connectionMonitor.performHealthCheck()
      );

      expect(time).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle high-frequency status checks efficiently', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const promises = Array(10).fill(null).map(() => connectionMonitor.performHealthCheck());
      await Promise.all(promises);

      // Should not overwhelm the system
      expect(mockSupabase.from).toHaveBeenCalledTimes(10);
    });

    it('should update connection status efficiently', () => {
      const { time } = PerformanceTestUtils.measureExecutionTime(
        () => connectionMonitor.getConnectionStatus()
      );

      expect(time).toBeLessThan(5); // Should complete within 5ms
    });
  });

  describe('Memory Management', () => {
    it('should not leak timers when starting/stopping monitoring', () => {
      const initialTimers = memoryTracker.getActiveTimers().size;

      connectionMonitor.startMonitoring();
      connectionMonitor.stopMonitoring();

      expect(memoryTracker.getActiveTimers().size).toBe(initialTimers);
    });

    it('should cleanup resources properly', () => {
      connectionMonitor.startMonitoring();
      connectionMonitor.cleanup?.();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
      expect(connectionMonitor.isMonitoring).toBe(false);
    });

    it('should handle cleanup when not monitoring', () => {
      expect(() => connectionMonitor.cleanup?.()).not.toThrow();
    });

    it('should remove event listeners on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      connectionMonitor.startMonitoring();
      connectionMonitor.cleanup?.();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      connectionMonitor.startMonitoring();
    });

    it('should handle Supabase connection errors', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw ErrorSimulator.networkError();
      });

      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.isOnline).toBe(false);
    });

    it('should handle auth state change errors', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Auth error');
      });

      mockSupabase.auth.onAuthStateChange.mockImplementation(errorCallback);

      expect(() => connectionMonitor.startMonitoring()).not.toThrow();
    });

    it('should handle malformed health check responses', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: 'invalid', error: null })
          })
        })
      });

      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.isOnline).toBe(true); // Should still consider it online
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid online/offline transitions', () => {
      connectionMonitor.startMonitoring();
      const callback = vi.fn();
      connectionMonitor.onConnectionChange(callback);

      // Rapid transitions
      for (let i = 0; i < 10; i++) {
        connectionSimulator.setOnline(i % 2 === 0);
      }

      expect(callback).toHaveBeenCalledTimes(10);
    });

    it('should handle health check during monitoring stop', async () => {
      connectionMonitor.startMonitoring();
      
      const healthCheckPromise = connectionMonitor.performHealthCheck();
      connectionMonitor.stopMonitoring();
      
      await expect(healthCheckPromise).resolves.not.toThrow();
    });

    it('should handle multiple start/stop cycles', () => {
      expect(() => {
        for (let i = 0; i < 5; i++) {
          connectionMonitor.startMonitoring();
          connectionMonitor.stopMonitoring();
        }
      }).not.toThrow();
    });

    it('should handle navigator.onLine being undefined', () => {
      const originalOnLine = navigator.onLine;
      delete (navigator as any).onLine;

      expect(() => {
        connectionMonitor.startMonitoring();
        connectionMonitor.isOnline();
      }).not.toThrow();

      (navigator as any).onLine = originalOnLine;
    });

    it('should handle BroadcastChannel not being available', () => {
      const originalBroadcastChannel = global.BroadcastChannel;
      delete (global as any).BroadcastChannel;

      expect(() => new ConnectionMonitor()).not.toThrow();

      global.BroadcastChannel = originalBroadcastChannel;
    });
  });
});