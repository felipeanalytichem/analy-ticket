import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealtimeConnectionManager } from '../RealtimeConnectionManager';
import { mockSupabaseClient } from './setup';
import { NotificationTestUtils } from '@/lib/__tests__/notificationTestUtils';

describe('RealtimeConnectionManager', () => {
  let connectionManager: RealtimeConnectionManager;
  let mockChannel: any;

  beforeEach(() => {
    connectionManager = new RealtimeConnectionManager();
    
    mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn()
    };
    
    mockSupabaseClient.channel = vi.fn().mockReturnValue(mockChannel);
  });

  afterEach(async () => {
    await connectionManager.cleanup();
    vi.clearAllTimers();
  });

  describe('connect', () => {
    it('should create a new connection', () => {
      const callback = vi.fn();
      const connection = connectionManager.connect('test-user-id', callback);

      expect(connection).toMatchObject({
        userId: 'test-user-id',
        channel: mockChannel,
        status: 'connecting',
        reconnectAttempts: 0,
        callback
      });

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        'notifications-test-user-id',
        expect.any(Object)
      );
    });

    it('should return existing connection if already connected', () => {
      const callback = vi.fn();
      
      // First connection
      const connection1 = connectionManager.connect('test-user-id', callback);
      connection1.status = 'connected'; // Simulate successful connection
      
      // Second connection attempt
      const connection2 = connectionManager.connect('test-user-id', callback);
      
      expect(connection1).toBe(connection2);
    });

    it('should set up postgres_changes listeners', () => {
      const callback = vi.fn();
      connectionManager.connect('test-user-id', callback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.test-user-id'
        },
        expect.any(Function)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.test-user-id'
        },
        expect.any(Function)
      );
    });

    it('should handle subscription status changes', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Simulate successful subscription
      subscribeCallback('SUBSCRIBED');
      expect(connection.status).toBe('connected');
      expect(connection.reconnectAttempts).toBe(0);

      // Simulate error
      subscribeCallback('CHANNEL_ERROR', new Error('Connection failed'));
      expect(connection.status).toBe('error');
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clean up connection', () => {
      const callback = vi.fn();
      const connection = connectionManager.connect('test-user-id', callback);

      connectionManager.disconnect('test-user-id');

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
      expect(connection.status).toBe('disconnected');
      expect(connectionManager.isConnected('test-user-id')).toBe(false);
    });

    it('should handle disconnecting non-existent connection', () => {
      // Should not throw error
      expect(() => {
        connectionManager.disconnect('non-existent-user');
      }).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return true for connected users', () => {
      const callback = vi.fn();
      const connection = connectionManager.connect('test-user-id', callback);
      connection.status = 'connected';

      expect(connectionManager.isConnected('test-user-id')).toBe(true);
    });

    it('should return false for non-connected users', () => {
      expect(connectionManager.isConnected('test-user-id')).toBe(false);
      
      const callback = vi.fn();
      const connection = connectionManager.connect('test-user-id', callback);
      connection.status = 'error';

      expect(connectionManager.isConnected('test-user-id')).toBe(false);
    });
  });

  describe('getConnectionStatus', () => {
    it('should return status for existing connection', () => {
      const callback = vi.fn();
      const connection = connectionManager.connect('test-user-id', callback);
      connection.status = 'connected';
      connection.lastConnected = new Date();
      connection.reconnectAttempts = 2;

      const status = connectionManager.getConnectionStatus('test-user-id');

      expect(status).toMatchObject({
        connected: true,
        lastConnected: expect.any(Date),
        reconnectAttempts: 2
      });
    });

    it('should return default status for non-existent connection', () => {
      const status = connectionManager.getConnectionStatus('non-existent-user');

      expect(status).toMatchObject({
        connected: false,
        reconnectAttempts: 0
      });
    });
  });

  describe('reconnect', () => {
    it('should force reconnection', async () => {
      const callback = vi.fn();
      connectionManager.connect('test-user-id', callback);

      // Mock the reconnection process
      const disconnectSpy = vi.spyOn(connectionManager, 'disconnect');
      const connectSpy = vi.spyOn(connectionManager, 'connect');

      await connectionManager.reconnect('test-user-id');

      expect(disconnectSpy).toHaveBeenCalledWith('test-user-id');
      expect(connectSpy).toHaveBeenCalledWith('test-user-id', callback);
    });

    it('should handle reconnecting non-existent connection', async () => {
      // Should not throw error
      await expect(connectionManager.reconnect('non-existent-user')).resolves.not.toThrow();
    });
  });

  describe('error handling and reconnection', () => {
    it('should attempt reconnection on connection error', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Simulate connection error
      subscribeCallback('CHANNEL_ERROR', new Error('Connection failed'));

      expect(connection.status).toBe('error');
      expect(connection.reconnectAttempts).toBe(0);

      // Advance time to trigger reconnection attempt
      vi.advanceTimersByTime(1000);

      // Should have attempted reconnection
      expect(connection.reconnectAttempts).toBeGreaterThan(0);
    });

    it('should stop reconnecting after max attempts', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Simulate multiple connection failures
      for (let i = 0; i < 6; i++) {
        subscribeCallback('CHANNEL_ERROR', new Error('Connection failed'));
        vi.advanceTimersByTime(30000); // Max delay
      }

      expect(connection.status).toBe('error');
      expect(connection.reconnectAttempts).toBe(5); // Max attempts
    });
  });

  describe('heartbeat monitoring', () => {
    it('should start heartbeat when connected', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Simulate successful connection
      subscribeCallback('SUBSCRIBED');

      expect(connection.status).toBe('connected');

      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(30000);

      // Heartbeat should have been checked (no errors means it's working)
      expect(connection.status).toBe('connected');
    });
  });

  describe('notification event handling', () => {
    it('should call callback when notification event is received', () => {
      const callback = vi.fn();
      let insertHandler: any;

      mockChannel.on = vi.fn((event, config, handler) => {
        if (event === 'postgres_changes' && config.event === 'INSERT') {
          insertHandler = handler;
        }
        return mockChannel;
      });

      connectionManager.connect('test-user-id', callback);

      const mockNotification = { id: 'test-id', message: 'Test notification' };
      insertHandler({ new: mockNotification });

      expect(callback).toHaveBeenCalledWith(mockNotification);
    });

    it('should handle callback errors gracefully', () => {
      const callback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      let insertHandler: any;

      mockChannel.on = vi.fn((event, config, handler) => {
        if (event === 'postgres_changes' && config.event === 'INSERT') {
          insertHandler = handler;
        }
        return mockChannel;
      });

      connectionManager.connect('test-user-id', callback);

      const mockNotification = { id: 'test-id', message: 'Test notification' };
      
      // Should not throw error
      expect(() => {
        insertHandler({ new: mockNotification });
      }).not.toThrow();
    });
  });

  describe('getActiveConnections', () => {
    it('should return list of active connection user IDs', () => {
      const callback = vi.fn();
      
      connectionManager.connect('user1', callback);
      connectionManager.connect('user2', callback);

      const activeConnections = connectionManager.getActiveConnections();

      expect(activeConnections).toContain('user1');
      expect(activeConnections).toContain('user2');
      expect(activeConnections).toHaveLength(2);
    });
  });

  describe('getConnectionDetails', () => {
    it('should return connection details', () => {
      const callback = vi.fn();
      const connection = connectionManager.connect('test-user-id', callback);

      const details = connectionManager.getConnectionDetails('test-user-id');

      expect(details).toBe(connection);
    });

    it('should return null for non-existent connection', () => {
      const details = connectionManager.getConnectionDetails('non-existent-user');
      expect(details).toBeNull();
    });
  });

  describe('Comprehensive error scenarios', () => {
    it('should handle channel creation errors', () => {
      mockSupabaseClient.channel = vi.fn().mockImplementation(() => {
        throw new Error('Channel creation failed');
      });

      const callback = vi.fn();
      
      // Should not throw error
      expect(() => {
        connectionManager.connect('test-user-id', callback);
      }).not.toThrow();
    });

    it('should handle subscription errors', () => {
      const callback = vi.fn();
      
      mockChannel.subscribe = vi.fn().mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      // Should not throw error
      expect(() => {
        connectionManager.connect('test-user-id', callback);
      }).not.toThrow();
    });

    it('should handle unsubscribe errors', () => {
      const callback = vi.fn();
      const connection = connectionManager.connect('test-user-id', callback);

      mockChannel.unsubscribe = vi.fn().mockImplementation(() => {
        throw new Error('Unsubscribe failed');
      });

      // Should not throw error
      expect(() => {
        connectionManager.disconnect('test-user-id');
      }).not.toThrow();
    });

    it('should handle malformed notification events', () => {
      const callback = vi.fn();
      let insertHandler: any;

      mockChannel.on = vi.fn((event, config, handler) => {
        if (event === 'postgres_changes' && config.event === 'INSERT') {
          insertHandler = handler;
        }
        return mockChannel;
      });

      connectionManager.connect('test-user-id', callback);

      // Test with various malformed payloads
      const malformedPayloads = [
        null,
        undefined,
        { new: null },
        { new: undefined },
        { old: 'something' }, // Missing 'new'
        { new: { invalid: 'data' } },
        'invalid string',
        123,
        []
      ];

      malformedPayloads.forEach(payload => {
        expect(() => {
          insertHandler(payload);
        }).not.toThrow();
      });
    });
  });

  describe('Performance and scalability', () => {
    it('should handle multiple concurrent connections', () => {
      const callback = vi.fn();
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      // Create multiple connections
      const connections = userIds.map(userId => 
        connectionManager.connect(userId, callback)
      );

      expect(connections).toHaveLength(100);
      expect(connectionManager.getActiveConnections()).toHaveLength(100);

      // All connections should be unique
      const uniqueConnections = new Set(connections);
      expect(uniqueConnections.size).toBe(100);
    });

    it('should handle rapid connect/disconnect cycles', () => {
      const callback = vi.fn();
      const userId = 'test-user-id';

      // Rapid connect/disconnect cycles
      for (let i = 0; i < 50; i++) {
        connectionManager.connect(userId, callback);
        connectionManager.disconnect(userId);
      }

      // Should end up with no active connections
      expect(connectionManager.getActiveConnections()).toHaveLength(0);
      expect(connectionManager.isConnected(userId)).toBe(false);
    });

    it('should handle memory cleanup properly', async () => {
      const callback = vi.fn();
      const userIds = Array.from({ length: 50 }, (_, i) => `user-${i}`);

      // Create connections
      userIds.forEach(userId => {
        connectionManager.connect(userId, callback);
      });

      expect(connectionManager.getActiveConnections()).toHaveLength(50);

      // Cleanup
      await connectionManager.cleanup();

      expect(connectionManager.getActiveConnections()).toHaveLength(0);
    });
  });

  describe('Reconnection logic edge cases', () => {
    it('should handle exponential backoff correctly', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Test exponential backoff delays
      const expectedDelays = [1000, 2000, 4000, 8000, 16000]; // Capped at 30000

      for (let i = 0; i < 5; i++) {
        subscribeCallback('CHANNEL_ERROR', new Error('Connection failed'));
        
        // Check that reconnect attempt is scheduled
        expect(connection.reconnectAttempts).toBe(i);
        
        // Advance time by expected delay
        vi.advanceTimersByTime(expectedDelays[i]);
      }

      expect(connection.reconnectAttempts).toBe(5);
    });

    it('should handle reconnection during cleanup', async () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Trigger reconnection
      subscribeCallback('CHANNEL_ERROR', new Error('Connection failed'));

      // Start cleanup while reconnection is pending
      const cleanupPromise = connectionManager.cleanup();

      // Advance time to trigger reconnection attempt
      vi.advanceTimersByTime(1000);

      await cleanupPromise;

      // Should have cleaned up properly
      expect(connectionManager.getActiveConnections()).toHaveLength(0);
    });

    it('should handle connection status changes during reconnection', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Simulate successful connection
      subscribeCallback('SUBSCRIBED');
      expect(connection.status).toBe('connected');

      // Simulate error
      subscribeCallback('CHANNEL_ERROR', new Error('Connection failed'));
      expect(connection.status).toBe('error');

      // Simulate timeout
      subscribeCallback('TIMED_OUT');
      expect(connection.status).toBe('error');

      // Simulate closed
      subscribeCallback('CLOSED');
      expect(connection.status).toBe('error');
    });
  });

  describe('Heartbeat monitoring edge cases', () => {
    it('should handle heartbeat during disconnection', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Simulate successful connection (starts heartbeat)
      subscribeCallback('SUBSCRIBED');
      expect(connection.status).toBe('connected');

      // Disconnect while heartbeat is active
      connectionManager.disconnect('test-user-id');

      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(30000);

      // Should not cause errors
      expect(connectionManager.isConnected('test-user-id')).toBe(false);
    });

    it('should handle heartbeat failure', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Simulate successful connection
      subscribeCallback('SUBSCRIBED');
      expect(connection.status).toBe('connected');

      // Manually set status to error to simulate heartbeat failure
      connection.status = 'error';

      // Advance time to trigger heartbeat check
      vi.advanceTimersByTime(30000);

      // Should have triggered reconnection logic
      expect(connection.status).toBe('error');
    });
  });

  describe('Real-time event handling comprehensive tests', () => {
    it('should handle INSERT events correctly', () => {
      const callback = vi.fn();
      let insertHandler: any;

      mockChannel.on = vi.fn((event, config, handler) => {
        if (event === 'postgres_changes' && config.event === 'INSERT') {
          insertHandler = handler;
        }
        return mockChannel;
      });

      connectionManager.connect('test-user-id', callback);

      const mockNotification = NotificationTestUtils.createMockNotification();
      insertHandler({ new: mockNotification });

      expect(callback).toHaveBeenCalledWith(mockNotification);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle UPDATE events correctly', () => {
      const callback = vi.fn();
      let updateHandler: any;

      mockChannel.on = vi.fn((event, config, handler) => {
        if (event === 'postgres_changes' && config.event === 'UPDATE') {
          updateHandler = handler;
        }
        return mockChannel;
      });

      connectionManager.connect('test-user-id', callback);

      const mockNotification = NotificationTestUtils.createMockNotification({ read: true });
      updateHandler({ new: mockNotification });

      expect(callback).toHaveBeenCalledWith(mockNotification);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple event types for same user', () => {
      const callback = vi.fn();
      let insertHandler: any;
      let updateHandler: any;

      mockChannel.on = vi.fn((event, config, handler) => {
        if (event === 'postgres_changes') {
          if (config.event === 'INSERT') {
            insertHandler = handler;
          } else if (config.event === 'UPDATE') {
            updateHandler = handler;
          }
        }
        return mockChannel;
      });

      connectionManager.connect('test-user-id', callback);

      const insertNotification = NotificationTestUtils.createMockNotification({ id: 'insert-1' });
      const updateNotification = NotificationTestUtils.createMockNotification({ id: 'update-1', read: true });

      insertHandler({ new: insertNotification });
      updateHandler({ new: updateNotification });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, insertNotification);
      expect(callback).toHaveBeenNthCalledWith(2, updateNotification);
    });
  });

  describe('Connection lifecycle management', () => {
    it('should handle complete connection lifecycle', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      // 1. Connect
      const connection = connectionManager.connect('test-user-id', callback);
      expect(connection.status).toBe('connecting');

      // 2. Successful subscription
      subscribeCallback('SUBSCRIBED');
      expect(connection.status).toBe('connected');
      expect(connection.reconnectAttempts).toBe(0);

      // 3. Connection error
      subscribeCallback('CHANNEL_ERROR', new Error('Network error'));
      expect(connection.status).toBe('error');

      // 4. Reconnection attempt
      vi.advanceTimersByTime(1000);
      expect(connection.reconnectAttempts).toBeGreaterThan(0);

      // 5. Successful reconnection
      subscribeCallback('SUBSCRIBED');
      expect(connection.status).toBe('connected');

      // 6. Manual disconnect
      connectionManager.disconnect('test-user-id');
      expect(connection.status).toBe('disconnected');
      expect(connectionManager.isConnected('test-user-id')).toBe(false);
    });

    it('should handle overlapping connection attempts', () => {
      const callback = vi.fn();
      
      // First connection
      const connection1 = connectionManager.connect('test-user-id', callback);
      connection1.status = 'connecting';

      // Second connection attempt while first is still connecting
      const connection2 = connectionManager.connect('test-user-id', callback);

      // Should clean up first connection and create new one
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
      expect(connection2).not.toBe(connection1);
    });
  });

  describe('Resource management and cleanup', () => {
    it('should clean up all timers on disconnect', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Start heartbeat
      subscribeCallback('SUBSCRIBED');

      // Trigger reconnection timer
      subscribeCallback('CHANNEL_ERROR', new Error('Connection failed'));

      // Disconnect should clear all timers
      connectionManager.disconnect('test-user-id');

      // Advance time significantly
      vi.advanceTimersByTime(60000);

      // No reconnection should have occurred
      expect(connection.status).toBe('disconnected');
    });

    it('should handle cleanup with active timers', async () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      // Create multiple connections with active timers
      const userIds = ['user1', 'user2', 'user3'];
      userIds.forEach(userId => {
        const connection = connectionManager.connect(userId, callback);
        subscribeCallback('SUBSCRIBED'); // Start heartbeat
        subscribeCallback('CHANNEL_ERROR', new Error('Error')); // Start reconnection timer
      });

      // Cleanup should handle all timers
      await connectionManager.cleanup();

      expect(connectionManager.getActiveConnections()).toHaveLength(0);

      // Advance time to ensure no timers are still active
      vi.advanceTimersByTime(60000);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle empty or invalid user IDs', () => {
      const callback = vi.fn();

      // Test various invalid user IDs
      const invalidUserIds = ['', null, undefined, 0, false, {}];

      invalidUserIds.forEach(userId => {
        expect(() => {
          connectionManager.connect(userId as any, callback);
        }).not.toThrow();
      });
    });

    it('should handle null or undefined callbacks', () => {
      const invalidCallbacks = [null, undefined, 'not a function', 123, {}];

      invalidCallbacks.forEach(callback => {
        expect(() => {
          connectionManager.connect('test-user-id', callback as any);
        }).not.toThrow();
      });
    });

    it('should handle very rapid reconnection attempts', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Rapid error events
      for (let i = 0; i < 10; i++) {
        subscribeCallback('CHANNEL_ERROR', new Error(`Error ${i}`));
      }

      // Should not exceed max reconnect attempts
      expect(connection.reconnectAttempts).toBeLessThanOrEqual(5);
    });

    it('should handle connection status queries during transitions', () => {
      const callback = vi.fn();
      let subscribeCallback: any;

      mockChannel.subscribe = vi.fn((cb) => {
        subscribeCallback = cb;
      });

      const connection = connectionManager.connect('test-user-id', callback);

      // Check status during various states
      expect(connectionManager.getConnectionStatus('test-user-id').connected).toBe(false);

      subscribeCallback('SUBSCRIBED');
      expect(connectionManager.getConnectionStatus('test-user-id').connected).toBe(true);

      subscribeCallback('CHANNEL_ERROR', new Error('Error'));
      expect(connectionManager.getConnectionStatus('test-user-id').connected).toBe(false);
    });
  });
});