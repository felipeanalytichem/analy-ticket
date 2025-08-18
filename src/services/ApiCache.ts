import { cacheManager, CacheOptions, CacheInvalidation } from './CacheManager';
import { supabase } from '@/lib/supabase';

export interface ApiCacheConfig {
  enabled: boolean;
  defaultTtl: number;
  maxRetries: number;
  staleWhileRevalidate: boolean;
}

export class ApiCache {
  private config: ApiCacheConfig = {
    enabled: true,
    defaultTtl: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3,
    staleWhileRevalidate: true
  };

  constructor(config?: Partial<ApiCacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Cache a Supabase query result
   */
  async cacheQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<{ data: T | null; error: any }>,
    options: CacheOptions = {}
  ): Promise<{ data: T | null; error: any; fromCache?: boolean }> {
    if (!this.config.enabled) {
      return await queryFn();
    }

    const finalOptions = {
      ttl: this.config.defaultTtl,
      ...options
    };

    try {
      // Try to get from cache first
      const cached = cacheManager.get<{ data: T | null; error: any }>(cacheKey);
      
      if (cached && !cached.error) {
        // If stale-while-revalidate is enabled, refresh in background
        if (this.config.staleWhileRevalidate) {
          this.refreshInBackground(cacheKey, queryFn, finalOptions);
        }
        
        return { ...cached, fromCache: true };
      }

      // Execute query and cache result
      const result = await queryFn();
      
      // Only cache successful results
      if (!result.error) {
        cacheManager.set(cacheKey, result, finalOptions);
      }
      
      return result;
    } catch (error) {
      console.error(`API cache error for key ${cacheKey}:`, error);
      
      // Try to return stale data if available
      const stale = cacheManager.get<{ data: T | null; error: any }>(cacheKey);
      if (stale) {
        return { ...stale, fromCache: true };
      }
      
      throw error;
    }
  }

  /**
   * Cache tickets data with automatic invalidation
   */
  async cacheTickets(
    filters: Record<string, any> = {},
    options: CacheOptions = {}
  ) {
    const cacheKey = `tickets:${JSON.stringify(filters)}`;
    const tags = [CacheInvalidation.Tags.TICKETS];
    
    return this.cacheQuery(
      cacheKey,
      async () => {
        const query = supabase
          .from('tickets')
          .select(`
            *,
            category:categories(name, color),
            assigned_agent:profiles!tickets_assigned_agent_fkey(full_name, email),
            created_by_user:profiles!tickets_created_by_fkey(full_name, email)
          `);

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query.eq(key, value);
          }
        });

