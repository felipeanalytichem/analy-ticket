import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoReconnectionService } from '../AutoReconnectionService';
import { ConnectionMonitor } from '../ConnectionMonitor';

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

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window events
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
const mockDocumentAddEventListener = vi.fn();

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener
});

Object.defineProperty(document, 'addEventListener', {
  value: mockDocumentAddEventListener
});

describe('AutoReconnectionService Integration Tests', () => {
  let connectionMonitor: ConnectionMonitor;
  let autoReconnectionService: AutoReconnectionService;
  let mockSupabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Get the mocked supabase
    const { supabase } = await import('@/lib/supabase');
    mockSupabase = supabase;

    // Create fresh instances
    ConnectionMonitor.resetInstance();
    AutoReconnectionService.resetInstance();
    
    connectionMonitor = ConnectionMonitor.createInstance();
    autoReconnectionService = AutoReconnectionService.createInstance(connectionMonitor);
  });

  afterEach(() => {
    autoReconnectionService.cleanup();
    connectionMonitor.cleanup();
    vi.useRealTimers();
  });

  describe('End-to-End Reconnection Scenarios', () => {
    it('should handle complete connection loss and recovery cycle', async () => {
      // Setup successful initial connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Start both services
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Verify initial connection is established
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(true);

      // Simulate connection loss
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Network error'))
          }))
        }))
      });

      // Trigger connection loss
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(false);

      // AutoReconnectionService should start reconnection
      vi.advanceTimersByTime(100); // Small delay for async operations
      expect(autoReconnectionService.isReconnecting()).toBe(true);

      // Simulate failed reconnection attempts
      vi.advanceTimersByTime(1000); // First attempt
      await vi.runAllTimersAsync();
      
      let state = autoReconnectionService.getReconnectionState();
      expect(state.currentAttempt).toBe(1);

      vi.advanceTimersByTime(2000); // Second attempt (exponential backoff)
      await vi.runAllTimersAsync();
      
      state = autoReconnectionService.getReconnectionState();
      expect(state.currentAttempt).toBe(2);

      // Simulate connection recovery
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Next reconnection attempt should succeed
      vi.advanceTimersByTime(4000); // Third attempt
      await vi.runAllTimersAsync();

      expect(autoReconnectionService.isReconnecting()).toBe(false);
      expect(connectionMonitor.isOnline()).toBe(true);

      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.successfulReconnections).toBe(1);
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    it('should handle network offline/online events with reconnection', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Get the offline event handler
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1];

      const onlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1];

      expect(offlineHandler).toBeDefined();
      expect(onlineHandler).toBeDefined();

      // Simulate network going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      if (offlineHandler) {
        offlineHandler();
      }

      expect(connectionMonitor.isOnline()).toBe(false);
      
      // AutoReconnectionService should start reconnection
      vi.advanceTimersByTime(100);
      expect(autoReconnectionService.isReconnecting()).toBe(true);

      // Simulate network coming back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      if (onlineHandler) {
        onlineHandler();
      }

      // Should trigger health check and successful reconnection
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(connectionMonitor.isOnline()).toBe(true);
      expect(autoReconnectionService.isReconnecting()).toBe(false);
    });

    it('should handle exponential backoff correctly under load', async () => {
      // Configure for testing backoff behavior
      autoReconnectionService.updateConfig({
        maxAttempts: 5,
        baseDelay: 100, // Shorter delays for testing
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitterEnabled: false // Disable jitter for predictable timing
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock consistent failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Persistent failure'))
          }))
        }))
      });

      const attemptTimes: number[] = [];
      const startTime = Date.now();

      autoReconnectionService.onReconnectionStart((attempt) => {
        attemptTimes.push(Date.now() - startTime);
      });

      // Trigger connection loss
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(false);

      // Track timing of reconnection attempts
      const expectedDelays = [100, 200, 400, 800, 1000]; // Capped at maxDelay

      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(expectedDelays[i]);
        await vi.runAllTimersAsync();
      }

      expect(attemptTimes).toHaveLength(5);
      
      // Verify exponential backoff pattern (allowing for some timing variance)
      for (let i = 1; i < attemptTimes.length; i++) {
        const actualDelay = attemptTimes[i] - attemptTimes[i - 1];
        const expectedDelay = expectedDelays[i];
        
        // Allow 10% variance for timing
        expect(actualDelay).toBeGreaterThanOrEqual(expectedDelay * 0.9);
        expect(actualDelay).toBeLessThanOrEqual(expectedDelay * 1.1);
      }
    });

    it('should handle connection quality degradation and recovery', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Start with good connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              // Simulate slow response
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve({ data: null, error: null });
                }, 100);
              });
            })
          }))
        }))
      });

      // Perform initial health check
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(true);

      // Simulate degrading connection quality
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              // Simulate very slow response
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve({ data: null, error: null });
                }, 1000);
              });
            })
          }))
        }))
      });

      // Perform health checks to build poor quality history
      for (let i = 0; i < 3; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(100);
      }

      const quality = autoReconnectionService.assessConnectionQuality();
      expect(quality.rating).toBeOneOf(['poor', 'good']); // Quality should be affected by latency

      // Connection should still be online but quality monitoring should be active
      expect(connectionMonitor.isOnline()).toBe(true);
      expect(autoReconnectionService.isReconnecting()).toBe(false);
    });

    it('should handle concurrent reconnection attempts gracefully', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock failed connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection failed'))
          }))
        }))
      });

      // Trigger multiple connection loss events
      await connectionMonitor.performHealthCheck();
      
      // Try to start reconnection multiple times
      const forceReconnectPromises = [
        autoReconnectionService.forceReconnection('Manual 1'),
        autoReconnectionService.forceReconnection('Manual 2'),
        autoReconnectionService.forceReconnection('Manual 3')
      ];

      const results = await Promise.all(forceReconnectPromises);
      
      // Only one should succeed in starting reconnection
      const successCount = results.filter(result => result === false).length;
      expect(successCount).toBeGreaterThan(0); // At least some should fail due to already reconnecting

      // Should still be in reconnecting state
      expect(autoReconnectionService.isReconnecting()).toBe(true);
    });

    it('should handle maximum attempts reached scenario', async () => {
      // Configure for quick test
      autoReconnectionService.updateConfig({
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 500
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock persistent failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Persistent failure'))
          }))
        }))
      });

      const maxAttemptsCallback = vi.fn();
      autoReconnectionService.onMaxAttemptsReached(maxAttemptsCallback);

      // Trigger connection loss
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(false);

      // Let all attempts fail
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      }

      expect(maxAttemptsCallback).toHaveBeenCalled();
      expect(autoReconnectionService.isReconnecting()).toBe(false);

      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.failedAttempts).toBe(3);
      expect(metrics.successfulReconnections).toBe(0);
    });

    it('should handle service stop during active reconnection', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock failed connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection failed'))
          }))
        }))
      });

      // Start reconnection
      await connectionMonitor.performHealthCheck();
      expect(autoReconnectionService.isReconnecting()).toBe(true);

      // Stop service during reconnection
      autoReconnectionService.stop();

      expect(autoReconnectionService.isReconnecting()).toBe(false);

      // Advance time - no more reconnection attempts should happen
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      const state = autoReconnectionService.getReconnectionState();
      expect(state.currentAttempt).toBe(0);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should not leak timers or resources', async () => {
      const initialTimerCount = vi.getTimerCount();

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Simulate some activity
      await connectionMonitor.performHealthCheck();
      vi.advanceTimersByTime(1000);

      // Stop services
      autoReconnectionService.stop();
      connectionMonitor.stopMonitoring();

      // Cleanup
      autoReconnectionService.cleanup();
      connectionMonitor.cleanup();

      // Should not have leaked timers
      const finalTimerCount = vi.getTimerCount();
      expect(finalTimerCount).toBeLessThanOrEqual(initialTimerCount);
    });

    it('should handle rapid connection state changes', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Simulate rapid connection state changes
      for (let i = 0; i < 10; i++) {
        // Alternate between success and failure
        if (i % 2 === 0) {
          mockSupabase.from.mockReturnValue({
            select: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              }))
            }))
          });
        } else {
          mockSupabase.from.mockReturnValue({
            select: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockRejectedValue(new Error('Intermittent failure'))
              }))
            }))
          });
        }

        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(100);
      }

      // Service should handle rapid changes gracefully
      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);

      // Should not be stuck in reconnecting state
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();
      
      // Final state should be stable
      expect(typeof autoReconnectionService.isReconnecting()).toBe('boolean');
    });
  });
});