import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotificationLazyLoading } from '../useNotificationLazyLoading';
import { NotificationPagination } from '@/services/NotificationPagination';

// Mock NotificationPagination
vi.mock('@/services/NotificationPagination', () => ({
  NotificationPagination: {
    loadNotificationDetails: vi.fn()
  }
}));

describe('useNotificationLazyLoading', () => {
  const mockNotification = {
    id: '1',
    user_id: 'user1',
    title: 'Test Notification',
    message: 'Test message',
    type: 'ticket_created' as const,
    priority: 'medium' as const,
    read: false,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
    ticket_id: 'ticket1',
    ticket: {
      id: 'ticket1',
      title: 'Test Ticket',
      ticket_number: 'T-001',
      status: 'open',
      priority: 'medium'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('loadNotificationDetails', () => {
    it('should load notification details successfully', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading());

      let loadedNotification: any;
      await act(async () => {
        loadedNotification = await result.current.loadNotificationDetails('1');
      });

      expect(loadedNotification).toEqual(mockNotification);
      expect(result.current.getCachedNotificationDetails('1').data).toEqual(mockNotification);
      expect(result.current.isLoading('1')).toBe(false);
      expect(result.current.hasError('1')).toBe(false);
    });

    it('should handle loading state correctly', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      vi.mocked(NotificationPagination.loadNotificationDetails).mockReturnValue(promise);

      const { result } = renderHook(() => useNotificationLazyLoading());

      // Start loading
      act(() => {
        result.current.loadNotificationDetails('1');
      });

      expect(result.current.isLoading('1')).toBe(true);
      expect(result.current.getCachedNotificationDetails('1').loading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!(mockNotification);
        await promise;
      });

      expect(result.current.isLoading('1')).toBe(false);
      expect(result.current.getCachedNotificationDetails('1').loading).toBe(false);
    });

    it('should handle errors correctly', async () => {
      const error = new Error('Failed to load');
      vi.mocked(NotificationPagination.loadNotificationDetails).mockRejectedValue(error);

      const { result } = renderHook(() => useNotificationLazyLoading());

      await act(async () => {
        const loadedNotification = await result.current.loadNotificationDetails('1');
        expect(loadedNotification).toBeNull();
      });

      expect(result.current.hasError('1')).toBe(true);
      expect(result.current.getError('1')).toBe('Failed to load');
      expect(result.current.isLoading('1')).toBe(false);
    });

    it('should return cached data when available and not expired', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading({
        cacheTimeout: 5 * 60 * 1000 // 5 minutes
      }));

      // First load
      await act(async () => {
        await result.current.loadNotificationDetails('1');
      });

      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledTimes(1);

      // Second load should use cache
      await act(async () => {
        const cachedNotification = await result.current.loadNotificationDetails('1');
        expect(cachedNotification).toEqual(mockNotification);
      });

      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledTimes(1);
    });

    it('should reload when cache is expired', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading({
        cacheTimeout: 1000 // 1 second
      }));

      // First load
      await act(async () => {
        await result.current.loadNotificationDetails('1');
      });

      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledTimes(1);

      // Advance time to expire cache
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Second load should reload
      await act(async () => {
        await result.current.loadNotificationDetails('1');
      });

      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledTimes(2);
    });

    it('should prevent duplicate loading requests', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      vi.mocked(NotificationPagination.loadNotificationDetails).mockReturnValue(promise);

      const { result } = renderHook(() => useNotificationLazyLoading());

      // Start multiple loads simultaneously
      const promises = [
        result.current.loadNotificationDetails('1'),
        result.current.loadNotificationDetails('1'),
        result.current.loadNotificationDetails('1')
      ];

      // Resolve the promise
      await act(async () => {
        resolvePromise!(mockNotification);
        await Promise.all(promises);
      });

      // Should only call the API once
      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledTimes(1);
    });
  });

  describe('preloadNotificationDetails', () => {
    it('should preload notification details silently', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading());

      act(() => {
        result.current.preloadNotificationDetails('1');
      });

      // Wait for preload to complete
      await waitFor(() => {
        expect(result.current.getCachedNotificationDetails('1').data).toEqual(mockNotification);
      });

      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledWith('1');
    });

    it('should not preload if already cached', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading());

      // First load
      await act(async () => {
        await result.current.loadNotificationDetails('1');
      });

      // Preload should not make another request
      act(() => {
        result.current.preloadNotificationDetails('1');
      });

      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledTimes(1);
    });

    it('should handle preload errors silently', async () => {
      const error = new Error('Preload failed');
      vi.mocked(NotificationPagination.loadNotificationDetails).mockRejectedValue(error);

      const { result } = renderHook(() => useNotificationLazyLoading());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.preloadNotificationDetails('1');
        });
      }).not.toThrow();
    });
  });

  describe('batchPreloadNotifications', () => {
    it('should preload multiple notifications with delays', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading());

      act(() => {
        result.current.batchPreloadNotifications(['1', '2', '3']);
      });

      // Advance timers to trigger delayed preloads
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledTimes(3);
      });

      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledWith('1');
      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledWith('2');
      expect(NotificationPagination.loadNotificationDetails).toHaveBeenCalledWith('3');
    });
  });

  describe('cache management', () => {
    it('should clear specific cache entry', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading());

      // Load notification
      await act(async () => {
        await result.current.loadNotificationDetails('1');
      });

      expect(result.current.getCachedNotificationDetails('1').data).toEqual(mockNotification);

      // Clear cache
      act(() => {
        result.current.clearCache('1');
      });

      expect(result.current.getCachedNotificationDetails('1').data).toBeNull();
    });

    it('should clear all cache', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading());

      // Load multiple notifications
      await act(async () => {
        await result.current.loadNotificationDetails('1');
        await result.current.loadNotificationDetails('2');
      });

      expect(result.current.getCachedNotificationDetails('1').data).toEqual(mockNotification);
      expect(result.current.getCachedNotificationDetails('2').data).toEqual(mockNotification);

      // Clear all cache
      act(() => {
        result.current.clearAllCache();
      });

      expect(result.current.getCachedNotificationDetails('1').data).toBeNull();
      expect(result.current.getCachedNotificationDetails('2').data).toBeNull();
    });

    it('should cleanup expired cache entries', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading({
        cacheTimeout: 1000 // 1 second
      }));

      // Load notification
      await act(async () => {
        await result.current.loadNotificationDetails('1');
      });

      expect(result.current.getCachedNotificationDetails('1').data).toEqual(mockNotification);

      // Advance time to expire cache
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Cleanup cache
      act(() => {
        result.current.cleanupCache();
      });

      expect(result.current.getCachedNotificationDetails('1').data).toBeNull();
    });

    it('should respect max cache size', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading({
        maxCacheSize: 2
      }));

      // Load 3 notifications
      await act(async () => {
        await result.current.loadNotificationDetails('1');
        await result.current.loadNotificationDetails('2');
        await result.current.loadNotificationDetails('3');
      });

      // Cleanup should remove oldest entry
      act(() => {
        result.current.cleanupCache();
      });

      const stats = result.current.getCacheStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(2);
    });
  });

  describe('cache statistics', () => {
    it('should provide accurate cache statistics', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails)
        .mockResolvedValueOnce(mockNotification)
        .mockRejectedValueOnce(new Error('Failed'));

      const { result } = renderHook(() => useNotificationLazyLoading());

      // Load one successful, one failed
      await act(async () => {
        await result.current.loadNotificationDetails('1');
        await result.current.loadNotificationDetails('2');
      });

      const stats = result.current.getCacheStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.cachedEntries).toBe(1);
      expect(stats.errorEntries).toBe(1);
      expect(stats.loadingEntries).toBe(0);
    });
  });

  describe('performance tests', () => {
    it('should handle large cache sizes efficiently', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading({
        maxCacheSize: 1000
      }));

      const startTime = performance.now();

      // Load many notifications
      await act(async () => {
        const promises = Array(100).fill(null).map((_, i) =>
          result.current.loadNotificationDetails(`${i + 1}`)
        );
        await Promise.all(promises);
      });

      const endTime = performance.now();
      const stats = result.current.getCacheStats();

      expect(stats.totalEntries).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent cache operations efficiently', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading());

      const startTime = performance.now();

      // Perform many concurrent operations
      await act(async () => {
        const operations = [];
        
        // Load notifications
        for (let i = 0; i < 50; i++) {
          operations.push(result.current.loadNotificationDetails(`${i + 1}`));
        }
        
        // Preload notifications
        for (let i = 50; i < 100; i++) {
          result.current.preloadNotificationDetails(`${i + 1}`);
        }
        
        await Promise.all(operations);
      });

      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should cleanup cache efficiently', async () => {
      vi.mocked(NotificationPagination.loadNotificationDetails).mockResolvedValue(mockNotification);

      const { result } = renderHook(() => useNotificationLazyLoading({
        cacheTimeout: 100,
        maxCacheSize: 50
      }));

      // Load many notifications
      await act(async () => {
        const promises = Array(100).fill(null).map((_, i) =>
          result.current.loadNotificationDetails(`${i + 1}`)
        );
        await Promise.all(promises);
      });

      // Advance time to expire some entries
      act(() => {
        vi.advanceTimersByTime(150);
      });

      const startTime = performance.now();
      
      // Cleanup should be fast
      act(() => {
        result.current.cleanupCache();
      });
      
      const endTime = performance.now();
      const stats = result.current.getCacheStats();

      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
      expect(stats.totalEntries).toBeLessThanOrEqual(50);
    });
  });
});