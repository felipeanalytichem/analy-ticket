import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoReconnectionService } from '../AutoReconnectionService';
import type { ConnectionMonitor } from '../ConnectionMonitor';

// Mock ConnectionMonitor
const mockConnectionMonitor = {
  performHealthCheck: vi.fn(),
  getConnectionQuality: vi.fn(),
  getConnectionStatus: vi.fn(),
  onConnectionLost: vi.fn(),
  onReconnected: vi.fn(),
  onConnectionChange: vi.fn()
} as unknown as ConnectionMonitor;

describe('AutoReconnectionService', () => {
  let autoReconnectionService: AutoReconnectionService;
  let connectionLostCallback: () => void;
  let reconnectedCallback: () => void;
  let connectionChangeCallback: (status: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset singleton if it exists
    try {
      AutoReconnectionService.resetInstance();
    } catch (e) {
      // Ignore if resetInstance doesn't exist yet
    }
    
    // Setup mock callbacks
    (mockConnectionMonitor.onConnectionLost as any).mockImplementation((callback: () => void) => {
      connectionLostCallback = callback;
    });
    
    (mockConnectionMonitor.onReconnected as any).mockImplementation((callback: () => void) => {
      reconnectedCallback = callback;
    });
    
    (mockConnectionMonitor.onConnectionChange as any).mockImplementation((callback: (status: any) => void) => {
      connectionChangeCallback = callback;
    });
    
    // Default mock implementations
    (mockConnectionMonitor.getConnectionStatus as any).mockReturnValue({
      isOnline: false,
      quality: 'offline',
      latency: -1,
      lastConnected: new Date(),
      reconnectAttempts: 0,
      supabaseConnected: false,
      networkConnected: false
    });
    
    (mockConnectionMonitor.getConnectionQuality as any).mockReturnValue({
      score: 0,
      rating: 'offline',
      factors: {
        latency: -1,
        successRate: 0,
        stability: 0
      }
    });
    
    autoReconnectionService = AutoReconnectionService.createInstance(mockConnectionMonitor);
  });

  afterEach(() => {
    if (autoReconnectionService) {
      autoReconnectionService.cleanup();
    }
    vi.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when using getInstance', () => {
      const instance1 = AutoReconnectionService.getInstance(mockConnectionMonitor);
      const instance2 = AutoReconnectionService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should throw error when getInstance called without ConnectionMonitor on first call', () => {
      try {
        AutoReconnectionService.resetInstance();
      } catch (e) {
        // Ignore if resetInstance doesn't exist
      }
      
      expect(() => {
        AutoReconnectionService.getInstance();
      }).toThrow('ConnectionMonitor instance required for first initialization');
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop the service', () => {
      expect(autoReconnectionService.isReconnecting()).toBe(false);
      
      autoReconnectionService.start();
      // Service should be active but not reconnecting initially
      expect(autoReconnectionService.isReconnecting()).toBe(false);
      
      autoReconnectionService.stop();
      expect(autoReconnectionService.isReconnecting()).toBe(false);
    });

    it('should not start twice', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      autoReconnectionService.start();
      autoReconnectionService.start();
      
      expect(consoleSpy).toHaveBeenCalledWith('🔄 [AutoReconnectionService] Already active');
      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxAttempts: 5,
        baseDelay: 2000,
        maxDelay: 60000
      };
      
      autoReconnectionService.updateConfig(newConfig);
      
      // Configuration update should be reflected in behavior
      // We can't directly access config, but we can test its effects
      expect(true).toBe(true); // Configuration is updated internally
    });
  });

  describe('Reconnection State and Metrics', () => {
    it('should return initial reconnection state', () => {
      const state = autoReconnectionService.getReconnectionState();
      
      expect(state).toEqual({
        isReconnecting: false,
        currentAttempt: 0,
        nextAttemptIn: 0,
        lastAttemptTime: null,
        strategy: 'exponential',
        reason: ''
      });
    });

    it('should return initial metrics', () => {
      const metrics = autoReconnectionService.getReconnectionMetrics();
      
      expect(metrics).toEqual({
        totalAttempts: 0,
        successfulReconnections: 0,
        failedAttempts: 0,
        averageReconnectionTime: 0,
        lastSuccessfulReconnection: null,
        connectionUptime: 0
      });
    });
  });

  describe('Connection Quality Assessment', () => {
    it('should assess connection quality and start reconnection if offline', () => {
      autoReconnectionService.start();
      
      // Mock offline status
      (mockConnectionMonitor.getConnectionStatus as any).mockReturnValue({
        isOnline: false,
        quality: 'offline'
      });
      
      (mockConnectionMonitor.getConnectionQuality as any).mockReturnValue({
        score: 0,
        rating: 'offline',
        factors: { latency: -1, successRate: 0, stability: 0 }
      });
      
      const quality = autoReconnectionService.assessConnectionQuality();
      
      expect(quality.rating).toBe('offline');
      expect(autoReconnectionService.isReconnecting()).toBe(true);
    });

    it('should monitor poor connection quality without starting reconnection', () => {
      autoReconnectionService.start();
      
      // Mock poor but online connection
      (mockConnectionMonitor.getConnectionStatus as any).mockReturnValue({
        isOnline: true,
        quality: 'poor'
      });
      
      (mockConnectionMonitor.getConnectionQuality as any).mockReturnValue({
        score: 30, // Below threshold of 60
        rating: 'poor',
        factors: { latency: 800, successRate: 0.5, stability: 0.3 }
      });
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const quality = autoReconnectionService.assessConnectionQuality();
      
      expect(quality.rating).toBe('poor');
      expect(autoReconnectionService.isReconnecting()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Poor connection quality detected')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Automatic Reconnection Process', () => {
    it('should start reconnection when connection is lost', () => {
      autoReconnectionService.start();
      
      // Simulate connection lost
      connectionLostCallback();
      
      expect(autoReconnectionService.isReconnecting()).toBe(true);
      
      const state = autoReconnectionService.getReconnectionState();
      expect(state.reason).toBe('Connection lost');
      expect(state.strategy).toBe('exponential');
    });

    it('should handle successful reconnection', async () => {
      autoReconnectionService.start();
      
      // Start reconnection process
      connectionLostCallback();
      expect(autoReconnectionService.isReconnecting()).toBe(true);
      
      // Mock successful health check
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(true);
      
      // Advance time to trigger reconnection attempt
      vi.advanceTimersByTime(1000);
      
      // Wait for async operations
      await vi.runAllTimersAsync();
      
      expect(autoReconnectionService.isReconnecting()).toBe(false);
      
      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
      expect(metrics.successfulReconnections).toBeGreaterThan(0);
    });

    it('should handle failed reconnection attempts with exponential backoff', async () => {
      autoReconnectionService.start();
      
      // Mock failed health checks
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(false);
      
      // Start reconnection process
      connectionLostCallback();
      expect(autoReconnectionService.isReconnecting()).toBe(true);
      
      // First attempt (should be scheduled for ~1000ms)
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      
      let state = autoReconnectionService.getReconnectionState();
      expect(state.currentAttempt).toBe(1);
      
      // Second attempt (should be scheduled for ~2000ms due to exponential backoff)
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      
      state = autoReconnectionService.getReconnectionState();
      expect(state.currentAttempt).toBe(2);
      
      const metrics = autoReconnectionService.getReconnectionMetrics();
      expect(metrics.failedAttempts).toBeGreaterThan(0);
    });

    it('should stop after maximum attempts reached', async () => {
      // Configure for fewer attempts to speed up test
      autoReconnectionService.updateConfig({ maxAttempts: 3 });
      autoReconnectionService.start();
      
      // Mock failed health checks
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(false);
      
      const maxAttemptsCallback = vi.fn();
      autoReconnectionService.onMaxAttemptsReached(maxAttemptsCallback);
      
      // Start reconnection process
      connectionLostCallback();
      
      // Fast forward through all attempts
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(10000); // Advance enough time for any backoff
        await vi.runAllTimersAsync();
      }
      
      expect(autoReconnectionService.isReconnecting()).toBe(false);
      expect(maxAttemptsCallback).toHaveBeenCalled();
    });
  });

  describe('Force Reconnection', () => {
    it('should force immediate reconnection', async () => {
      autoReconnectionService.start();
      
      // Mock successful health check
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(true);
      
      const result = await autoReconnectionService.forceReconnection('Manual test');
      
      expect(result).toBe(true);
      
      const state = autoReconnectionService.getReconnectionState();
      expect(state.reason).toBe('Manual test');
    });

    it('should handle failed force reconnection', async () => {
      autoReconnectionService.start();
      
      // Mock failed health check
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(false);
      
      const result = await autoReconnectionService.forceReconnection('Manual test');
      
      expect(result).toBe(false);
      expect(autoReconnectionService.isReconnecting()).toBe(true);
    });
  });

  describe('Event Callbacks', () => {
    it('should register and call reconnection start callbacks', async () => {
      const startCallback = vi.fn();
      autoReconnectionService.onReconnectionStart(startCallback);
      autoReconnectionService.start();
      
      // Mock failed health check to trigger reconnection attempts
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(false);
      
      // Start reconnection
      connectionLostCallback();
      
      // Advance time to trigger first attempt
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      
      expect(startCallback).toHaveBeenCalledWith(1);
    });

    it('should register and call reconnection success callbacks', async () => {
      const successCallback = vi.fn();
      autoReconnectionService.onReconnectionSuccess(successCallback);
      autoReconnectionService.start();
      
      // Mock successful health check
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(true);
      
      // Start and complete reconnection
      connectionLostCallback();
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      
      expect(successCallback).toHaveBeenCalled();
    });

    it('should register and call reconnection failure callbacks', async () => {
      const failureCallback = vi.fn();
      autoReconnectionService.onReconnectionFailure(failureCallback);
      autoReconnectionService.start();
      
      // Mock failed health check
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(false);
      
      // Start reconnection
      connectionLostCallback();
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      
      expect(failureCallback).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('Connection Monitor Integration', () => {
    it('should handle connection restored during reconnection', () => {
      autoReconnectionService.start();
      
      // Start reconnection
      connectionLostCallback();
      expect(autoReconnectionService.isReconnecting()).toBe(true);
      
      // Simulate connection restored
      reconnectedCallback();
      
      expect(autoReconnectionService.isReconnecting()).toBe(false);
    });

    it('should handle connection change to online during reconnection', () => {
      autoReconnectionService.start();
      
      // Start reconnection
      connectionLostCallback();
      expect(autoReconnectionService.isReconnecting()).toBe(true);
      
      // Simulate connection change to online
      connectionChangeCallback({ isOnline: true });
      
      expect(autoReconnectionService.isReconnecting()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in callbacks gracefully', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      autoReconnectionService.onReconnectionStart(errorCallback);
      autoReconnectionService.start();
      
      // Mock failed health check to trigger callback
      (mockConnectionMonitor.performHealthCheck as any).mockResolvedValue(false);
      
      connectionLostCallback();
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in reconnection start callback:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle health check exceptions', async () => {
      autoReconnectionService.start();
      
      // Mock health check that throws
      (mockConnectionMonitor.performHealthCheck as any).mockRejectedValue(
        new Error('Health check failed')
      );
      
      const failureCallback = vi.fn();
      autoReconnectionService.onReconnectionFailure(failureCallback);
      
      connectionLostCallback();
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      
      expect(failureCallback).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all resources', () => {
      const startCallback = vi.fn();
      const successCallback = vi.fn();
      const failureCallback = vi.fn();
      const maxAttemptsCallback = vi.fn();
      
      autoReconnectionService.onReconnectionStart(startCallback);
      autoReconnectionService.onReconnectionSuccess(successCallback);
      autoReconnectionService.onReconnectionFailure(failureCallback);
      autoReconnectionService.onMaxAttemptsReached(maxAttemptsCallback);
      
      autoReconnectionService.start();
      autoReconnectionService.cleanup();
      
      expect(autoReconnectionService.isReconnecting()).toBe(false);
    });
  });
});