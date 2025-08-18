import { NotificationWithTicket } from '@/lib/notificationService';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

export interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number;
  enableLRU?: boolean;
  enableStats?: boolean;
}

/**
 * Intelligent notification cache with TTL and LRU eviction policies
 * Implements cache warming, preloading, and smart invalidation strategies
 */
export class NotificationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private readonly enableLRU: boolean;
  private readonly enableStats: boolean;
  
  // Statistics tracking
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0
  };

  // Cache warming intervals
  private warmingIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Preload patterns for frequently accessed data
  private preloadPatterns: Set<string> = new Set([
    'notifications:*:unread',
    'notifications:*:recent',
    'notifications:*:high-priority'
  ]);

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
    this.enableLRU = options.enableLRU !== false;
    this.enableStats = options.enableStats !== false;
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.updateStats('miss');
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateStats('miss');
      return null;
    }

    // Update access information for LRU
    if (this.enableLRU) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }

    this.updateStats('hit');
    return entry.data as T;
  }

  /**
   * Set data in cache with optional TTL
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const actualTTL = ttl || this.defaultTTL;
    const isNewEntry = !this.cache.has(key);
    
    // Check if we need to evict entries (only if adding new entry)
    if (isNewEntry && this.cache.size >= this.maxSize) {
      await this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: actualTTL,
      accessCount: 1,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.updateStats('set');
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    const regex = this.patternToRegex(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.stats.evictions++;
    });

    console.log(`🗑️ Cache invalidated ${keysToDelete.length} entries matching pattern: ${pattern}`);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.evictions += size;
    this.stats.size = 0;
    
    // Clear warming intervals
    this.warmingIntervals.forEach(interval => clearInterval(interval));
    this.warmingIntervals.clear();
    
    console.log(`🗑️ Cache cleared ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.stats.size = this.cache.size;
    this.stats.hitRate = this.stats.hits + this.stats.misses > 0 
      ? this.stats.hits / (this.stats.hits + this.stats.misses) 
      : 0;
    
    return { ...this.stats };
  }

  /**
   * Cache key generation strategies for different notification queries
   */
  static generateKey(type: 'notifications' | 'unread-count' | 'preferences', userId: string, params?: Record<string, any>): string {
    const baseKey = `${type}:${userId}`;
    
    if (!params) {
      return baseKey;
    }

    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return `${baseKey}:${sortedParams}`;
  }

  /**
   * Intelligent cache warming for frequently accessed data
   */
  async warmCache(userId: string, dataLoader: (key: string) => Promise<any>): Promise<void> {
    const warmingKeys = [
      NotificationCache.generateKey('notifications', userId, { limit: 20, unread: true }),
      NotificationCache.generateKey('notifications', userId, { limit: 50 }),
      NotificationCache.generateKey('unread-count', userId),
      NotificationCache.generateKey('preferences', userId)
    ];

    console.log(`🔥 Warming cache for user ${userId} with ${warmingKeys.length} keys`);

    const warmingPromises = warmingKeys.map(async (key) => {
      try {
        const data = await dataLoader(key);
        if (data !== null) {
          await this.set(key, data, this.defaultTTL);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to warm cache for key ${key}:`, error);
      }
    });

    await Promise.allSettled(warmingPromises);
  }

  /**
   * Set up automatic cache warming interval
   */
  setupCacheWarming(userId: string, dataLoader: (key: string) => Promise<any>, intervalMs: number = 2 * 60 * 1000): void {
    // Clear existing interval if any
    const existingInterval = this.warmingIntervals.get(userId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Set up new warming interval
    const interval = setInterval(async () => {
      await this.warmCache(userId, dataLoader);
    }, intervalMs);

    this.warmingIntervals.set(userId, interval);
    console.log(`🔥 Cache warming scheduled for user ${userId} every ${intervalMs}ms`);
  }

  /**
   * Stop cache warming for a user
   */
  stopCacheWarming(userId: string): void {
    const interval = this.warmingIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.warmingIntervals.delete(userId);
      console.log(`🛑 Cache warming stopped for user ${userId}`);
    }
  }

  /**
   * Preload frequently accessed notification data
   */
  async preloadFrequentData(userId: string, dataLoader: (key: string) => Promise<any>): Promise<void> {
    const preloadKeys = [
      // Recent notifications
      NotificationCache.generateKey('notifications', userId, { limit: 10, recent: true }),
      // High priority notifications
      NotificationCache.generateKey('notifications', userId, { priority: 'high' }),
      // Unread notifications
      NotificationCache.generateKey('notifications', userId, { unread: true }),
    ];

    console.log(`📦 Preloading frequent data for user ${userId}`);

    const preloadPromises = preloadKeys.map(async (key) => {
      try {
        // Only preload if not already cached
        const existing = await this.get(key);
        if (existing === null) {
          const data = await dataLoader(key);
          if (data !== null) {
            await this.set(key, data, this.defaultTTL * 2); // Longer TTL for preloaded data
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to preload data for key ${key}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Smart invalidation based on notification events
   */
  async invalidateForNotificationEvent(userId: string, eventType: 'create' | 'update' | 'delete', notificationId?: string): Promise<void> {
    const patterns = [];

    switch (eventType) {
      case 'create':
        // Invalidate user's notification lists and counts
        patterns.push(
          `notifications:${userId}*`,
          `unread-count:${userId}*`
        );
        break;
      
      case 'update':
        // Invalidate specific notification and related lists
        if (notificationId) {
          patterns.push(`notification:${notificationId}*`);
        }
        patterns.push(
          `notifications:${userId}*`,
          `unread-count:${userId}*`
        );
        break;
      
      case 'delete':
        // Invalidate specific notification and all user lists
        if (notificationId) {
          patterns.push(`notification:${notificationId}*`);
        }
        patterns.push(
          `notifications:${userId}*`,
          `unread-count:${userId}*`
        );
        break;
    }

    // Execute invalidation for all patterns
    const invalidationPromises = patterns.map(pattern => this.invalidate(pattern));
    await Promise.all(invalidationPromises);

    console.log(`🔄 Smart invalidation completed for user ${userId}, event: ${eventType}`);
  }

  /**
   * Check if cache entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict least recently used entries when cache is full
   */
  private async evictLRU(): Promise<void> {
    if (!this.enableLRU || this.cache.size === 0) {
      return;
    }

    // Find the least recently used entry
    let lruKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed <= oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    // If no LRU entry found (all have same timestamp), evict the first entry
    if (!lruKey && this.cache.size > 0) {
      lruKey = this.cache.keys().next().value;
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
      console.log(`🗑️ LRU evicted cache entry: ${lruKey}`);
    }
  }

  /**
   * Convert glob pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*') // Convert * to .*
      .replace(/\?/g, '.'); // Convert ? to .
    
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Update cache statistics
   */
  private updateStats(operation: 'hit' | 'miss' | 'set'): void {
    if (!this.enableStats) return;

    switch (operation) {
      case 'hit':
        this.stats.hits++;
        break;
      case 'miss':
        this.stats.misses++;
        break;
      case 'set':
        this.stats.size = this.cache.size;
        break;
    }
  }

  /**
   * Cleanup expired entries (can be called periodically)
   */
  async cleanup(): Promise<number> {
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.stats.evictions++;
    });

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
    }

    return expiredKeys.length;
  }

  /**
   * Get cache entry metadata (for debugging)
   */
  getEntryMetadata(key: string): Omit<CacheEntry, 'data'> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return {
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed
    };
  }
}

// Singleton instance for global use
export const notificationCache = new NotificationCache({
  maxSize: 2000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  enableLRU: true,
  enableStats: true
});