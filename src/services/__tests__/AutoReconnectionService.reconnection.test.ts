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

describe('AutoReconnectionService Reconnection Logic Tests', () => {
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

  describe('Exponential Backoff Strategy', () => {
    it('should implement exponential backoff with correct timing', async () => {
      // Configure for predictable exponential backoff
      autoReconnectionService.updateConfig({
        maxAttempts: 5,
        baseDelay: 1000, // 1 second base
        maxDelay: 16000, // 16 seconds max
        backoffMultiplier: 2,
        jitterEnabled: false // Disable jitter for predictable testing
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock consistent failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection failed'))
          }))
        }))
      });

      const attemptTimes: number[] = [];
      const startTime = Date.now();

      autoReconnectionService.onReconnectionStart((attempt) => {
        attemptTimes.push(Date.now() - startTime);
        console.log(`Attempt ${attempt} at ${Date.now() - startTime}ms`);
      });

      // Trigger connection loss
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(false);

      // Expected delays: 1000ms, 2000ms, 4000ms, 8000ms, 16000ms (capped)
      const expectedDelays = [1000, 2000, 4000, 8000, 16000];

      // Let all attempts run
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(expectedDelays[i]);
        await vi.runAllTimersAsync();
      }

      expect(attemptTimes).toHaveLength(5);

      // Verify exponential backoff pattern
      for (let i = 1; i < attemptTimes.length; i++) {
        const actualDelay = attemptTimes[i] - attemptTimes[i - 1];
        const expectedDelay = expectedDelays[i];
        
        // Allow 5% variance for timing precision
        expect(actualDelay).toBeGreaterThanOrEqual(expectedDelay * 0.95);
        expect(actualDelay).toBeLessThanOrEqual(expectedDelay * 1.05);
      }
    });

    it('should respect maximum delay cap', async () => {
      autoReconnectionService.updateConfig({
        maxAttempts: 8,
        baseDelay: 1000,
        maxDelay: 5000, // Cap at 5 seconds
        backoffMultiplier: 2,
        jitterEnabled: false
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection failed'))
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

      // Run attempts - delays should be: 1000, 2000, 4000, 5000, 5000, 5000, 5000, 5000
      const expectedDelays = [1000, 2000, 4000, 5000, 5000, 5000, 5000, 5000];

      for (let i = 0; i < 8; i++) {
        vi.advanceTimersByTime(expectedDelays[i]);
        await vi.runAllTimersAsync();
      }

      // Verify that delays are capped at maxDelay
      for (let i = 4; i < attemptTimes.length; i++) {
        const actualDelay = attemptTimes[i] - attemptTimes[i - 1];
        expect(actualDelay).toBeLessThanOrEqual(5100); // 5000ms + small variance
      }
    });

    it('should add jitter when enabled', async () => {
      autoReconnectionService.updateConfig({
        maxAttempts: 3,
        baseDelay: 1000,
        backoffMultiplier: 2,
        jitterEnabled: true // Enable jitter
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection failed'))
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

      // Run multiple test cycles to verify jitter variance
      const delayVariances: number[] = [];

      for (let cycle = 0; cycle < 3; cycle++) {
        // Reset for new cycle
        autoReconnectionService.stop();
        autoReconnectionService.start();
        
        const cycleStartTime = Date.now();
        const cycleAttemptTimes: number[] = [];

        autoReconnectionService.onReconnectionStart((attempt) => {
          cycleAttemptTimes.push(Date.now() - cycleStartTime);
        });

        await connectionMonitor.performHealthCheck();

        // First attempt delay (should have jitter)
        vi.advanceTimersByTime(1200); // Allow for jitter
        await vi.runAllTimersAsync();

        if (cycleAttemptTimes.length > 0) {
          delayVariances.push(cycleAttemptTimes[0]);
        }
      }

      // Verify that jitter creates variance in delays
      const uniqueDelays = new Set(delayVariances);
      expect(uniqueDelays.size).toBeGreaterThan(1); // Should have different delays due to jitter
    });
  });

  describe('Connection Quality Assessment', () => {
    it('should assess connection quality based on latency and success rate', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock varying connection quality
      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              const latency = callCount <= 3 ? 100 : 1000; // Start good, then degrade
              
              return new Promise((resolve, reject) => {
                setTimeout(() => {
                  if (callCount <= 5) {
                    resolve({ data: null, error: null });
                  } else {
                    reject(new Error('Poor connection'));
                  }
                }, latency);
              });
            })
          }))
        }))
      });

      // Perform multiple health checks to build quality history
      for (let i = 0; i < 8; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(100);
      }

      const quality = autoReconnectionService.assessConnectionQuality();
      
      // Quality should reflect the degrading connection
      expect(quality.score).toBeLessThan(100);
      expect(quality.factors.latency).toBeGreaterThan(0);
      expect(quality.factors.successRate).toBeLessThan(1);
      expect(['excellent', 'good', 'poor', 'offline']).toContain(quality.rating);
    });

    it('should trigger quality-based reconnection for very poor connections', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock very poor connection quality
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              return new Promise((resolve, reject) => {
                setTimeout(() => {
                  // Very low success rate and high latency
                  if (Math.random() < 0.1) { // 10% success rate
                    resolve({ data: null, error: null });
                  } else {
                    reject(new Error('Very poor connection'));
                  }
                }, 2500); // Very high latency
              });
            })
          }))
        }))
      });

      // Build poor quality history
      for (let i = 0; i < 6; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(3000);
      }

      const quality = autoReconnectionService.assessConnectionQuality();
      
      // Should detect very poor quality
      expect(quality.score).toBeLessThan(30);
      expect(quality.rating).toBeOneOf(['poor', 'offline']);
      
      // Should not trigger reconnection for poor but online connection
      expect(autoReconnectionService.isReconnecting()).toBe(false);
    });

    it('should adapt configuration based on connection quality trends', async () => {
      autoReconnectionService.updateConfig({
        adaptiveBackoff: true,
        baseDelay: 2000,
        maxAttempts: 5
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock consistently poor quality
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              return new Promise((resolve, reject) => {
                setTimeout(() => {
                  if (Math.random() < 0.3) { // 30% success rate
                    resolve({ data: null, error: null });
                  } else {
                    reject(new Error('Poor connection'));
                  }
                }, 800); // High latency
              });
            })
          }))
        }))
      });

      // Build poor quality history
      for (let i = 0; i < 6; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(1000);
      }

      // Trigger quality assessment
      autoReconnectionService.assessConnectionQuality();
      
      // Wait for quality monitoring interval
      vi.advanceTimersByTime(30000);
      await vi.runAllTimersAsync();

      // Configuration should be adapted for poor quality
      const state = autoReconnectionService.getReconnectionState();
      expect(state.adaptiveDelayMultiplier).toBeGreaterThan(1.0);
    });
  });

  describe('Reconnection Attempt Limiting', () => {
    it('should stop after maximum attempts reached', async () => {
      autoReconnectionService.updateConfig({
        maxAttempts: 3,
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

      const maxAttemptsCallback = vi.fn();
      autoReconnectionService.onMaxAttemptsReached(maxAttemptsCallback);

      let attemptCount = 0;
      autoReconnectionService.onReconnectionStart((attempt) => {
        attemptCount = attempt;
      });

      // Trigger connection loss
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(false);

      // Let all attempts fail
      for (let i = 0; i < 5; i++) { // Try more than maxAttempts
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      }

      expect(maxAttemptsCallback).toHaveBeenCalled();
      expect(attemptCount).toBe(3); // Should not exceed maxAttempts
      expect(autoReconnectionService.isReconnecting()).toBe(false);

      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.failedAttempts).toBe(3);
      expect(metrics.successfulReconnections).toBe(0);
    });

    it('should schedule fallback attempt after max attempts reached', async () => {
      autoReconnectionService.updateConfig({
        maxAttempts: 2,
        baseDelay: 100,
        maxDelay: 500
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

      const maxAttemptsCallback = vi.fn();
      autoReconnectionService.onMaxAttemptsReached(maxAttemptsCallback);

      // Trigger connection loss and let max attempts fail
      await connectionMonitor.performHealthCheck();
      
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      }

      expect(maxAttemptsCallback).toHaveBeenCalled();
      expect(autoReconnectionService.isReconnecting()).toBe(false);

      // Mock successful connection for fallback attempt
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Wait for fallback attempt (should be 2 * maxDelay)
      vi.advanceTimersByTime(1000); // 2 * 500ms maxDelay
      await vi.runAllTimersAsync();

      // Fallback attempt should have been triggered
      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(2);
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should switch to linear strategy when exponential fails', async () => {
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

      // Initial strategy should be exponential
      let state = autoReconnectionService.getReconnectionState();
      expect(state.strategy).toBe('exponential');

      await connectionMonitor.performHealthCheck();
      
      // Trigger enough failures to open circuit breaker
      for (let i = 0; i < 2; i++) {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      }

      expect(fallbackCallback).toHaveBeenCalledWith(true);
      
      state = autoReconnectionService.getReconnectionState();
      expect(state.fallbackModeActive).toBe(true);
      expect(state.strategy).toBe('linear'); // Should switch to next strategy
    });

    it('should use immediate strategy for force reconnection', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock successful connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Force reconnection should use immediate strategy
      const result = await autoReconnectionService.forceReconnection('Manual test');
      
      const state = autoReconnectionService.getReconnectionState();
      expect(state.strategy).toBe('immediate');
      expect(result).toBe(true);
    });

    it('should deactivate fallback mode on successful reconnection', async () => {
      autoReconnectionService.updateConfig({
        circuitBreakerThreshold: 1,
        fallbackStrategies: ['exponential', 'linear']
      });

      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      const fallbackCallback = vi.fn();
      autoReconnectionService.onFallbackMode(fallbackCallback);

      // Trigger circuit breaker
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Failure'))
          }))
        }))
      });

      await connectionMonitor.performHealthCheck();
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(fallbackCallback).toHaveBeenCalledWith(true);

      // Mock successful connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Wait for circuit breaker reset and successful reconnection
      vi.advanceTimersByTime(60000); // Circuit breaker reset time
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(fallbackCallback).toHaveBeenCalledWith(false);
      
      const state = autoReconnectionService.getReconnectionState();
      expect(state.fallbackModeActive).toBe(false);
      expect(state.strategy).toBe('exponential'); // Reset to default
    });
  });

  describe('Integration with ConnectionMonitor', () => {
    it('should respond to ConnectionMonitor connection lost events', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      const reconnectionStartCallback = vi.fn();
      autoReconnectionService.onReconnectionStart(reconnectionStartCallback);

      // Mock connection failure
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection lost'))
          }))
        }))
      });

      // Trigger connection loss through ConnectionMonitor
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(false);

      // AutoReconnectionService should start reconnection
      vi.advanceTimersByTime(100);
      expect(autoReconnectionService.isReconnecting()).toBe(true);
      expect(reconnectionStartCallback).toHaveBeenCalled();
    });

    it('should respond to ConnectionMonitor reconnection events', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      const reconnectionSuccessCallback = vi.fn();
      autoReconnectionService.onReconnectionSuccess(reconnectionSuccessCallback);

      // Start with failed connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection failed'))
          }))
        }))
      });

      await connectionMonitor.performHealthCheck();
      expect(autoReconnectionService.isReconnecting()).toBe(true);

      // Mock connection restoration
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Trigger reconnection through ConnectionMonitor
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.isOnline()).toBe(true);

      // AutoReconnectionService should detect successful reconnection
      expect(autoReconnectionService.isReconnecting()).toBe(false);
      expect(reconnectionSuccessCallback).toHaveBeenCalled();
    });

    it('should coordinate with ConnectionMonitor health checks', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.start();

      // Mock intermittent connection
      let healthCheckCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockImplementation(() => {
              healthCheckCount++;
              if (healthCheckCount % 3 === 0) {
                return Promise.resolve({ data: null, error: null });
              } else {
                return Promise.reject(new Error('Intermittent failure'));
              }
            })
          }))
        }))
      });

      // Perform multiple health checks
      for (let i = 0; i < 6; i++) {
        await connectionMonitor.performHealthCheck();
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      }

      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
      
      // Should have some successful reconnections due to intermittent success
      expect(metrics.successfulReconnections).toBeGreaterThan(0);
    });
  });
});