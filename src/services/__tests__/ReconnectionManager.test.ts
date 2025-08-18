import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase with factory function
vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            gte: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
    }
  };
});

// Mock NotificationService
vi.mock('@/lib/notificationService', () => ({
  NotificationService: {
    getNotifications: vi.fn()
  }
}));

// Import after mocking
import { ReconnectionManager, ConnectionHealth } from '../ReconnectionManager';
import { supabase } from '@/lib/supabase';

// Mock DOM APIs
Object.defineProperty(document, 'visibilityState', {
  writable: true,
  value: 'visible'
});

Object.defineProperty(document, 'addEventListener', {
  writable: true,
  value: vi.fn()
});

Object.defineProperty(document, 'removeEventListener', {
  writable: true,
  value: vi.fn()
});

Object.defineProperty(window, 'addEventListener', {
  writable: true,
  value: vi.fn()
});

Object.defineProperty(window, 'removeEventListener', {
  writable: true,
  value: vi.fn()
});

Object.defineProperty(window, 'dispatchEvent', {
  writable: true,
  value: vi.fn()
});

const mockSupabase = supabase as any;

describe('ReconnectionManager', () => {
  let reconnectionManager: ReconnectionManager;
  const mockReconnectCallback = vi.fn();
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    reconnectionManager = ReconnectionManager.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
    reconnectionManager.cleanup();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ReconnectionManager.getInstance();
      const instance2 = ReconnectionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Health Monitoring', () => {
    it('should start health monitoring successfully', () => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);

      const health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health).toBeTruthy();
      expect(health?.isHealthy).toBe(true);
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.lastHeartbeat).toBeInstanceOf(Date);
    });

    it('should stop health monitoring and clean up state', () => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);
      expect(reconnectionManager.getConnectionHealth(testUserId)).toBeTruthy();

      reconnectionManager.stopHealthMonitoring(testUserId);
      expect(reconnectionManager.getConnectionHealth(testUserId)).toBeNull();
    });

    it('should return null for non-existent user health', () => {
      const health = reconnectionManager.getConnectionHealth('non-existent');
      expect(health).toBeNull();
    });
  });

  describe('Connection Failure Handling', () => {
    beforeEach(() => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);
    });

    it('should handle connection failure and update health status', () => {
      const errorMessage = 'Connection lost';
      
      reconnectionManager.handleConnectionFailure(
        testUserId,
        errorMessage,
        mockReconnectCallback
      );

      const health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health?.isHealthy).toBe(false);
      expect(health?.consecutiveFailures).toBe(1);
      expect(health?.lastError).toBe(errorMessage);
    });

    it('should schedule reconnection with exponential backoff', () => {
      reconnectionManager.handleConnectionFailure(
        testUserId,
        'Connection failed',
        mockReconnectCallback
      );

      // First attempt should be scheduled with base delay (1000ms)
      expect(mockReconnectCallback).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1000);
      expect(mockReconnectCallback).toHaveBeenCalledTimes(1);

      // Second failure should have longer delay
      mockReconnectCallback.mockClear();
      reconnectionManager.handleConnectionFailure(
        testUserId,
        'Connection failed again',
        mockReconnectCallback
      );

      vi.advanceTimersByTime(1000);
      expect(mockReconnectCallback).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1000); // Total 2000ms for second attempt
      expect(mockReconnectCallback).toHaveBeenCalledTimes(1);
    });

    it('should stop reconnection attempts after max retries', () => {
      const options = { maxRetries: 2 };

      // Trigger multiple failures
      for (let i = 0; i < 3; i++) {
        reconnectionManager.handleConnectionFailure(
          testUserId,
          `Connection failed ${i + 1}`,
          mockReconnectCallback,
          options
        );
        
        // Advance time to trigger reconnection
        vi.advanceTimersByTime(10000);
      }

      const health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health?.lastError).toBe('Max reconnection attempts reached');
    });
  });

  describe('Connection Success Handling', () => {
    beforeEach(() => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);
    });

    it('should handle successful connection and reset health status', () => {
      // First simulate a failure
      reconnectionManager.handleConnectionFailure(
        testUserId,
        'Connection failed',
        mockReconnectCallback
      );

      let health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health?.isHealthy).toBe(false);
      expect(health?.consecutiveFailures).toBe(1);

      // Then simulate success
      reconnectionManager.handleConnectionSuccess(testUserId);

      health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health?.isHealthy).toBe(true);
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.lastError).toBeUndefined();
    });
  });

  describe('Force Reconnection', () => {
    it('should force immediate reconnection', () => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);
      
      reconnectionManager.forceReconnection(testUserId, mockReconnectCallback);
      
      expect(mockReconnectCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('should clean up all monitoring and event listeners', () => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);
      reconnectionManager.startHealthMonitoring('user2', mockReconnectCallback);

      expect(reconnectionManager.getConnectionHealth(testUserId)).toBeTruthy();
      expect(reconnectionManager.getConnectionHealth('user2')).toBeTruthy();

      reconnectionManager.cleanup();

      expect(reconnectionManager.getConnectionHealth(testUserId)).toBeNull();
      expect(reconnectionManager.getConnectionHealth('user2')).toBeNull();
    });
  });

  describe('Options Handling', () => {
    it('should use default options when none provided', () => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);
      
      const health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health).toBeTruthy();
    });

    it('should merge custom options with defaults', () => {
      const customOptions = {
        maxRetries: 10,
        baseDelay: 500,
        heartbeatInterval: 10000
      };

      reconnectionManager.startHealthMonitoring(
        testUserId,
        mockReconnectCallback,
        customOptions
      );

      const health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle multiple connection failures gracefully', () => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);

      // Simulate multiple failures
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 1', mockReconnectCallback);
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 2', mockReconnectCallback);
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 3', mockReconnectCallback);

      const health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health?.consecutiveFailures).toBe(3);
      expect(health?.lastError).toBe('Error 3');
    });

    it('should reset failure count on successful connection', () => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);

      // Simulate failures
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 1', mockReconnectCallback);
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 2', mockReconnectCallback);

      let health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health?.consecutiveFailures).toBe(2);

      // Simulate success
      reconnectionManager.handleConnectionSuccess(testUserId);

      health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.isHealthy).toBe(true);
    });
  });

  describe('Reconnection Scheduling', () => {
    it('should clear existing reconnection timeout when scheduling new one', () => {
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback);

      // Schedule first reconnection
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 1', mockReconnectCallback);
      
      // Schedule second reconnection before first completes
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 2', mockReconnectCallback);

      // Only the second reconnection should be scheduled
      vi.advanceTimersByTime(1000);
      expect(mockReconnectCallback).toHaveBeenCalledTimes(1);
    });

    it('should not schedule reconnection if max retries exceeded', () => {
      const options = { maxRetries: 1 };
      reconnectionManager.startHealthMonitoring(testUserId, mockReconnectCallback, options);

      // First failure - should schedule reconnection
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 1', mockReconnectCallback, options);
      vi.advanceTimersByTime(1000);
      expect(mockReconnectCallback).toHaveBeenCalledTimes(1);

      // Second failure - should not schedule (max retries reached)
      mockReconnectCallback.mockClear();
      reconnectionManager.handleConnectionFailure(testUserId, 'Error 2', mockReconnectCallback, options);
      vi.advanceTimersByTime(10000);
      expect(mockReconnectCallback).not.toHaveBeenCalled();

      const health = reconnectionManager.getConnectionHealth(testUserId);
      expect(health?.lastError).toBe('Max reconnection attempts reached');
    });
  });
});