        return await query;
      },
      { ...options, tags }
    );
  }

  /**
   * Cache user profile data
   */
  async cacheUserProfile(userId: string, options: CacheOptions = {}) {
    const cacheKey = `profile:${userId}`;
    const tags = [CacheInvalidation.Tags.USERS, CacheInvalidation.Tags.USER_PROFILE];
    
    return this.cacheQuery(
      cacheKey,
      async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
      },
      { ...options, tags }
    );
  }

  /**
   * Cache categories data
   */
  async cacheCategories(options: CacheOptions = {}) {
    const cacheKey = 'categories:all';
    const tags = [CacheInvalidation.Tags.CATEGORIES];
    
    return this.cacheQuery(
      cacheKey,
      async () => {
        return await supabase
          .from('categories')
          .select('*')
          .order('name');
      },
      { ...options, tags }
    );
  }

  /**
   * Cache dashboard statistics
   */
  async cacheDashboardStats(userId?: string, options: CacheOptions = {}) {
    const cacheKey = userId ? `dashboard:stats:${userId}` : 'dashboard:stats:global';
    const tags = [CacheInvalidation.Tags.DASHBOARD, CacheInvalidation.Tags.TICKETS];
    
    return this.cacheQuery(
      cacheKey,
      async () => {
        let query = supabase
          .from('tickets')
          .select('status, priority, created_at');
        
        if (userId) {
          query = query.eq('assigned_agent', userId);
        }
        
        const result = await query;
        
        if (result.data) {
          // Process statistics
          const stats = this.processTicketStats(result.data);
          return { data: stats, error: null };
        }
        
        return result;
      },
      { ...options, tags, ttl: 2 * 60 * 1000 } // Shorter TTL for stats
    );
  }

  /**
   * Cache notifications for a user
   */
  async cacheNotifications(userId: string, options: CacheOptions = {}) {
    const cacheKey = `notifications:${userId}`;
    const tags = [CacheInvalidation.Tags.NOTIFICATIONS];
    
    return this.cacheQuery(
      cacheKey,
      async () => {
        return await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
      },
      { ...options, tags }
    );
  }

  /**
   * Invalidate cache when data changes
   */
  invalidateOnDataChange(table: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', record?: any): void {
    const tagMap: Record<string, string[]> = {
      tickets: [CacheInvalidation.Tags.TICKETS, CacheInvalidation.Tags.DASHBOARD],
      profiles: [CacheInvalidation.Tags.USERS, CacheInvalidation.Tags.USER_PROFILE],
      categories: [CacheInvalidation.Tags.CATEGORIES],
      notifications: [CacheInvalidation.Tags.NOTIFICATIONS]
    };

    const tags = tagMap[table];
    if (tags) {
      CacheInvalidation.invalidateAcrossTabs(tags);
    }

    // Specific invalidations based on record data
    if (record) {
      this.invalidateSpecificRecords(table, record);
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(userId?: string): Promise<void> {
    const warmupTasks = [
      {
        key: 'categories:all',
        fetcher: () => this.cacheCategories(),
        options: { ttl: 30 * 60 * 1000 } // 30 minutes
      }
    ];

    if (userId) {
      warmupTasks.push(
        {
          key: `profile:${userId}`,
          fetcher: () => this.cacheUserProfile(userId),
          options: { ttl: 15 * 60 * 1000 } // 15 minutes
        },
        {
          key: `notifications:${userId}`,
          fetcher: () => this.cacheNotifications(userId),
          options: { ttl: 5 * 60 * 1000 } // 5 minutes
        },
        {
          key: `dashboard:stats:${userId}`,
          fetcher: () => this.cacheDashboardStats(userId),
          options: { ttl: 2 * 60 * 1000 } // 2 minutes
        }
      );
    }

    await cacheManager.warmUp(warmupTasks);
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return cacheManager.getStats();
  }

  /**
   * Clear all API cache
   */
  clearCache(): void {
    cacheManager.clear();
  }

  private async refreshInBackground<T>(
    cacheKey: string,
    queryFn: () => Promise<{ data: T | null; error: any }>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const result = await queryFn();
      if (!result.error) {
        cacheManager.set(cacheKey, result, options);
      }
    } catch (error) {
      console.warn(`Background refresh failed for ${cacheKey}:`, error);
    }
  }

  private processTicketStats(tickets: any[]): any {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      total: tickets.length,
      byStatus: tickets.reduce((acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
      }, {}),
      byPriority: tickets.reduce((acc, ticket) => {
        acc[ticket.priority] = (acc[ticket.priority] || 0) + 1;
        return acc;
      }, {}),
      createdToday: tickets.filter(t => new Date(t.created_at) >= today).length,
      createdThisWeek: tickets.filter(t => new Date(t.created_at) >= thisWeek).length,
      createdThisMonth: tickets.filter(t => new Date(t.created_at) >= thisMonth).length
    };
  }

  private invalidateSpecificRecords(table: string, record: any): void {
    switch (table) {
      case 'tickets':
        // Invalidate specific ticket and related caches
        if (record.id) {
          cacheManager.invalidate(`ticket:${record.id}`);
        }
        if (record.assigned_agent) {
          cacheManager.invalidate(`dashboard:stats:${record.assigned_agent}`);
        }
        break;
      
      case 'profiles':
        if (record.id) {
          cacheManager.invalidate(`profile:${record.id}`);
        }
        break;
      
      case 'notifications':
        if (record.user_id) {
          cacheManager.invalidate(`notifications:${record.user_id}`);
        }
        break;
    }
  }
}

// Global API cache instance
export const apiCache = new ApiCache();

// Setup real-time cache invalidation
export const setupCacheInvalidation = () => {
  // Listen for database changes and invalidate cache
  const channels = ['tickets', 'profiles', 'categories', 'notifications'];
  
  channels.forEach(table => {
    supabase
      .channel(`cache-invalidation-${table}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table },
        (payload) => {
          apiCache.invalidateOnDataChange(
            table, 
            payload.eventType as any, 
            payload.new || payload.old
          );
        }
      )
      .subscribe();
  });
};