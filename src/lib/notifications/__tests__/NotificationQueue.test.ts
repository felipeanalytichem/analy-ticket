import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationQueue } from '../NotificationQueue';
import { mockSupabaseClient } from './setup';

describe('NotificationQueue', () => {
  let queue: NotificationQueue;

  beforeEach(() => {
    queue = new NotificationQueue();
  });

  afterEach(async () => {
    await queue.cleanup();
    vi.clearAllTimers();
  });

  describe('enqueue', () => {
    it('should add item to queue', async () => {
      const item = {
        operation: 'create' as const,
        data: { message: 'test' },
        retryCount: 0,
        maxRetries: 3
      };

      const itemId = await queue.enqueue(item);

      expect(itemId).toMatch(/^queue_\d+_[a-z0-9]+$/);
      expect(queue.size()).toBe(1);
    });

    it('should remove oldest item when queue is full', async () => {
      // Mock the MAX_QUEUE_SIZE to a smaller value for testing
      const originalSize = (queue as any).MAX_QUEUE_SIZE;
      (queue as any).MAX_QUEUE_SIZE = 2;

      const item1 = {
        operation: 'create' as const,
        data: { message: 'test1' },
        retryCount: 0,
        maxRetries: 3
      };

      const item2 = {
        operation: 'create' as const,
        data: { message: 'test2' },
        retryCount: 0,
        maxRetries: 3
      };

      const item3 = {
        operation: 'create' as const,
        data: { message: 'test3' },
        retryCount: 0,
        maxRetries: 3
      };

      await queue.enqueue(item1);
      await queue.enqueue(item2);
      await queue.enqueue(item3); // Should remove oldest

      expect(queue.size()).toBe(2);

      // Restore original size
      (queue as any).MAX_QUEUE_SIZE = originalSize;
    });
  });

  describe('dequeue', () => {
    it('should remove item from queue', async () => {
      const item = {
        operation: 'create' as const,
        data: { message: 'test' },
        retryCount: 0,
        maxRetries: 3
      };

      const itemId = await queue.enqueue(item);
      const removed = queue.dequeue(itemId);

      expect(removed).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should return false for non-existent item', () => {
      const removed = queue.dequeue('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('size', () => {
    it('should return correct queue size', async () => {
      expect(queue.size()).toBe(0);

      await queue.enqueue({
        operation: 'create' as const,
        data: { message: 'test1' },
        retryCount: 0,
        maxRetries: 3
      });

      expect(queue.size()).toBe(1);

      await queue.enqueue({
        operation: 'update' as const,
        data: { message: 'test2' },
        retryCount: 0,
        maxRetries: 3
      });

      expect(queue.size()).toBe(2);
    });
  });

  describe('getItems', () => {
    it('should return all queue items', async () => {
      const item1 = {
        operation: 'create' as const,
        data: { message: 'test1' },
        retryCount: 0,
        maxRetries: 3
      };

      const item2 = {
        operation: 'update' as const,
        data: { message: 'test2' },
        retryCount: 1,
        maxRetries: 3
      };

      await queue.enqueue(item1);
      await queue.enqueue(item2);

      const items = queue.getItems();

      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        operation: 'create',
        data: { message: 'test1' },
        retryCount: 0,
        maxRetries: 3
      });
      expect(items[1]).toMatchObject({
        operation: 'update',
        data: { message: 'test2' },
        retryCount: 1,
        maxRetries: 3
      });
    });
  });

  describe('clear', () => {
    it('should clear all items', async () => {
      await queue.enqueue({
        operation: 'create' as const,
        data: { message: 'test1' },
        retryCount: 0,
        maxRetries: 3
      });

      await queue.enqueue({
        operation: 'update' as const,
        data: { message: 'test2' },
        retryCount: 0,
        maxRetries: 3
      });

      expect(queue.size()).toBe(2);

      queue.clear();

      expect(queue.size()).toBe(0);
    });
  });

  describe('processing', () => {
    it('should process create operations', async () => {
      mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const item = {
        operation: 'create' as const,
        data: {
          user_id: 'test-user',
          message: 'test message',
          type: 'ticket_created',
          title: 'Test Title'
        },
        retryCount: 0,
        maxRetries: 3
      };

      await queue.enqueue(item);

      // Trigger processing
      vi.advanceTimersByTime(30000);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([item.data]);
      expect(queue.size()).toBe(0); // Item should be removed after successful processing
    });

    it('should process update operations', async () => {
      mockSupabaseClient.from().update().eq().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const item = {
        operation: 'update' as const,
        data: {
          id: 'test-id',
          read: true,
          updated_at: new Date().toISOString()
        },
        retryCount: 0,
        maxRetries: 3
      };

      await queue.enqueue(item);

      // Trigger processing
      vi.advanceTimersByTime(30000);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        read: true,
        updated_at: item.data.updated_at
      });
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('id', 'test-id');
    });

    it('should process delete operations', async () => {
      mockSupabaseClient.from().delete().eq().then = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const item = {
        operation: 'delete' as const,
        data: {
          id: 'test-id'
        },
        retryCount: 0,
        maxRetries: 3
      };

      await queue.enqueue(item);

      // Trigger processing
      vi.advanceTimersByTime(30000);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('id', 'test-id');
    });

    it('should retry failed operations', async () => {
      mockSupabaseClient.from().insert().then = vi.fn()
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' }
        })
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const item = {
        operation: 'create' as const,
        data: { message: 'test' },
        retryCount: 0,
        maxRetries: 3
      };

      await queue.enqueue(item);

      // First processing attempt (should fail)
      vi.advanceTimersByTime(30000);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(queue.size()).toBe(1); // Item should still be in queue

      // Second processing attempt (should succeed)
      vi.advanceTimersByTime(30000);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(queue.size()).toBe(0); // Item should be removed after success
    });

    it('should remove items that exceed max retries', async () => {
      mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Persistent error' }
      });

      const item = {
        operation: 'create' as const,
        data: { message: 'test' },
        retryCount: 0,
        maxRetries: 2
      };

      await queue.enqueue(item);

      // Process multiple times to exceed max retries
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(30000);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      expect(queue.size()).toBe(0); // Item should be removed after exceeding max retries
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const item1 = {
        operation: 'create' as const,
        data: { message: 'test1' },
        retryCount: 0,
        maxRetries: 3
      };

      const item2 = {
        operation: 'update' as const,
        data: { message: 'test2' },
        retryCount: 1,
        maxRetries: 3
      };

      await queue.enqueue(item1);
      await queue.enqueue(item2);

      const stats = queue.getStats();

      expect(stats).toMatchObject({
        size: 2,
        maxSize: 1000,
        processing: false,
        oldestItem: expect.any(Date),
        newestItem: expect.any(Date)
      });
    });

    it('should handle empty queue stats', () => {
      const stats = queue.getStats();

      expect(stats).toMatchObject({
        size: 0,
        maxSize: 1000,
        processing: false,
        oldestItem: undefined,
        newestItem: undefined
      });
    });
  });

  describe('stopProcessing', () => {
    it('should stop processing timer', () => {
      queue.stopProcessing();

      // Add item and advance time - should not be processed
      queue.enqueue({
        operation: 'create' as const,
        data: { message: 'test' },
        retryCount: 0,
        maxRetries: 3
      });

      vi.advanceTimersByTime(30000);

      expect(queue.size()).toBe(1); // Item should still be in queue
    });
  });
});