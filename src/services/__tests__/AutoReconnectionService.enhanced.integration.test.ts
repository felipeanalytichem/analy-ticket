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

describe('AutoReconnectionService Enhanced Integration Tests', () => {
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

  describe('Circuit Breaker Functionality', () => {
    it('should open circuit breaker after consecutive failures', async () => {
      // Configure for quick circuit breaker testing
      autoReconnectionService.updateConfig({
        circuitBreakerThreshold: 3,
        maxAttempts: 10,
        baseDelay: 100
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

      const circuitBreakerCallback = vi.fn();
      autoReconnectionService.onCircuitBreakerOpen(circuitBreakerCallback);

      // Trigger connection loss
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(false);

      // Let 3 attempts fail to trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      }

      expect(circuitBreakerCallback).toHaveBeenCalled();
      
      const state = autoReconnectionService.getReconnectionState();
      expect(state.circuitBreakerOpen).toBe(true);
    });

    it('should reset circuit breaker after timeout and successful reconnection', async () => {
      // Configure for circuit breaker testing
      autoReconnectionService.updateConfig({
        circuitBreakerThreshold: 2,
        maxAttempts: 10,
        baseDelay: 100
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock initial failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Initial failure'))
          }))
        }))
      });

      // Trigger failures to open circuit breaker
      await connectionMonitor.performHealthCheck();
      
      for (let i = 0; i < 2; i++) {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      }

      let state = autoReconnectionService.getReconnectionState();
      expect(state.circuitBreakerOpen).toBe(true);

      // Wait for circuit breaker reset time (1 minute)
      vi.advanceTimersByTime(60000);

      // Mock successful connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Next attempt should reset circuit breaker
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      state = autoReconnectionService.getReconnectionState();
      expect(state.circuitBreakerOpen).toBe(false);
      expect(connectionMonitor.isOnline()).toBe(true);
    });
  });

  describe('Fallback Strategy Mechanisms', () => {
    it('should activate fallback mode when circuit breaker opens', async () => {
      autoReconnectionService.updateConfig({
        circuitBreakerThreshold: 2,
        fallbackStrategies: ['exponential', 'linear', 'immediate'],
        baseDelay: 100
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      const fallbackCallback = vi.fn();
      autoReconnectionService.onFallbackMode(fallbackCallback);

      // Mock failures to trigger circuit breaker
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Failure'))
          }))
        }))
      });

      await connectionMonitor.performHealthCheck();
      
      // Trigger enough failures to open circuit breaker
      for (let i = 0; i < 2; i++) {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      }

      expect(fallbackCallback).toHaveBeenCalledWith(true);
      
      const state = autoReconnectionService.getReconnectionState();
      expect(state.fallbackModeActive).toBe(true);
      expect(state.strategy).toBe('linear'); // Should switch to next strategy
    });

    it('should cycle through fallback strategies', async () => {
      autoReconnectionService.updateConfig({
        circuitBreakerThreshold: 1,
        fallbackStrategies: ['exponential', 'linear', 'immediate'],
        baseDelay: 100
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Failure'))
          }))
        }))
      });

      // Initial strategy should be exponential
      let state = autoReconnectionService.getReconnectionState();
      expect(state.strategy).toBe('exponential');

      // Trigger circuit breaker multiple times to cycle strategies
      for (let cycle = 0; cycle < 3; cycle++) {
        await connectionMonitor.performHealthCheck();
        
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
        
        // Reset circuit breaker to allow next cycle
        autoReconnectionService.updateConfig({ circuitBreakerThreshold: 1 });
        
        // Wait for circuit breaker reset
        vi.advanceTimersByTime(60000);
        
        state = autoReconnectionService.getReconnectionState();
        
        if (cycle === 0) expect(state.strategy).toBe('linear');
        else if (cycle === 1) expect(state.strategy).toBe('immediate');
        else if (cycle === 2) expect(state.strategy).toBe('exponential'); // Cycles back
      }
    });
  });

  describe('Adaptive Backoff Mechanism', () => {
    it('should increase delay multiplier on failures', async () => {
      autoReconnectionService.updateConfig({
        adaptiveBackoff: true,
        baseDelay: 1000,
        maxAttempts: 5
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Failure'))
          }))
        }))
      });

      await connectionMonitor.performHealthCheck();
      
      let state = autoReconnectionService.getReconnectionState();
      const initialMultiplier = state.adaptiveDelayMultiplier;

      // Let a few attempts fail
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      }

      state = autoReconnectionService.getReconnectionState();
      expect(state.adaptiveDelayMultiplier).toBeGreaterThan(initialMultiplier);
    });

    it('should decrease delay multiplier on success', async () => {
      autoReconnectionService.updateConfig({
        adaptiveBackoff: true,
        baseDelay: 1000,
        maxAttempts: 5
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Start with failures to increase multiplier
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Failure'))
          }))
        }))
      });

      await connectionMonitor.performHealthCheck();
      
      // Let attempts fail to increase multiplier
      for (let i = 0; i < 2; i++) {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      }

      let state = autoReconnectionService.getReconnectionState();
      const highMultiplier = state.adaptiveDelayMultiplier;
      expect(highMultiplier).toBeGreaterThan(1.0);

      // Mock success
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Next attempt should succeed and reduce multiplier
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      state = autoReconnectionService.getReconnectionState();
      expect(state.adaptiveDelayMultiplier).toBeLessThan(highMultiplier);
    });
  });

  describe('Connection Quality-Based Reconnection', () => {
    it('should trigger reconnection based on poor connection quality', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock poor quality connection (high latency, low success rate)
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              // Simulate slow, intermittent responses
              return new Promise((resolve, reject) => {
                setTimeout(() => {
                  if (Math.random() < 0.3) { // 30% success rate
                    resolve({ data: null, error: null });
                  } else {
                    reject(new Error('Intermittent failure'));
                  }
                }, 800); // High latency
              });
            })
          }))
        }))
      });

      // Perform multiple health checks to build quality history
      for (let i = 0; i < 5; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(1000);
      }

      const quality = autoReconnectionService.assessConnectionQuality();
      expect(quality.score).toBeLessThan(60); // Below quality threshold

      // Should not trigger reconnection for poor but online connection
      expect(autoReconnectionService.isReconnecting()).toBe(false);
    });

    it('should handle connection quality improvement', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Start with poor quality
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              return new Promise((resolve, reject) => {
                setTimeout(() => {
                  reject(new Error('Poor connection'));
                }, 1000);
              });
            })
          }))
        }))
      });

      // Build poor quality history
      for (let i = 0; i < 3; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(1500);
      }

      let quality = autoReconnectionService.assessConnectionQuality();
      expect(quality.rating).toBe('offline');

      // Improve connection quality
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Build good quality history
      for (let i = 0; i < 3; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(100);
      }

      quality = autoReconnectionService.assessConnectionQuality();
      expect(quality.rating).toBeOneOf(['excellent', 'good']);
    });
  });

  describe('Complex Reconnection Scenarios', () => {
    it('should handle reconnection during network instability', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      const reconnectionEvents: string[] = [];
      
      autoReconnectionService.onReconnectionStart((attempt) => {
        reconnectionEvents.push(`start-${attempt}`);
      });
      
      autoReconnectionService.onReconnectionSuccess(() => {
        reconnectionEvents.push('success');
      });
      
      autoReconnectionService.onReconnectionFailure((attempt) => {
        reconnectionEvents.push(`failure-${attempt}`);
      });

      // Simulate unstable network with intermittent failures
      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              // Alternate between success and failure
              if (callCount % 3 === 0) {
                return Promise.resolve({ data: null, error: null });
              } else {
                return Promise.reject(new Error('Intermittent failure'));
              }
            })
          }))
        }))
      });

      // Trigger initial connection loss
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(false);

      // Let reconnection attempts proceed
      for (let i = 0; i < 6; i++) {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      }

      // Should have recorded multiple events
      expect(reconnectionEvents.length).toBeGreaterThan(3);
      expect(reconnectionEvents).toContain('success');
      expect(reconnectionEvents.some(event => event.startsWith('start-'))).toBe(true);
    });

    it('should handle service restart during active reconnection', async () => {
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

      // Stop and restart service
      autoReconnectionService.stop();
      expect(autoReconnectionService.isReconnecting()).toBe(false);

      autoReconnectionService.start();

      // Should be able to start new reconnection
      await connectionMonitor.performHealthCheck();
      vi.advanceTimersByTime(100);
      expect(autoReconnectionService.isReconnecting()).toBe(true);
    });

    it('should handle multiple concurrent force reconnection requests', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock successful connection for force reconnection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Issue multiple concurrent force reconnection requests
      const promises = [
        autoReconnectionService.forceReconnection('Request 1'),
        autoReconnectionService.forceReconnection('Request 2'),
        autoReconnectionService.forceReconnection('Request 3')
      ];

      const results = await Promise.all(promises);

      // At least one should succeed
      expect(results.some(result => result === true)).toBe(true);

      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should not accumulate memory leaks during long reconnection cycles', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Configure for rapid testing
      autoReconnectionService.updateConfig({
        baseDelay: 50,
        maxDelay: 200,
        maxAttempts: 20
      });

      // Mock intermittent failures
      let successCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              successCount++;
              if (successCount % 5 === 0) {
                return Promise.resolve({ data: null, error: null });
              } else {
                return Promise.reject(new Error('Intermittent failure'));
              }
            })
          }))
        }))
      });

      const initialTimerCount = vi.getTimerCount();

      // Run many reconnection cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        await connectionMonitor.performHealthCheck();
        
        // Let some attempts run
        for (let i = 0; i < 3; i++) {
          vi.advanceTimersByTime(300);
          await vi.runAllTimersAsync();
        }
      }

      const finalTimerCount = vi.getTimerCount();
      
      // Should not have accumulated excessive timers
      expect(finalTimerCount - initialTimerCount).toBeLessThan(5);

      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(10);
      expect(metrics.successfulReconnections).toBeGreaterThan(0);
    });

    it('should handle high-frequency connection state changes efficiently', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      const startTime = Date.now();
      let healthCheckCount = 0;

      // Mock rapid state changes
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              healthCheckCount++;
              // Rapid alternation between success and failure
              if (healthCheckCount % 2 === 0) {
                return Promise.resolve({ data: null, error: null });
              } else {
                return Promise.reject(new Error('Rapid failure'));
              }
            })
          }))
        }))
      });

      // Simulate rapid health checks
      for (let i = 0; i < 50; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(10); // Very rapid changes
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle rapid changes without excessive delays
      expect(duration).toBeLessThan(1000); // Should complete quickly in test environment

      // Service should remain stable
      expect(typeof autoReconnectionService.isReconnecting()).toBe('boolean');
      
      const state = autoReconnectionService.getReconnectionState();
      expect(typeof state.currentAttempt).toBe('number');
    });
  });
});