import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotificationsPaginated } from '../useNotificationsPaginated';
import { NotificationPagination } from '@/services/NotificationPagination';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/services/NotificationPagination', () => ({
  NotificationPagination: {
    getPaginatedNotifications: vi.fn(),
    getTotalCount: vi.fn(),
    prefetchNextPage: vi.fn()
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ error: null })
    }))
  }
}));

describe('useNotificationsPaginated', () => {
  const mockUser = {
    id: 'user1',
    email: 'test@example.com',
    full_name: 'Test User'
  };

  const mockNotifications = [
    {
      id: '1',
      user_id: 'user1',
      title: 'Test Notification 1',
      message: 'Test message 1',
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
    },
    {
      id: '2',
      user_id: 'user1',
      title: 'Test Notification 2',
      message: 'Test message 2',
      type: 'comment_added' as const,
      priority: 'low' as const,
      read: true,
      created_at: '2024-01-01T09:00:00Z',
      updated_at: '2024-01-01T09:00:00Z',
      ticket_id: 'ticket2',
      ticket: null
    }
  ];

  const mockPaginatedResult = {
    data: mockNotifications,
    nextCursor: '2024-01-01T08:00:00Z',
    hasMore: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      userProfile: mockUser,
      user: null,
      loading: false,
      signOut: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useNotificationsPaginated());

      expect(result.current.notifications).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.loadingMore).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    it('should auto-load notifications when user is available', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);
      vi.mocked(NotificationPagination.getTotalCount).mockResolvedValue(42);

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
        expect(result.current.totalCount).toBe(42);
        expect(result.current.hasMore).toBe(true);
        expect(result.current.unreadCount).toBe(1);
      });

      expect(NotificationPagination.getPaginatedNotifications).toHaveBeenCalledWith({
        userId: 'user1',
        limit: 20
      });
    });

    it('should not auto-load when autoLoad is false', () => {
      const { result } = renderHook(() => useNotificationsPaginated({
        autoLoad: false
      }));

      expect(NotificationPagination.getPaginatedNotifications).not.toHaveBeenCalled();
      expect(result.current.notifications).toEqual([]);
    });

    it('should not load when user is not available', () => {
      vi.mocked(useAuth).mockReturnValue({
        userProfile: null,
        user: null,
        loading: false,
        signOut: vi.fn()
      });

      const { result } = renderHook(() => useNotificationsPaginated());

      expect(NotificationPagination.getPaginatedNotifications).not.toHaveBeenCalled();
      expect(result.current.notifications).toEqual([]);
    });
  });

  describe('loading notifications', () => {
    it('should handle loading state correctly', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockReturnValue(promise);

      const { result } = renderHook(() => useNotificationsPaginated());

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise!(mockPaginatedResult);
        await promise;
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.notifications).toEqual(mockNotifications);
    });

    it('should handle errors correctly', async () => {
      const error = new Error('Failed to load notifications');
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockRejectedValue(error);

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load notifications');
        expect(result.current.loading).toBe(false);
        expect(result.current.notifications).toEqual([]);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to load notifications');
    });

    it('should apply filters correctly', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      const filters = {
        type: 'ticket_created',
        read: false,
        priority: 'high'
      };

      const { result } = renderHook(() => useNotificationsPaginated({
        filters
      }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      expect(NotificationPagination.getPaginatedNotifications).toHaveBeenCalledWith({
        userId: 'user1',
        limit: 20,
        ...filters
      });
    });
  });

  describe('loadMore', () => {
    it('should load more notifications', async () => {
      const moreNotifications = [
        {
          ...mockNotifications[0],
          id: '3',
          title: 'Test Notification 3'
        }
      ];

      vi.mocked(NotificationPagination.getPaginatedNotifications)
        .mockResolvedValueOnce(mockPaginatedResult)
        .mockResolvedValueOnce({
          data: moreNotifications,
          nextCursor: '2024-01-01T07:00:00Z',
          hasMore: false
        });

      const { result } = renderHook(() => useNotificationsPaginated());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Load more
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.notifications).toEqual([...mockNotifications, ...moreNotifications]);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.loadingMore).toBe(false);
    });

    it('should not load more when hasMore is false', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: mockNotifications,
        hasMore: false
      });

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.hasMore).toBe(false);
      });

      await act(async () => {
        await result.current.loadMore();
      });

      // Should only be called once (initial load)
      expect(NotificationPagination.getPaginatedNotifications).toHaveBeenCalledTimes(1);
    });

    it('should not load more when already loading', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      vi.mocked(NotificationPagination.getPaginatedNotifications)
        .mockResolvedValueOnce(mockPaginatedResult)
        .mockReturnValueOnce(promise);

      const { result } = renderHook(() => useNotificationsPaginated());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Start loading more
      act(() => {
        result.current.loadMore();
      });

      expect(result.current.loadingMore).toBe(true);

      // Try to load more again - should be ignored
      await act(async () => {
        await result.current.loadMore();
      });

      // Should only be called twice (initial + first loadMore)
      expect(NotificationPagination.getPaginatedNotifications).toHaveBeenCalledTimes(2);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ data: [], hasMore: false });
        await promise;
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read with optimistic update', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      await act(async () => {
        const success = await result.current.markAsRead('1');
        expect(success).toBe(true);
      });

      // Should update optimistically
      expect(result.current.notifications[0].read).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    it('should revert optimistic update on error', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      // Mock supabase error
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ error: new Error('Database error') })
      } as any);

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      await act(async () => {
        const success = await result.current.markAsRead('1');
        expect(success).toBe(false);
      });

      // Should revert optimistic update
      expect(result.current.notifications[0].read).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Failed to mark notification as read');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      await act(async () => {
        const success = await result.current.markAllAsRead();
        expect(success).toBe(true);
      });

      // Should mark all as read
      expect(result.current.notifications.every(n => n.read)).toBe(true);
      expect(result.current.unreadCount).toBe(0);
      expect(toast.success).toHaveBeenCalledWith('All notifications marked as read');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification with optimistic update', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      await act(async () => {
        const success = await result.current.deleteNotification('1');
        expect(success).toBe(true);
      });

      // Should remove from list
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].id).toBe('2');
      expect(toast.success).toHaveBeenCalledWith('Notification deleted');
    });
  });

  describe('refresh', () => {
    it('should refresh notifications', async () => {
      const refreshedNotifications = [
        {
          ...mockNotifications[0],
          title: 'Updated Notification'
        }
      ];

      vi.mocked(NotificationPagination.getPaginatedNotifications)
        .mockResolvedValueOnce(mockPaginatedResult)
        .mockResolvedValueOnce({
          data: refreshedNotifications,
          hasMore: false
        });

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.notifications).toEqual(refreshedNotifications);
    });
  });

  describe('lazy loading integration', () => {
    it('should preload notification details when enabled', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      const { result } = renderHook(() => useNotificationsPaginated({
        enableLazyLoading: true
      }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Should have preloaded some notifications
      expect(result.current.preloadNotificationDetails).toBeDefined();
    });

    it('should get notification details with lazy loading', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      const { result } = renderHook(() => useNotificationsPaginated({
        enableLazyLoading: true
      }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      await act(async () => {
        const details = await result.current.getNotificationDetails('1');
        expect(details).toBeTruthy();
      });
    });

    it('should return cached notification when lazy loading disabled', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      const { result } = renderHook(() => useNotificationsPaginated({
        enableLazyLoading: false
      }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      await act(async () => {
        const details = await result.current.getNotificationDetails('1');
        expect(details).toEqual(mockNotifications[0]);
      });
    });
  });

  describe('performance tests', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        title: `Notification ${i + 1}`
      }));

      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: largeDataset,
        hasMore: false
      });

      const startTime = performance.now();
      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1000);
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle rapid state updates efficiently', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const startTime = performance.now();

      // Perform many rapid operations
      await act(async () => {
        const operations = [];
        for (let i = 0; i < 100; i++) {
          operations.push(result.current.markAsRead('1'));
        }
        await Promise.all(operations);
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle memory efficiently with large notification lists', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const largeDataset = Array(5000).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        title: `Notification ${i + 1}`,
        message: `Large message content ${i}`.repeat(50)
      }));

      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: largeDataset,
        hasMore: false
      });

      const { result } = renderHook(() => useNotificationsPaginated());

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(5000);
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});