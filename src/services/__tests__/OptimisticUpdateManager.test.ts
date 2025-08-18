import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OptimisticUpdateManager, PendingUpdate } from '../OptimisticUpdateManager';
import { NotificationWithTicket } from '@/lib/notificationService';

describe('OptimisticUpdateManager', () => {
  let manager: OptimisticUpdateManager;
  let mockNotifications: NotificationWithTicket[];

  beforeEach(() => {
    manager = new OptimisticUpdateManager({
      maxRetries: 3,
      retryDelay: 100, // Shorter delay for testing
      enableRollback: true
    });

    mockNotifications = [
      {
        id: '1',
        user_id: 'user1',
        message: 'Test notification 1',
        type: 'ticket_created',
        read: false,
        priority: 'medium',
        created_at: '2023-01-01T00:00:00Z',
        title: 'Test 1',
        ticket_id: 'ticket1'
      },
      {
        id: '2',
        user_id: 'user1',
        message: 'Test notification 2',
        type: 'ticket_updated',
        read: false,
        priority: 'high',
        created_at: '2023-01-01T01:00:00Z',
        title: 'Test 2',
        ticket_id: 'ticket2'
      },
      {
        id: '3',
        user_id: 'user1',
        message: 'Test notification 3',
        type: 'comment_added',
        read: true,
        priority: 'low',
        created_at: '2023-01-01T02:00:00Z',
        title: 'Test 3',
        ticket_id: 'ticket3'
      }
    ];

    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should create manager with default options', () => {
      const defaultManager = new OptimisticUpdateManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager.hasPendingUpdates()).toBe(false);
      defaultManager.destroy();
    });

    it('should track pending updates', () => {
      expect(manager.hasPendingUpdates()).toBe(false);
      expect(manager.getPendingUpdates()).toEqual([]);
    });
  });

  describe('Mark as Read Optimistic Updates', () => {
    it('should apply optimistic update for mark as read', async () => {
      const mockUpdateFn = vi.fn().mockResolvedValue(true);
      const updateCallback = vi.fn();
      
      manager.onUpdate(updateCallback);

      const result = await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);

      // Should return optimistically updated notifications
      expect(result).toHaveLength(3);
      expect(result[0].read).toBe(true);
      expect(result[0].id).toBe('1');
      expect(result[1].read).toBe(false); // Other notifications unchanged
      expect(result[2].read).toBe(true); // This was already read

      // Should have pending update
      expect(manager.hasPendingUpdates()).toBe(true);
      expect(manager.getPendingUpdates()).toHaveLength(1);

      // Should notify callback
      expect(updateCallback).toHaveBeenCalledWith(result);
    });

    it('should handle successful background update', async () => {
      const mockUpdateFn = vi.fn().mockResolvedValue(true);
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      
      expect(manager.hasPendingUpdates()).toBe(true);

      // Wait for background update to complete
      await vi.runAllTimersAsync();

      expect(mockUpdateFn).toHaveBeenCalledWith('1');
      expect(manager.hasPendingUpdates()).toBe(false);
    });

    it('should handle failed background update with retry', async () => {
      const mockUpdateFn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(true);
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      
      expect(manager.hasPendingUpdates()).toBe(true);

      // Wait for initial attempt and first retry
      await vi.runAllTimersAsync();

      expect(mockUpdateFn).toHaveBeenCalledTimes(2);
      expect(manager.hasPendingUpdates()).toBe(false);
    });

    it('should rollback after max retries', async () => {
      const mockUpdateFn = vi.fn().mockRejectedValue(new Error('Persistent error'));
      const updateCallback = vi.fn();
      const errorCallback = vi.fn();
      
      manager.onUpdate(updateCallback);
      manager.onError(errorCallback);

      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      
      // Wait for all retries to complete
      await vi.runAllTimersAsync();

      expect(mockUpdateFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(manager.hasPendingUpdates()).toBe(false);
      
      // Should have called rollback (update callback with original data)
      expect(updateCallback).toHaveBeenCalledTimes(2); // Optimistic + rollback
      expect(updateCallback).toHaveBeenLastCalledWith(mockNotifications);
      
      // Should have called error callback
      expect(errorCallback).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: 'markAsRead',
          notificationId: '1'
        })
      );
    });

    it('should throw error for non-existent notification', async () => {
      const mockUpdateFn = vi.fn();
      
      await expect(
        manager.markAsReadOptimistic('non-existent', mockNotifications, mockUpdateFn)
      ).rejects.toThrow('Notification non-existent not found');
    });
  });

  describe('Delete Optimistic Updates', () => {
    it('should apply optimistic update for delete', async () => {
      const mockDeleteFn = vi.fn().mockResolvedValue(true);
      const updateCallback = vi.fn();
      
      manager.onUpdate(updateCallback);

      const result = await manager.deleteOptimistic('2', mockNotifications, mockDeleteFn);

      // Should return notifications without deleted one
      expect(result).toHaveLength(2);
      expect(result.find(n => n.id === '2')).toBeUndefined();
      expect(result.find(n => n.id === '1')).toBeDefined();
      expect(result.find(n => n.id === '3')).toBeDefined();

      // Should have pending update
      expect(manager.hasPendingUpdates()).toBe(true);
      expect(manager.getPendingUpdates()[0].operation).toBe('delete');

      // Should notify callback
      expect(updateCallback).toHaveBeenCalledWith(result);
    });

    it('should handle successful delete operation', async () => {
      const mockDeleteFn = vi.fn().mockResolvedValue(true);
      
      await manager.deleteOptimistic('2', mockNotifications, mockDeleteFn);
      
      // Wait for background operation
      await vi.runAllTimersAsync();

      expect(mockDeleteFn).toHaveBeenCalledWith('2');
      expect(manager.hasPendingUpdates()).toBe(false);
    });

    it('should rollback failed delete operation', async () => {
      const mockDeleteFn = vi.fn().mockRejectedValue(new Error('Delete failed'));
      const updateCallback = vi.fn();
      
      manager.onUpdate(updateCallback);

      await manager.deleteOptimistic('2', mockNotifications, mockDeleteFn);
      
      // Wait for all retries
      await vi.runAllTimersAsync();

      // Should have rolled back to original notifications
      expect(updateCallback).toHaveBeenLastCalledWith(mockNotifications);
      expect(manager.hasPendingUpdates()).toBe(false);
    });
  });

  describe('Mark All as Read Optimistic Updates', () => {
    it('should apply optimistic update for mark all as read', async () => {
      const mockUpdateFn = vi.fn().mockResolvedValue(true);
      const updateCallback = vi.fn();
      
      manager.onUpdate(updateCallback);

      const result = await manager.markAllAsReadOptimistic('user1', mockNotifications, mockUpdateFn);

      // Should mark all notifications as read
      expect(result).toHaveLength(3);
      expect(result.every(n => n.read === true)).toBe(true);
      expect(result.every(n => n.updated_at)).toBeTruthy();

      // Should have pending update
      expect(manager.hasPendingUpdates()).toBe(true);
      expect(manager.getPendingUpdates()[0].operation).toBe('markAllAsRead');

      // Should notify callback
      expect(updateCallback).toHaveBeenCalledWith(result);
    });

    it('should handle successful mark all as read operation', async () => {
      const mockUpdateFn = vi.fn().mockResolvedValue(true);
      
      await manager.markAllAsReadOptimistic('user1', mockNotifications, mockUpdateFn);
      
      // Wait for background operation
      await vi.runAllTimersAsync();

      expect(mockUpdateFn).toHaveBeenCalledWith('user1');
      expect(manager.hasPendingUpdates()).toBe(false);
    });
  });

  describe('Callback Management', () => {
    it('should manage update callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      const unsubscribe1 = manager.onUpdate(callback1);
      const unsubscribe2 = manager.onUpdate(callback2);

      // Both callbacks should be called
      manager['notifyUpdateCallbacks'](mockNotifications);
      expect(callback1).toHaveBeenCalledWith(mockNotifications);
      expect(callback2).toHaveBeenCalledWith(mockNotifications);

      // Unsubscribe first callback
      unsubscribe1();
      callback1.mockClear();
      callback2.mockClear();

      manager['notifyUpdateCallbacks'](mockNotifications);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith(mockNotifications);

      // Unsubscribe second callback
      unsubscribe2();
    });

    it('should manage error callbacks', () => {
      const errorCallback1 = vi.fn();
      const errorCallback2 = vi.fn();
      
      const unsubscribe1 = manager.onError(errorCallback1);
      const unsubscribe2 = manager.onError(errorCallback2);

      const error = new Error('Test error');
      const update: PendingUpdate = {
        id: 'test',
        operation: 'markAsRead',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
      };

      // Both callbacks should be called
      manager['notifyErrorCallbacks'](error, update);
      expect(errorCallback1).toHaveBeenCalledWith(error, update);
      expect(errorCallback2).toHaveBeenCalledWith(error, update);

      // Unsubscribe callbacks
      unsubscribe1();
      unsubscribe2();
    });

    it('should handle callback errors gracefully', () => {
      const faultyCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const goodCallback = vi.fn();
      
      manager.onUpdate(faultyCallback);
      manager.onUpdate(goodCallback);

      // Should not throw and should still call good callback
      expect(() => {
        manager['notifyUpdateCallbacks'](mockNotifications);
      }).not.toThrow();

      expect(faultyCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('Update Management', () => {
    it('should cancel pending update', async () => {
      const mockUpdateFn = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      
      const pendingUpdates = manager.getPendingUpdates();
      expect(pendingUpdates).toHaveLength(1);
      
      const updateId = pendingUpdates[0].id;
      const cancelled = manager.cancelUpdate(updateId);
      
      expect(cancelled).toBe(true);
      expect(manager.hasPendingUpdates()).toBe(false);
    });

    it('should cancel all pending updates', async () => {
      const mockUpdateFn = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      await manager.deleteOptimistic('2', mockNotifications, mockUpdateFn);
      
      expect(manager.getPendingUpdates()).toHaveLength(2);
      
      manager.cancelAllUpdates();
      
      expect(manager.hasPendingUpdates()).toBe(false);
      expect(manager.getPendingUpdates()).toHaveLength(0);
    });

    it('should cleanup expired updates', async () => {
      const mockUpdateFn = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      
      // Advance time to make update expired
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      
      const cleanedCount = manager.cleanup(5 * 60 * 1000); // 5 minute max age
      
      expect(cleanedCount).toBe(1);
      expect(manager.hasPendingUpdates()).toBe(false);
    });

    it('should not cleanup non-expired updates', async () => {
      const mockUpdateFn = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      
      // Advance time but not enough to expire
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes
      
      const cleanedCount = manager.cleanup(5 * 60 * 1000); // 5 minute max age
      
      expect(cleanedCount).toBe(0);
      expect(manager.hasPendingUpdates()).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should use exponential backoff for retries', async () => {
      const mockUpdateFn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValue(true);
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      
      // First attempt (immediate)
      await vi.advanceTimersByTimeAsync(0);
      expect(mockUpdateFn).toHaveBeenCalledTimes(1);
      
      // First retry (100ms delay)
      await vi.advanceTimersByTimeAsync(100);
      expect(mockUpdateFn).toHaveBeenCalledTimes(2);
      
      // Second retry (200ms delay)
      await vi.advanceTimersByTimeAsync(200);
      expect(mockUpdateFn).toHaveBeenCalledTimes(3);
      
      // Third retry (400ms delay)
      await vi.advanceTimersByTimeAsync(400);
      expect(mockUpdateFn).toHaveBeenCalledTimes(4);
      
      expect(manager.hasPendingUpdates()).toBe(false);
    });

    it('should handle update function returning false', async () => {
      const mockUpdateFn = vi.fn().mockResolvedValue(false);
      const errorCallback = vi.fn();
      
      manager.onError(errorCallback);
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      
      // Wait for all retries
      await vi.runAllTimersAsync();
      
      expect(mockUpdateFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(manager.hasPendingUpdates()).toBe(false);
      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty notifications array', async () => {
      const mockUpdateFn = vi.fn();
      
      await expect(
        manager.markAsReadOptimistic('1', [], mockUpdateFn)
      ).rejects.toThrow('Notification 1 not found');
    });

    it('should handle concurrent updates to same notification', async () => {
      const mockUpdateFn = vi.fn().mockResolvedValue(true);
      
      // Start two concurrent updates
      const promise1 = manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      const promise2 = manager.deleteOptimistic('1', mockNotifications, mockUpdateFn);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // Both should succeed with their respective optimistic updates
      expect(result1[0].read).toBe(true);
      expect(result2.find(n => n.id === '1')).toBeUndefined();
      
      expect(manager.getPendingUpdates()).toHaveLength(2);
    });

    it('should handle destroy during pending updates', async () => {
      const mockUpdateFn = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      
      await manager.markAsReadOptimistic('1', mockNotifications, mockUpdateFn);
      await manager.deleteOptimistic('2', mockNotifications, mockUpdateFn);
      
      expect(manager.hasPendingUpdates()).toBe(true);
      
      manager.destroy();
      
      expect(manager.hasPendingUpdates()).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle mixed successful and failed operations', async () => {
      const successFn = vi.fn().mockResolvedValue(true);
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const updateCallback = vi.fn();
      
      manager.onUpdate(updateCallback);
      
      // Start successful and failing operations
      await manager.markAsReadOptimistic('1', mockNotifications, successFn);
      await manager.deleteOptimistic('2', mockNotifications, failFn);
      
      expect(manager.getPendingUpdates()).toHaveLength(2);
      
      // Wait for operations to complete
      await vi.runAllTimersAsync();
      
      // Successful operation should complete, failed should rollback
      expect(successFn).toHaveBeenCalled();
      expect(failFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(manager.hasPendingUpdates()).toBe(false);
      
      // Should have received rollback for failed operation
      expect(updateCallback).toHaveBeenCalledWith(mockNotifications);
    });
  });
});