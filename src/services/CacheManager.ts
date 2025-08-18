import { supabase } from '@/lib/supabase';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags: string[];
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size in bytes
  maxEntries?: number; // Maximum number of entries
  tags?: string[]; // Tags for cache invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  hitRate: number;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0,
    hitRate: 0
  };
  
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_ENTRIES = 1000;
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  
  private cleanupTimer: NodeJS.Timeout | null = null;
  private warmupQueue: Array<{ key: string; fetcher: () => Promise<any>; options?: CacheOptions }> = [];
  
  constructor() {
    this.startCleanupTimer();
    this.setupStorageEventListener();
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateStats();
      return null;
    }
    
    // Update access information for LRU
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.data;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.DEFAULT_TTL;
    const tags = options.tags || [];
    const size = this.calculateSize(data);
    
    // Check if we need to evict entries
    this.evictIfNecessary(size);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      tags
    };
    
    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.stats.entryCount++;
    this.updateStats();
  }

  /**
   * Get data with fallback fetcher
   */
  async getOrFetch<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }
    
    try {
      const data = await fetcher();
      this.set(key, data, options);
      return data;
    } catch (error) {
      console.error(`Failed to fetch data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache entries by key or tags
   */
  invalidate(keyOrTags: string | string[]): void {
    if (typeof keyOrTags === 'string') {
      // Single key invalidation
      const entry = this.cache.get(keyOrTags);
      if (entry) {
        this.cache.delete(keyOrTags);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
        this.stats.evictions++;
      }
    } else {
      // Tag-based invalidation
      const keysToDelete: string[] = [];
      
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tags.some(tag => keyOrTags.includes(tag))) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        const entry = this.cache.get(key);
        if (entry) {
          this.cache.delete(key);
          this.stats.totalSize -= entry.size;
          this.stats.entryCount--;
          this.stats.evictions++;
        }
      });
    }
    
    this.updateStats();
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0
    };
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmupConfig: Array<{ key: string; fetcher: () => Promise<any>; options?: CacheOptions }>): Promise<void> {
    const promises = warmupConfig.map(async ({ key, fetcher, options }) => {
      try {
        const data = await fetcher();
        this.set(key, data, options);
      } catch (error) {
        console.warn(`Cache warmup failed for key ${key}:`, error);
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Add items to warmup queue for background processing
   */
  queueWarmup(key: string, fetcher: () => Promise<any>, options?: CacheOptions): void {
    this.warmupQueue.push({ key, fetcher, options });
    
    // Process queue in background
    setTimeout(() => this.processWarmupQueue(), 0);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): Array<{ key: string; entry: CacheEntry }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }));
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
        this.stats.evictions++;
      }
    });
    
    this.updateStats();
  }

  /**
   * Destroy cache manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.clear();
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback size estimation
      return JSON.stringify(data).length * 2; // Rough estimate for UTF-16
    }
  }

  private evictIfNecessary(newEntrySize: number): void {
    // Check if we need to evict based on size or entry count
    while (
      (this.stats.totalSize + newEntrySize > this.MAX_SIZE) ||
      (this.stats.entryCount >= this.MAX_ENTRIES)
    ) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();
    
    // Find least recently used entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      const entry = this.cache.get(lruKey);
      if (entry) {
        this.cache.delete(lruKey);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
        this.stats.evictions++;
      }
    }
  }

  private updateStats(): void {
    this.stats.entryCount = this.cache.size;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private setupStorageEventListener(): void {
    // Listen for storage events to sync cache across tabs
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith('cache-invalidate-')) {
        const tags = event.newValue ? JSON.parse(event.newValue) : [];
        this.invalidate(tags);
      }
    });
  }

  private async processWarmupQueue(): Promise<void> {
    if (this.warmupQueue.length === 0) return;
    
    const batch = this.warmupQueue.splice(0, 5); // Process 5 items at a time
    
    const promises = batch.map(async ({ key, fetcher, options }) => {
      try {
        const data = await fetcher();
        this.set(key, data, options);
      } catch (error) {
        console.warn(`Background warmup failed for key ${key}:`, error);
      }
    });
    
    await Promise.allSettled(promises);
    
    // Continue processing if there are more items
    if (this.warmupQueue.length > 0) {
      setTimeout(() => this.processWarmupQueue(), 100);
    }
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();

// Cache invalidation utilities
export const CacheInvalidation = {
  /**
   * Invalidate cache across all tabs
   */
  invalidateAcrossTabs(tags: string[]): void {
    localStorage.setItem(`cache-invalidate-${Date.now()}`, JSON.stringify(tags));
    cacheManager.invalidate(tags);
  },

  /**
   * Common cache tags for different data types
   */
  Tags: {
    TICKETS: 'tickets',
    USERS: 'users',
    CATEGORIES: 'categories',
    NOTIFICATIONS: 'notifications',
    DASHBOARD: 'dashboard',
    REPORTS: 'reports',
    SESSION: 'session',
    USER_PROFILE: 'user-profile'
  }
};

// Predefined cache configurations
export const CacheConfigs = {
  SHORT_TERM: { ttl: 2 * 60 * 1000 }, // 2 minutes
  MEDIUM_TERM: { ttl: 15 * 60 * 1000 }, // 15 minutes
  LONG_TERM: { ttl: 60 * 60 * 1000 }, // 1 hour
  SESSION_BASED: { ttl: 30 * 60 * 1000 }, // 30 minutes
  PERSISTENT: { ttl: 24 * 60 * 60 * 1000 } // 24 hours
};