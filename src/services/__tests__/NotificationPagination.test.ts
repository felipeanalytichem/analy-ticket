import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationPagination } from '../NotificationPagination';

// Mock Supabase
const mockSupabase = {
  from: vi.fn()
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('NotificationPagination', () => {
  const mockNotifications = [
    {
      id: '1',
      user_id: 'user1',
      title: 'Test Notification 1',
      message: 'Test message 1',
      type: 'ticket_created',
      priority: 'medium',
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
      type: 'comment_added',
      priority: 'low',
      read: true,
      created_at: '2024-01-01T09:00:00Z',
      updated_at: '2024-01-01T09:00:00Z',
      ticket_id: 'ticket2',
      ticket: null
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPaginatedNotifications', () => {
    it('should return paginated notifications with default options', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis()
      };

      // Mock the promise resolution
      const mockPromise = Promise.resolve({ data: mockNotifications, error: null });
      Object.assign(mockQuery, mockPromise);

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await NotificationPagination.getPaginatedNotifications({
        userId: 'user1'
      });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('ticket:tickets_new'));
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user1');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQuery.limit).toHaveBeenCalledWith(21); // limit + 1
    });

    it('should handle cursor-based pagination', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: [mockNotifications[1]], error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await NotificationPagination.getPaginatedNotifications({
        userId: 'user1',
        cursor: '2024-01-01T10:00:00Z',
        direction: 'forward'
      });

      expect(mockQuery.lt).toHaveBeenCalledWith('created_at', '2024-01-01T10:00:00Z');
      expect(result.data).toHaveLength(1);
    });

    it('should apply filters correctly', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: [], error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      await NotificationPagination.getPaginatedNotifications({
        userId: 'user1',
        type: 'ticket_created',
        read: false,
        priority: 'high',
        ticketId: 'ticket1',
        search: 'test'
      });

      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user1');
      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'ticket_created');
      expect(mockQuery.eq).toHaveBeenCalledWith('read', false);
      expect(mockQuery.eq).toHaveBeenCalledWith('priority', 'high');
      expect(mockQuery.eq).toHaveBeenCalledWith('ticket_id', 'ticket1');
      expect(mockQuery.or).toHaveBeenCalledWith('title.ilike.%test%,message.ilike.%test%');
    });

    it('should detect when there are more results', async () => {
      const moreNotifications = Array(21).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        created_at: `2024-01-01T${10 + i}:00:00Z`
      }));

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: moreNotifications, error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await NotificationPagination.getPaginatedNotifications({
        userId: 'user1',
        limit: 20
      });

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe(moreNotifications[19].created_at);
    });

    it('should handle errors gracefully', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      await expect(NotificationPagination.getPaginatedNotifications({
        userId: 'user1'
      })).rejects.toThrow('Database error');
    });

    it('should respect maximum limit', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: [], error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      await NotificationPagination.getPaginatedNotifications({
        userId: 'user1',
        limit: 200 // Exceeds MAX_LIMIT of 100
      });

      expect(mockQuery.limit).toHaveBeenCalledWith(101); // MAX_LIMIT + 1
    });
  });

  describe('getTotalCount', () => {
    it('should return total count for user', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ count: 42, error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const count = await NotificationPagination.getTotalCount('user1');

      expect(count).toBe(42);
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user1');
    });

    it('should apply filters to count query', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ count: 10, error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const count = await NotificationPagination.getTotalCount('user1', {
        type: 'ticket_created',
        read: false,
        search: 'test'
      });

      expect(count).toBe(10);
      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'ticket_created');
      expect(mockQuery.eq).toHaveBeenCalledWith('read', false);
      expect(mockQuery.or).toHaveBeenCalledWith('title.ilike.%test%,message.ilike.%test%');
    });

    it('should handle errors and return 0', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const count = await NotificationPagination.getTotalCount('user1');

      expect(count).toBe(0);
    });
  });

  describe('loadNotificationDetails', () => {
    it('should load detailed notification data', async () => {
      const detailedNotification = {
        ...mockNotifications[0],
        ticket: {
          ...mockNotifications[0].ticket,
          description: 'Detailed description',
          user: { id: 'user1', full_name: 'John Doe', email: 'john@example.com' },
          assigned_user: { id: 'agent1', full_name: 'Agent Smith', email: 'agent@example.com' },
          category: { id: 'cat1', name: 'Technical' }
        }
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: detailedNotification, error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await NotificationPagination.loadNotificationDetails('1');

      expect(result).toBeTruthy();
      expect(result?.id).toBe('1');
      expect(result?.ticket).toBeTruthy();
      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('user:users'));
      expect(mockQuery.eq).toHaveBeenCalledWith('id', '1');
      expect(mockQuery.single).toHaveBeenCalled();
    });

    it('should return null for non-existent notification', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: null, error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await NotificationPagination.loadNotificationDetails('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        then: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await NotificationPagination.loadNotificationDetails('1');

      expect(result).toBeNull();
    });
  });

  describe('prefetchNextPage', () => {
    it('should prefetch next page silently', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: [], error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      // Should not throw even if it fails
      await expect(NotificationPagination.prefetchNextPage(
        { userId: 'user1' },
        '2024-01-01T10:00:00Z'
      )).resolves.toBeUndefined();

      expect(mockQuery.lt).toHaveBeenCalledWith('created_at', '2024-01-01T10:00:00Z');
    });

    it('should not prefetch without cursor', async () => {
      const spy = vi.spyOn(supabase, 'from');

      await NotificationPagination.prefetchNextPage({ userId: 'user1' });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getNotificationContext', () => {
    it('should get notifications around target notification', async () => {
      const targetNotification = { created_at: '2024-01-01T12:00:00Z' };
      const contextNotifications = [mockNotifications[0], mockNotifications[1]];

      const mockTargetQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: targetNotification, error: null })
      };

      const mockContextQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: contextNotifications, error: null })
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockTargetQuery as any)
        .mockReturnValueOnce(mockContextQuery as any);

      const result = await NotificationPagination.getNotificationContext('1', 'user1', 5);

      expect(result).toHaveLength(2);
      expect(mockTargetQuery.eq).toHaveBeenCalledWith('id', '1');
      expect(mockContextQuery.eq).toHaveBeenCalledWith('user_id', 'user1');
      expect(mockContextQuery.gte).toHaveBeenCalled();
      expect(mockContextQuery.lte).toHaveBeenCalled();
      expect(mockContextQuery.limit).toHaveBeenCalledWith(11); // contextSize * 2 + 1
    });

    it('should return empty array if target notification not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: null, error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await NotificationPagination.getNotificationContext('nonexistent', 'user1');

      expect(result).toEqual([]);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        created_at: `2024-01-01T${String(i).padStart(2, '0')}:00:00Z`
      }));

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: largeDataset.slice(0, 101), error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const startTime = performance.now();
      const result = await NotificationPagination.getPaginatedNotifications({
        userId: 'user1',
        limit: 100
      });
      const endTime = performance.now();

      expect(result.data).toHaveLength(100);
      expect(result.hasMore).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle concurrent requests efficiently', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: mockNotifications, error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const startTime = performance.now();
      const promises = Array(10).fill(null).map((_, i) =>
        NotificationPagination.getPaginatedNotifications({
          userId: `user${i + 1}`,
          limit: 20
        })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.data).toHaveLength(2);
      });
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle memory efficiently with large result sets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate processing large amounts of data
      const largeDataset = Array(10000).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        message: `Test message ${i}`.repeat(100), // Make each item larger
        created_at: `2024-01-01T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`
      }));

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: largeDataset.slice(0, 100), error: null })
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await NotificationPagination.getPaginatedNotifications({
        userId: 'user1',
        limit: 100
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(result.data).toHaveLength(100);
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});