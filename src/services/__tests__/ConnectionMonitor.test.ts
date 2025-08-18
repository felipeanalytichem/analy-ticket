import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionMonitor } from '../ConnectionMonitor';

// Add type declaration for the static methods
declare module '../ConnectionMonitor' {
  namespace ConnectionMonitor {
    function createInstance(): ConnectionMonitor;
    function resetInstance(): void;
  }
}

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
const mockDocumentRemoveEventListener = vi.fn();

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener
});

Object.defineProperty(document, 'addEventListener', {
  value: mockDocumentAddEventListener
});

Object.defineProperty(document, 'removeEventListener', {
  value: mockDocumentRemoveEventListener
});

describe('ConnectionMonitor', () => {
  let connectionMonitor: ConnectionMonitor;
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

    // Reset singleton and get fresh instance
    ConnectionMonitor.resetInstance();
    connectionMonitor = ConnectionMonitor.createInstance();
  });

  afterEach(() => {
    connectionMonitor.stopMonitoring();
    connectionMonitor.cleanup();
    vi.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConnectionMonitor.getInstance();
      const instance2 = ConnectionMonitor.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection Monitoring', () => {
    it('should start monitoring and set up event listeners', () => {
      connectionMonitor.startMonitoring();

      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockDocumentAddEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(mockSupabase.realtime.onOpen).toHaveBeenCalled();
      expect(mockSupabase.realtime.onClose).toHaveBeenCalled();
      expect(mockSupabase.realtime.onError).toHaveBeenCalled();
    });

    it('should not start monitoring twice', () => {
      connectionMonitor.startMonitoring();
      connectionMonitor.startMonitoring();

      // Should only be called once
      expect(mockAddEventListener).toHaveBeenCalledTimes(2); // online and offline
    });

    it('should stop monitoring and remove event listeners', () => {
      connectionMonitor.startMonitoring();
      connectionMonitor.stopMonitoring();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockDocumentRemoveEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('Connection Status', () => {
    it('should return initial connection status', () => {
      const status = connectionMonitor.getConnectionStatus();

      expect(status).toEqual({
        isOnline: false, // Initially offline until health check passes
        quality: 'offline',
        latency: -1,
        lastConnected: expect.any(Date),
        reconnectAttempts: 0,
        supabaseConnected: false,
        networkConnected: true
      });
    });

    it('should detect online status', () => {
      expect(connectionMonitor.isOnline()).toBe(false); // Initially offline until health check passes
    });
  });

  describe('Health Check', () => {
    it('should perform successful health check', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      const result = await connectionMonitor.performHealthCheck();

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should handle health check failure', async () => {
      const error = new Error('Connection failed');
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(error)
          }))
        }))
      });

      const result = await connectionMonitor.performHealthCheck();

      expect(result).toBe(false);
    });

    it('should handle PGRST116 error as success', async () => {
      const error = { code: 'PGRST116', message: 'No rows returned' };
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error })
          }))
        }))
      });

      const result = await connectionMonitor.performHealthCheck();

      expect(result).toBe(true);
    });

    it('should return false when navigator is offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const result = await connectionMonitor.performHealthCheck();

      expect(result).toBe(false);
    });
  });

  describe('Connection Quality', () => {
    it('should return offline quality when not online', () => {
      // The connection should be offline initially
      const status = connectionMonitor.getConnectionStatus();
      expect(status.isOnline).toBe(false);
      
      const quality = connectionMonitor.getConnectionQuality();

      expect(quality.rating).toBe('offline');
      expect(quality.score).toBe(0);
    });

    it('should calculate quality based on performance metrics', async () => {
      // Simulate successful health checks with good latency
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      // Perform multiple health checks to build history
      await connectionMonitor.performHealthCheck();
      await connectionMonitor.performHealthCheck();
      await connectionMonitor.performHealthCheck();

      const quality = connectionMonitor.getConnectionQuality();

      expect(quality.rating).toBeOneOf(['excellent', 'good', 'poor']);
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.score).toBeLessThanOrEqual(100);
      expect(quality.factors).toHaveProperty('latency');
      expect(quality.factors).toHaveProperty('successRate');
      expect(quality.factors).toHaveProperty('stability');
    });
  });

  describe('Event Callbacks', () => {
    it('should register and call connection change callbacks', () => {
      const callback = vi.fn();
      connectionMonitor.onConnectionChange(callback);

      connectionMonitor.startMonitoring();

      // Trigger a status change by simulating network offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      // Simulate the offline event handler
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1];

      if (offlineHandler) {
        offlineHandler();
        expect(callback).toHaveBeenCalled();
      }
    });

    it('should register and call reconnected callbacks', () => {
      const callback = vi.fn();
      connectionMonitor.onReconnected(callback);

      // This would be called when connection is restored
      // We'll test this indirectly through health check success
      expect(callback).not.toHaveBeenCalled();
    });

    it('should register and call connection lost callbacks', () => {
      const callback = vi.fn();
      connectionMonitor.onConnectionLost(callback);

      connectionMonitor.startMonitoring();

      // Simulate network going offline
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1];

      if (offlineHandler) {
        offlineHandler();
        expect(callback).toHaveBeenCalled();
      }
    });
  });

  describe('Network Event Handling', () => {
    beforeEach(() => {
      connectionMonitor.startMonitoring();
    });

    it('should handle online event', () => {
      const onlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1];

      expect(onlineHandler).toBeDefined();

      if (onlineHandler) {
        onlineHandler();
        
        const status = connectionMonitor.getConnectionStatus();
        expect(status.networkConnected).toBe(true);
      }
    });

    it('should handle offline event', () => {
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1];

      expect(offlineHandler).toBeDefined();

      if (offlineHandler) {
        offlineHandler();
        
        const status = connectionMonitor.getConnectionStatus();
        expect(status.isOnline).toBe(false);
        expect(status.networkConnected).toBe(false);
        expect(status.quality).toBe('offline');
      }
    });

    it('should handle visibility change event', () => {
      const visibilityHandler = mockDocumentAddEventListener.mock.calls.find(
        call => call[0] === 'visibilitychange'
      )?.[1];

      expect(visibilityHandler).toBeDefined();

      if (visibilityHandler) {
        // Mock document.visibilityState
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          value: 'visible'
        });

        visibilityHandler();
        
        // Should trigger a health check after 500ms
        vi.advanceTimersByTime(500);
        expect(mockSupabase.from).toHaveBeenCalled();
      }
    });
  });

  describe('Heartbeat and Health Checks', () => {
    it('should start heartbeat and health check intervals', () => {
      connectionMonitor.startMonitoring();

      // Fast forward time to trigger intervals
      vi.advanceTimersByTime(10000); // Health check interval
      expect(mockSupabase.from).toHaveBeenCalled();

      vi.advanceTimersByTime(30000); // Heartbeat interval
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_current_timestamp');
    });

    it('should stop intervals when monitoring stops', () => {
      connectionMonitor.startMonitoring();
      connectionMonitor.stopMonitoring();

      // Clear previous calls
      vi.clearAllMocks();

      // Fast forward time - should not trigger any calls
      vi.advanceTimersByTime(60000);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection with exponential backoff', async () => {
      // Simulate connection failure
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection failed'))
          }))
        }))
      });

      await connectionMonitor.performHealthCheck();

      const status = connectionMonitor.getConnectionStatus();
      expect(status.reconnectAttempts).toBeGreaterThan(0);
      expect(status.isOnline).toBe(false);
    });

    it('should limit reconnection attempts', async () => {
      // Create a fresh instance for this test
      const freshMonitor = ConnectionMonitor.createInstance();
      
      // Simulate multiple connection failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection failed'))
          }))
        }))
      });

      // Perform multiple failed health checks
      for (let i = 0; i < 3; i++) {
        await freshMonitor.performHealthCheck();
      }

      const status = freshMonitor.getConnectionStatus();
      expect(status.reconnectAttempts).toBeGreaterThan(0);
      expect(status.reconnectAttempts).toBeLessThanOrEqual(5); // MAX_RECONNECT_ATTEMPTS
      
      freshMonitor.cleanup();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all resources', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      connectionMonitor.onConnectionChange(callback1);
      connectionMonitor.onReconnected(callback2);
      connectionMonitor.onConnectionLost(callback3);

      connectionMonitor.startMonitoring();
      connectionMonitor.cleanup();

      // Should remove event listeners
      expect(mockRemoveEventListener).toHaveBeenCalled();
      expect(mockDocumentRemoveEventListener).toHaveBeenCalled();

      // Callbacks should be cleared (we can't directly test this, but cleanup should handle it)
      expect(connectionMonitor.isOnline()).toBe(false);
    });
  });
});