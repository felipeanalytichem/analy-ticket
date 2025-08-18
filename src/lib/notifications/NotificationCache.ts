/**
 * NotificationCache - Intelligent caching service with TTL and LRU eviction
 */
export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

export class NotificationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SIZE = 1000; // Maximum cache entries
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  
  private stats = {
    hits: 0,
    misses: 0
  };
  
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<any> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    console.log(`📦 Cache HIT for key: ${key}`);
    return entry.data;
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, data: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    // Ensure we don't exceed max size
    if (this.cache.size >= this.MAX_SIZE) {
      await this.evictLRU();
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    console.log(`📦 Cache SET for key: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      console.log(`📦 Cache INVALIDATED: ${key}`);
    }

    console.log(`📦 Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    console.log(`📦 Cache CLEARED: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0
    };
  }

  /**
   * Preload cache with frequently accessed data
   */
  async preload(userId: string, data: any[]): Promise<void> {
    console.log(`📦 Preloading cache for user: ${userId}`);
    
    // Cache user's notifications
    await this.set(`notifications:${userId}:{}`, data, 10 * 60 * 1000); // 10 minutes for preloaded data
    
    // Cache unread count
    const unreadCount = data.filter(n => !n.read).length;
    await this.set(`unread_count:${userId}`, unreadCount, 5 * 60 * 1000);
    
    console.log(`📦 Preloaded ${data.length} notifications for user: ${userId}`);
  }

  /**
   * Warm cache with commonly accessed data
   */
  async warmCache(userId: string): Promise<void> {
    console.log(`📦 Warming cache for user: ${userId}`);
    
    // This would typically fetch and cache commonly accessed data
    // For now, we'll just set up the cache structure
    const cacheKeys = [
      `notifications:${userId}:{}`,
      `unread_count:${userId}`,
      `preferences:${userId}`
    ];

    for (const key of cacheKeys) {
      if (!this.cache.has(key)) {
        // Set placeholder entries that will be populated on first access
        await this.set(key, null, 1000); // Very short TTL for placeholders
      }
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(): Promise<void> {
    if (this.cache.size === 0) return;

    let oldestKey = '';
    let oldestTime = Date.now();

    // Find the least recently used entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`📦 Cache LRU EVICTED: ${oldestKey}`);
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`📦 Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get cache entry info for debugging
   */
  getEntryInfo(key: string): CacheEntry | null {
    return this.cache.get(key) || null;
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up NotificationCache...');
    this.stopCleanup();
    await this.clear();
  }
}