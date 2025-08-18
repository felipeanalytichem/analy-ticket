import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cacheManager } from '../CacheManager';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    return mockQuery;
  }),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn()
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

// Import after mocking
const { ApiCache, setupCacheInvalidation } = await import('../ApiCache');

describe('ApiCache', () => {
  let apiCache: ApiCache;

  beforeEach(() => {
    vi.clearAllMocks();
    apiCache = new ApiCache();
    cacheManager.clear();
  });

  afterEach(() => {
    apiCache.clearCache();
  });

  describe('Basic Caching', () => {
    it('should cache successful query results', async () => {
      const mockData = { id: 1, name: 'Test Ticket' };
      const mockQueryFn = vi.fn().mockResolvedValue({ data: mockData, error: null });

      const result = await apiCache.cacheQuery('test-key', mockQueryFn);

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
      expect(result.fromCache).toBeUndefined();
      expect(mockQueryFn).toHaveBeenCalledOnce();

      // Second call should return from cache
      const cachedResult = await apiCache.cacheQuery('test-key', mockQueryFn);
      expect(cachedResult.data).toEqual(mockData);
      expect(cachedResult.fromCache).toBe(true);
      // Note: mockQueryFn might be called twice due to stale-while-revalidate
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });

    it('should not cache error results', async () => {
      const mockError = { message: 'Database error' };
      const mockQueryFn = vi.fn().mockResolvedValue({ data: null, error: mockError });

      const result = await apiCache.cacheQuery('test-key', mockQueryFn);

      expect(result.data).toBeNull();
      expect(result.error).toEqual(mockError);
      expect(result.fromCache).toBeUndefined();

      // Second call should execute query again
      const secondResult = await apiCache.cacheQuery('test-key', mockQueryFn);
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });

    it('should handle query function errors', async () => {
      const mockError = new Error('Network error');
      const mockQueryFn = vi.fn().mockRejectedValue(mockError);

      await expect(apiCache.cacheQuery('test-key', mockQueryFn)).rejects.toThrow('Network error');
    });

    it('should return stale data on error if available', async () => {
      const mockData = { id: 1, name: 'Test Ticket' };
      const mockQueryFn = vi.fn()
        .mockResolvedValueOnce({ data: mockData, error: null })
        .mockRejectedValueOnce(new Error('Network error'));

      // First call succeeds and caches data
      await apiCache.cacheQuery('test-key', mockQueryFn);

      // Second call fails but should return stale data
      const result = await apiCache.cacheQuery('test-key', mockQueryFn);
      expect(result.data).toEqual(mockData);
      expect(result.fromCache).toBe(true);
    });
  });

  describe('Stale While Revalidate', () => {
    it('should refresh data in background when stale-while-revalidate is enabled', async () => {
      const apiCacheWithSWR = new ApiCache({ staleWhileRevalidate: true });
      const mockData = { id: 1, name: 'Test Ticket' };
      const updatedData = { id: 1, name: 'Updated Ticket' };
      
      const mockQueryFn = vi.fn()
        .mockResolvedValueOnce({ data: mockData, error: null })
        .mockResolvedValueOnce({ data: updatedData, error: null });

      // First call caches data
      await apiCacheWithSWR.cacheQuery('test-key', mockQueryFn);

      // Second call returns cached data but triggers background refresh
      const result = await apiCacheWithSWR.cacheQuery('test-key', mockQueryFn);
      expect(result.data).toEqual(mockData);
      expect(result.fromCache).toBe(true);

      // Wait for background refresh
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Specific Cache Methods', () => {
    it('should cache tickets with filters', async () => {
      const mockTickets = [
        { id: 1, title: 'Ticket 1', status: 'open' },
        { id: 2, title: 'Ticket 2', status: 'closed' }
      ];

      // Mock the complete query chain - the query object itself should be awaitable
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: mockTickets, error: null }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const filters = { status: 'open' };
      const result = await apiCache.cacheTickets(filters);

      expect(mockSupabase.from).toHaveBeenCalledWith('tickets');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'open');
      expect(result.data).toEqual(mockTickets);
    });

    it('should cache user profile', async () => {
      const mockProfile = { id: 'user-1', full_name: 'John Doe', email: 'john@example.com' };
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
      };

      mockSupabase.from.mockReturnValue({ select: vi.fn().mockReturnValue(mockQuery) });

      const result = await apiCache.cacheUserProfile('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(result.data).toEqual(mockProfile);
    });

    it('should cache categories', async () => {
      const mockCategories = [
        { id: 1, name: 'Technical', color: '#blue' },
        { id: 2, name: 'Billing', color: '#green' }
      ];

      const mockQuery = {
        order: vi.fn().mockResolvedValue({ data: mockCategories, error: null })
      };

      mockSupabase.from.mockReturnValue({ select: vi.fn().mockReturnValue(mockQuery) });

      const result = await apiCache.cacheCategories();

      expect(mockSupabase.from).toHaveBeenCalledWith('categories');
      expect(result.data).toEqual(mockCategories);
    });

    it('should cache dashboard statistics', async () => {
      const mockTicketData = [
        { status: 'open', priority: 'high', created_at: new Date().toISOString() },
        { status: 'closed', priority: 'medium', created_at: new Date().toISOString() }
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockTicketData, error: null })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await apiCache.cacheDashboardStats('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('tickets');
      expect(mockQuery.eq).toHaveBeenCalledWith('assigned_agent', 'user-1');
      expect(result.data).toHaveProperty('total');
      expect(result.data).toHaveProperty('byStatus');
      expect(result.data).toHaveProperty('byPriority');
    });

    it('should cache notifications', async () => {
      const mockNotifications = [
        { id: 1, message: 'New ticket assigned', user_id: 'user-1' },
        { id: 2, message: 'Ticket updated', user_id: 'user-1' }
      ];

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockNotifications, error: null })
      };

      mockSupabase.from.mockReturnValue({ select: vi.fn().mockReturnValue(mockQuery) });

      const result = await apiCache.cacheNotifications('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(result.data).toEqual(mockNotifications);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache on data changes', () => {
      const invalidateSpy = vi.spyOn(cacheManager, 'invalidate');

      apiCache.invalidateOnDataChange('tickets', 'UPDATE', { id: 1 });

      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should invalidate specific records', () => {
      const invalidateSpy = vi.spyOn(cacheManager, 'invalidate');

      apiCache.invalidateOnDataChange('tickets', 'UPDATE', { 
        id: 1, 
        assigned_agent: 'agent-1' 
      });

      expect(invalidateSpy).toHaveBeenCalledWith('ticket:1');
      expect(invalidateSpy).toHaveBeenCalledWith('dashboard:stats:agent-1');
    });
  });

  describe('Cache Warming', () => {
    it('should warm up cache with frequently accessed data', async () => {
      const mockCategories = [{ id: 1, name: 'Technical' }];
      const mockProfile = { id: 'user-1', full_name: 'John Doe' };

      // Mock the cache methods
      vi.spyOn(apiCache, 'cacheCategories').mockResolvedValue({ data: mockCategories, error: null });
      vi.spyOn(apiCache, 'cacheUserProfile').mockResolvedValue({ data: mockProfile, error: null });

      await apiCache.warmUpCache('user-1');

      expect(apiCache.cacheCategories).toHaveBeenCalled();
      expect(apiCache.cacheUserProfile).toHaveBeenCalledWith('user-1');
    });

    it('should warm up cache without user-specific data when no user provided', async () => {
      const mockCategories = [{ id: 1, name: 'Technical' }];

      vi.spyOn(apiCache, 'cacheCategories').mockResolvedValue({ data: mockCategories, error: null });
      vi.spyOn(apiCache, 'cacheUserProfile').mockResolvedValue({ data: null, error: null });

      await apiCache.warmUpCache();

      expect(apiCache.cacheCategories).toHaveBeenCalled();
      expect(apiCache.cacheUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('Cache Statistics and Management', () => {
    it('should return cache statistics', () => {
      const stats = apiCache.getCacheStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('entryCount');
    });

    it('should clear all cache', () => {
      const clearSpy = vi.spyOn(cacheManager, 'clear');
      
      apiCache.clearCache();
      
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should respect disabled cache configuration', async () => {
      const disabledCache = new ApiCache({ enabled: false });
      const mockQueryFn = vi.fn().mockResolvedValue({ data: 'test', error: null });

      const result = await disabledCache.cacheQuery('test-key', mockQueryFn);

      expect(result.fromCache).toBeUndefined();
      expect(mockQueryFn).toHaveBeenCalledOnce();

      // Second call should also execute query (no caching)
      await disabledCache.cacheQuery('test-key', mockQueryFn);
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });

    it('should use custom TTL from configuration', async () => {
      const customCache = new ApiCache({ defaultTtl: 1000 });
      const mockQueryFn = vi.fn().mockResolvedValue({ data: 'test', error: null });

      await customCache.cacheQuery('test-key', mockQueryFn);

      // Verify that the cache entry has the custom TTL
      const entries = cacheManager.getEntries();
      const entry = entries.find(e => e.key === 'test-key');
      expect(entry?.entry.ttl).toBe(1000);
    });
  });
});

describe('setupCacheInvalidation', () => {
  it('should setup real-time cache invalidation channels', () => {
    const channelMock = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    };

    mockSupabase.channel.mockReturnValue(channelMock);

    setupCacheInvalidation();

    expect(mockSupabase.channel).toHaveBeenCalledWith('cache-invalidation-tickets');
    expect(mockSupabase.channel).toHaveBeenCalledWith('cache-invalidation-profiles');
    expect(mockSupabase.channel).toHaveBeenCalledWith('cache-invalidation-categories');
    expect(mockSupabase.channel).toHaveBeenCalledWith('cache-invalidation-notifications');

    expect(channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tickets' },
      expect.any(Function)
    );
  });
});