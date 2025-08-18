import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationManager } from '../NotificationManager';
import { mockSupabaseClient, createMockNotification, createMockTicket } from './setup';
import { NotificationTestUtils } from '@/lib/__tests__/notificationTestUtils';

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;

  beforeEach(() => {
    notificationManager = NotificationManager.getInstance();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await notificationManager.cleanup();
    vi.clearAllTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NotificationManager.getInstance();
      const instance2 = NotificationManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getNotifications', () => {
    it('should fetch notifications for a user', async () => {
      const mockNotifications = [createMockNotification()];
      const mockTicket = createMockTicket();

      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      mockSupabaseClient.from().select().eq().single = vi.fn().mockResolvedValue({
        data: mockTicket,
        error: null
      });

      const result = await notificationManager.getNotifications('test-user-id');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...mockNotifications[0],
        ticket: mockTicket
      });
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await notificationManager.getNotifications('test-user-id');

      expect(result).toEqual([]);
    });

    it('should apply query options correctly', async () => {
      const mockNotifications = [createMockNotification()];
      
      mockSupabaseClient.from().select().eq().order().limit().range().then = vi.fn().mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      const options = {
        limit: 10,
        offset: 5,
        type: 'ticket_created',
        priority: 'high' as const,
        read: false
      };

      await notificationManager.getNotifications('test-user-id', options);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabaseClient.from().limit).toHaveBeenCalledWith(10);
      expect(mockSupabaseClient.from().range).toHaveBeenCalledWith(5, 14);
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('type', 'ticket_created');
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('priority', 'high');
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('read', false);
    });
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const notificationData = {
        user_id: 'test-user-id',
        message: 'Test message',
        type: 'ticket_created',
        title: 'Test Title',
        priority: 'medium' as const
      };

      const result = await notificationManager.createNotification(notificationData);

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          ...notificationData,
          read: false,
          created_at: expect.any(String),
          updated_at: expect.any(String)
        })
      ]);
    });

    it('should handle creation errors', async () => {
      mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' }
      });

      const notificationData = {
        user_id: 'test-user-id',
        message: 'Test message',
        type: 'ticket_created',
        title: 'Test Title'
      };

      const result = await notificationManager.createNotification(notificationData);

      expect(result).toBe(false);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockSupabaseClient.from().update().eq().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const result = await notificationManager.markAsRead('test-notification-id');

      expect(result).toBe(true);
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        read: true,
        updated_at: expect.any(String)
      });
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('id', 'test-notification-id');
    });

    it('should handle update errors', async () => {
      mockSupabaseClient.from().update().eq().then = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      const result = await notificationManager.markAsRead('test-notification-id');

      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      mockSupabaseClient.from().update().eq().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const result = await notificationManager.markAllAsRead('test-user-id');

      expect(result).toBe(true);
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        read: true,
        updated_at: expect.any(String)
      });
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('read', false);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      mockSupabaseClient.from().delete().eq().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const result = await notificationManager.deleteNotification('test-notification-id');

      expect(result).toBe(true);
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('id', 'test-notification-id');
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread notification count', async () => {
      mockSupabaseClient.from().select().eq().then = vi.fn().mockResolvedValue({
        count: 5,
        error: null
      });

      const result = await notificationManager.getUnreadCount('test-user-id');

      expect(result).toBe(5);
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('read', false);
    });

    it('should return 0 on error', async () => {
      mockSupabaseClient.from().select().eq().then = vi.fn().mockResolvedValue({
        count: null,
        error: { message: 'Count failed' }
      });

      const result = await notificationManager.getUnreadCount('test-user-id');

      expect(result).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('should create a subscription', () => {
      const callback = vi.fn();
      const subscription = notificationManager.subscribe('test-user-id', callback);

      expect(subscription).toMatchObject({
        id: expect.any(String),
        userId: 'test-user-id',
        unsubscribe: expect.any(Function)
      });
    });

    it('should prevent duplicate subscriptions', () => {
      const callback = vi.fn();
      const subscription1 = notificationManager.subscribe('test-user-id', callback);
      const subscription2 = notificationManager.subscribe('test-user-id', callback);

      expect(subscription1).toBe(subscription2);
    });
  });

  describe('getUserPreferences', () => {
    it('should get user preferences', async () => {
      const mockPreferences = {
        user_id: 'test-user-id',
        preferences: {
          emailNotifications: true,
          toastNotifications: false
        }
      };

      mockSupabaseClient.from().select().eq().single = vi.fn().mockResolvedValue({
        data: mockPreferences,
        error: null
      });

      const result = await notificationManager.getUserPreferences('test-user-id');

      expect(result).toMatchObject({
        userId: 'test-user-id',
        emailNotifications: true,
        toastNotifications: false
      });
    });

    it('should return default preferences when none exist', async () => {
      mockSupabaseClient.from().select().eq().single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      });

      const result = await notificationManager.getUserPreferences('test-user-id');

      expect(result).toMatchObject({
        userId: 'test-user-id',
        emailNotifications: true,
        toastNotifications: true,
        soundNotifications: false
      });
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      mockSupabaseClient.from().upsert().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const preferences = {
        emailNotifications: false,
        toastNotifications: true
      };

      const result = await notificationManager.updateUserPreferences('test-user-id', preferences);

      expect(result).toBe(true);
      expect(mockSupabaseClient.from().upsert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        preferences,
        updated_at: expect.any(String)
      });
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status', () => {
      const status = notificationManager.getConnectionStatus('test-user-id');

      expect(status).toMatchObject({
        connected: expect.any(Boolean),
        reconnectAttempts: expect.any(Number)
      });
    });
  });

  describe('Caching behavior', () => {
    it('should cache notification results', async () => {
      const mockNotifications = [createMockNotification()];
      
      mockSupabaseClient.from().select().eq().order().then = vi.fn()
        .mockResolvedValueOnce({
          data: mockNotifications,
          error: null
        })
        .mockResolvedValueOnce({
          data: [],
          error: null
        });

      // First call should hit database
      const result1 = await notificationManager.getNotifications('test-user-id');
      expect(result1).toHaveLength(1);

      // Second call should use cache (database won't be called again)
      const result2 = await notificationManager.getNotifications('test-user-id');
      expect(result2).toHaveLength(1);

      // Verify database was only called once
      expect(mockSupabaseClient.from().select().eq().order().then).toHaveBeenCalledTimes(1);
    });

    it('should cache unread count', async () => {
      mockSupabaseClient.from().select().eq().then = vi.fn()
        .mockResolvedValueOnce({
          count: 5,
          error: null
        });

      // First call should hit database
      const count1 = await notificationManager.getUnreadCount('test-user-id');
      expect(count1).toBe(5);

      // Second call should use cache
      const count2 = await notificationManager.getUnreadCount('test-user-id');
      expect(count2).toBe(5);

      // Verify database was only called once
      expect(mockSupabaseClient.from().select().eq().then).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on notification creation', async () => {
      // Setup initial cache
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: [createMockNotification()],
        error: null
      });

      await notificationManager.getNotifications('test-user-id');

      // Create notification (should invalidate cache)
      mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      await notificationManager.createNotification({
        user_id: 'test-user-id',
        message: 'New notification',
        type: 'ticket_created',
        title: 'New Title'
      });

      // Next call should hit database again due to cache invalidation
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: [createMockNotification(), createMockNotification()],
        error: null
      });

      const result = await notificationManager.getNotifications('test-user-id');
      expect(result).toHaveLength(2);
    });
  });

  describe('Error handling and retry logic', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network connection failed');
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockRejectedValue(networkError);

      const result = await notificationManager.getNotifications('test-user-id');

      expect(result).toEqual([]);
    });

    it('should queue failed notification creation for retry', async () => {
      const dbError = { message: 'Database unavailable' };
      mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
        data: null,
        error: dbError
      });

      const notificationData = {
        user_id: 'test-user-id',
        message: 'Test message',
        type: 'ticket_created',
        title: 'Test Title'
      };

      const result = await notificationManager.createNotification(notificationData);

      expect(result).toBe(false);
      // Verify that the notification was queued for retry
      // (This would require access to the queue, which might need to be exposed for testing)
    });

    it('should handle concurrent operations safely', async () => {
      const mockNotifications = [createMockNotification()];
      
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      // Simulate concurrent calls
      const promises = Array.from({ length: 10 }, () => 
        notificationManager.getNotifications('test-user-id')
      );

      const results = await Promise.all(promises);

      // All results should be identical
      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject(mockNotifications[0]);
      });
    });
  });

  describe('Real-time subscription management', () => {
    it('should handle subscription errors gracefully', () => {
      // Mock the realtime manager to throw an error
      const originalConnect = notificationManager['realtimeManager'].connect;
      notificationManager['realtimeManager'].connect = vi.fn().mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const callback = vi.fn();
      const subscription = notificationManager.subscribe('test-user-id', callback);

      // Should return a dummy subscription that doesn't crash
      expect(subscription).toMatchObject({
        id: expect.any(String),
        userId: 'test-user-id',
        unsubscribe: expect.any(Function)
      });

      // Restore original method
      notificationManager['realtimeManager'].connect = originalConnect;
    });

    it('should clean up subscriptions on unsubscribe', () => {
      const callback = vi.fn();
      const subscription = notificationManager.subscribe('test-user-id', callback);

      // Verify subscription exists
      expect(notificationManager['subscriptions'].has('test-user-id')).toBe(true);

      // Unsubscribe
      notificationManager.unsubscribe(subscription);

      // Verify subscription is removed
      expect(notificationManager['subscriptions'].has('test-user-id')).toBe(false);
    });

    it('should handle unsubscribe errors gracefully', () => {
      const callback = vi.fn();
      const subscription = notificationManager.subscribe('test-user-id', callback);

      // Mock unsubscribe to throw error
      const originalUnsubscribe = subscription.unsubscribe;
      subscription.unsubscribe = vi.fn().mockImplementation(() => {
        throw new Error('Unsubscribe failed');
      });

      // Should not throw
      expect(() => {
        notificationManager.unsubscribe(subscription);
      }).not.toThrow();

      // Restore original method
      subscription.unsubscribe = originalUnsubscribe;
    });
  });

  describe('Preferences management', () => {
    it('should handle preferences database errors', async () => {
      mockSupabaseClient.from().select().eq().single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' }
      });

      const result = await notificationManager.getUserPreferences('test-user-id');

      // Should return default preferences on error
      expect(result).toMatchObject({
        userId: 'test-user-id',
        emailNotifications: true,
        toastNotifications: true
      });
    });

    it('should handle preferences update errors', async () => {
      mockSupabaseClient.from().upsert().then = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      const preferences = { emailNotifications: false };
      const result = await notificationManager.updateUserPreferences('test-user-id', preferences);

      expect(result).toBe(false);
    });

    it('should cache preferences after retrieval', async () => {
      const mockPreferences = {
        user_id: 'test-user-id',
        preferences: { emailNotifications: true }
      };

      mockSupabaseClient.from().select().eq().single = vi.fn()
        .mockResolvedValueOnce({
          data: mockPreferences,
          error: null
        });

      // First call should hit database
      const result1 = await notificationManager.getUserPreferences('test-user-id');
      expect(result1?.emailNotifications).toBe(true);

      // Second call should use cache
      const result2 = await notificationManager.getUserPreferences('test-user-id');
      expect(result2?.emailNotifications).toBe(true);

      // Verify database was only called once
      expect(mockSupabaseClient.from().select().eq().single).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ticket data enrichment', () => {
    it('should handle missing ticket data gracefully', async () => {
      const mockNotifications = [createMockNotification({ ticket_id: 'missing-ticket' })];
      
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      // Mock ticket query to return null
      mockSupabaseClient.from().select().eq().single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Ticket not found' }
      });

      const result = await notificationManager.getNotifications('test-user-id');

      expect(result).toHaveLength(1);
      expect(result[0].ticket).toBeNull();
    });

    it('should enrich notifications with ticket data when available', async () => {
      const mockNotifications = [createMockNotification({ ticket_id: 'test-ticket-id' })];
      const mockTicket = createMockTicket();
      
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      mockSupabaseClient.from().select().eq().single = vi.fn().mockResolvedValue({
        data: mockTicket,
        error: null
      });

      const result = await notificationManager.getNotifications('test-user-id');

      expect(result).toHaveLength(1);
      expect(result[0].ticket).toEqual(mockTicket);
    });
  });

  describe('Performance and optimization', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = NotificationTestUtils.createMockNotificationList(1000);
      
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: largeDataset,
        error: null
      });

      const startTime = Date.now();
      const result = await notificationManager.getNotifications('test-user-id', { limit: 1000 });
      const endTime = Date.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should apply pagination correctly', async () => {
      const mockNotifications = NotificationTestUtils.createMockNotificationList(5);
      
      mockSupabaseClient.from().select().eq().order().limit().range().then = vi.fn().mockResolvedValue({
        data: mockNotifications.slice(2, 4), // Simulate pagination
        error: null
      });

      const result = await notificationManager.getNotifications('test-user-id', {
        limit: 2,
        offset: 2
      });

      expect(result).toHaveLength(2);
      expect(mockSupabaseClient.from().range).toHaveBeenCalledWith(2, 3);
    });
  });

  describe('Cleanup and resource management', () => {
    it('should cleanup all resources on cleanup', async () => {
      // Create some subscriptions
      const callback = vi.fn();
      const subscription1 = notificationManager.subscribe('user-1', callback);
      const subscription2 = notificationManager.subscribe('user-2', callback);

      expect(notificationManager['subscriptions'].size).toBe(2);

      // Cleanup
      await notificationManager.cleanup();

      // Verify all subscriptions are removed
      expect(notificationManager['subscriptions'].size).toBe(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock cleanup methods to throw errors
      notificationManager['realtimeManager'].cleanup = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
      notificationManager['queue'].cleanup = vi.fn().mockRejectedValue(new Error('Queue cleanup failed'));
      notificationManager['cache'].clear = vi.fn().mockRejectedValue(new Error('Cache clear failed'));

      // Should not throw
      await expect(notificationManager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle null/undefined user IDs', async () => {
      const result1 = await notificationManager.getNotifications('');
      const result2 = await notificationManager.getUnreadCount('');

      expect(result1).toEqual([]);
      expect(result2).toBe(0);
    });

    it('should handle malformed notification data', async () => {
      const malformedData = [
        { id: 'test', user_id: null, message: null }, // Missing required fields
        { invalid: 'data' }, // Completely wrong structure
        null, // Null entry
        undefined // Undefined entry
      ];

      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: malformedData,
        error: null
      });

      const result = await notificationManager.getNotifications('test-user-id');

      // Should handle malformed data gracefully
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle concurrent subscription attempts', () => {
      const callback = vi.fn();
      
      // Create multiple subscriptions simultaneously
      const subscriptions = Array.from({ length: 5 }, () => 
        notificationManager.subscribe('test-user-id', callback)
      );

      // All should return the same subscription (deduplication)
      subscriptions.forEach(sub => {
        expect(sub.userId).toBe('test-user-id');
      });

      // Only one subscription should exist
      expect(notificationManager['subscriptions'].size).toBe(1);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete notification lifecycle', async () => {
      // 1. Create notification
      mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const createResult = await notificationManager.createNotification({
        user_id: 'test-user-id',
        message: 'Test notification',
        type: 'ticket_created',
        title: 'Test Title'
      });

      expect(createResult).toBe(true);

      // 2. Fetch notifications
      const mockNotifications = [createMockNotification({ read: false })];
      mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      const notifications = await notificationManager.getNotifications('test-user-id');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].read).toBe(false);

      // 3. Mark as read
      mockSupabaseClient.from().update().eq().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const markResult = await notificationManager.markAsRead(notifications[0].id!);
      expect(markResult).toBe(true);

      // 4. Delete notification
      mockSupabaseClient.from().delete().eq().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const deleteResult = await notificationManager.deleteNotification(notifications[0].id!);
      expect(deleteResult).toBe(true);
    });

    it('should handle subscription with real-time updates', () => {
      const callback = vi.fn();
      const subscription = notificationManager.subscribe('test-user-id', callback);

      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');

      // Simulate real-time update
      const mockNotification = createMockNotification();
      // This would typically be triggered by the realtime manager
      // callback(mockNotification);

      // Cleanup
      subscription.unsubscribe();
    });
  });
});