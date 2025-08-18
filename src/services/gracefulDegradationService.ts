/**
 * Graceful Degradation Service
 * 
 * Provides fallback data and partial functionality when primary data sources fail.
 * Implements caching strategies and partial data recovery for better user experience.
 */

interface CachedData<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface PartialLoadResult<T> {
  data: T[];
  isPartial: boolean;
  missingFeatures: string[];
  lastSuccessfulLoad: number;
  cacheSource: 'localStorage' | 'sessionStorage' | 'memory' | 'none';
}

class GracefulDegradationService {
  private memoryCache = new Map<string, CachedData<any>>();
  private readonly CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
  private readonly CACHE_VERSION = '1.0.0';

  /**
   * Store data in multiple cache layers for redundancy
   */
  cacheData<T>(key: string, data: T): void {
    const cachedData: CachedData<T> = {
      data,
      timestamp: Date.now(),
      version: this.CACHE_VERSION
    };

    try {
      // Memory cache (fastest)
      this.memoryCache.set(key, cachedData);

      // Session storage (survives page refresh)
      sessionStorage.setItem(
        `graceful_${key}`, 
        JSON.stringify(cachedData)
      );

      // Local storage (survives browser restart)
      localStorage.setItem(
        `graceful_${key}`, 
        JSON.stringify(cachedData)
      );

      console.log(`[GracefulDegradation] Cached data for key: ${key}`);
    } catch (error) {
      console.warn(`[GracefulDegradation] Failed to cache data for ${key}:`, error);
    }
  }

  /**
   * Retrieve cached data with fallback hierarchy
   */
  getCachedData<T>(key: string): CachedData<T> | null {
    try {
      // Try memory cache first (fastest)
      const memoryData = this.memoryCache.get(key);
      if (memoryData && this.isValidCache(memoryData)) {
        console.log(`[GracefulDegradation] Retrieved from memory cache: ${key}`);
        return memoryData;
      }

      // Try session storage
      const sessionData = sessionStorage.getItem(`graceful_${key}`);
      if (sessionData) {
        const parsed = JSON.parse(sessionData) as CachedData<T>;
        if (this.isValidCache(parsed)) {
          // Restore to memory cache
          this.memoryCache.set(key, parsed);
          console.log(`[GracefulDegradation] Retrieved from session storage: ${key}`);
          return parsed;
        }
      }

      // Try local storage
      const localData = localStorage.getItem(`graceful_${key}`);
      if (localData) {
        const parsed = JSON.parse(localData) as CachedData<T>;
        if (this.isValidCache(parsed)) {
          // Restore to higher-level caches
          this.memoryCache.set(key, parsed);
          sessionStorage.setItem(`graceful_${key}`, localData);
          console.log(`[GracefulDegradation] Retrieved from local storage: ${key}`);
          return parsed;
        }
      }

      console.log(`[GracefulDegradation] No valid cache found for: ${key}`);
      return null;
    } catch (error) {
      console.warn(`[GracefulDegradation] Error retrieving cached data for ${key}:`, error);
      return null;
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isValidCache<T>(cachedData: CachedData<T>): boolean {
    const now = Date.now();
    const age = now - cachedData.timestamp;
    
    return (
      age < this.CACHE_EXPIRY &&
      cachedData.version === this.CACHE_VERSION &&
      cachedData.data !== null &&
      cachedData.data !== undefined
    );
  }

  /**
   * Attempt to load data with graceful degradation
   */
  async loadWithGracefulDegradation<T>(
    key: string,
    primaryLoader: () => Promise<T[]>,
    options: {
      enablePartialLoad?: boolean;
      fallbackFeatures?: string[];
      maxPartialItems?: number;
    } = {}
  ): Promise<PartialLoadResult<T>> {
    const {
      enablePartialLoad = true,
      fallbackFeatures = [],
      maxPartialItems = 50
    } = options;

    try {
      // Attempt primary load
      console.log(`[GracefulDegradation] Attempting primary load for: ${key}`);
      const data = await primaryLoader();
      
      // Success - cache the data and return
      this.cacheData(key, data);
      
      return {
        data,
        isPartial: false,
        missingFeatures: [],
        lastSuccessfulLoad: Date.now(),
        cacheSource: 'none'
      };
    } catch (primaryError) {
      console.warn(`[GracefulDegradation] Primary load failed for ${key}:`, primaryError);

      if (!enablePartialLoad) {
        throw primaryError;
      }

      // Attempt graceful degradation
      return this.attemptGracefulDegradation<T>(
        key,
        fallbackFeatures,
        maxPartialItems,
        primaryError as Error
      );
    }
  }

  /**
   * Attempt to provide partial functionality when primary load fails
   */
  private async attemptGracefulDegradation<T>(
    key: string,
    fallbackFeatures: string[],
    maxPartialItems: number,
    originalError: Error
  ): Promise<PartialLoadResult<T>> {
    console.log(`[GracefulDegradation] Attempting graceful degradation for: ${key}`);

    // Try to get cached data
    const cachedData = this.getCachedData<T[]>(key);
    
    if (cachedData && cachedData.data) {
      const limitedData = cachedData.data.slice(0, maxPartialItems);
      const missingFeatures = this.determineMissingFeatures(originalError, fallbackFeatures);
      
      console.log(`[GracefulDegradation] Using cached data with ${limitedData.length} items`);
      
      return {
        data: limitedData,
        isPartial: true,
        missingFeatures,
        lastSuccessfulLoad: cachedData.timestamp,
        cacheSource: this.determineCacheSource(key)
      };
    }

    // No cached data available - provide minimal fallback
    console.log(`[GracefulDegradation] No cached data available for: ${key}`);
    
    return {
      data: [],
      isPartial: true,
      missingFeatures: ['data-loading', 'real-time-updates', ...fallbackFeatures],
      lastSuccessfulLoad: 0,
      cacheSource: 'none'
    };
  }

  /**
   * Determine which features are unavailable based on error type
   */
  private determineMissingFeatures(error: Error, fallbackFeatures: string[]): string[] {
    const baseFeatures: string[] = [];
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      baseFeatures.push('real-time-updates', 'data-refresh', 'create-operations', 'update-operations');
    } else if (errorMessage.includes('database')) {
      baseFeatures.push('data-persistence', 'create-operations', 'update-operations', 'delete-operations');
    } else if (errorMessage.includes('permission')) {
      baseFeatures.push('admin-operations', 'user-management', 'role-changes');
    } else {
      baseFeatures.push('full-functionality');
    }

    return [...baseFeatures, ...fallbackFeatures];
  }

  /**
   * Determine the source of cached data
   */
  private determineCacheSource(key: string): 'localStorage' | 'sessionStorage' | 'memory' | 'none' {
    if (this.memoryCache.has(key)) {
      return 'memory';
    }
    
    try {
      if (sessionStorage.getItem(`graceful_${key}`)) {
        return 'sessionStorage';
      }
      if (localStorage.getItem(`graceful_${key}`)) {
        return 'localStorage';
      }
    } catch (error) {
      // Storage access might be blocked
    }
    
    return 'none';
  }

  /**
   * Clear cached data for a specific key
   */
  clearCache(key: string): void {
    try {
      this.memoryCache.delete(key);
      sessionStorage.removeItem(`graceful_${key}`);
      localStorage.removeItem(`graceful_${key}`);
      console.log(`[GracefulDegradation] Cleared cache for: ${key}`);
    } catch (error) {
      console.warn(`[GracefulDegradation] Error clearing cache for ${key}:`, error);
    }
  }

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    try {
      this.memoryCache.clear();
      
      // Clear session storage
      const sessionKeys = Object.keys(sessionStorage).filter(key => key.startsWith('graceful_'));
      sessionKeys.forEach(key => sessionStorage.removeItem(key));
      
      // Clear local storage
      const localKeys = Object.keys(localStorage).filter(key => key.startsWith('graceful_'));
      localKeys.forEach(key => localStorage.removeItem(key));
      
      console.log('[GracefulDegradation] Cleared all cached data');
    } catch (error) {
      console.warn('[GracefulDegradation] Error clearing all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryItems: number;
    sessionItems: number;
    localItems: number;
    totalSize: number;
  } {
    try {
      const sessionKeys = Object.keys(sessionStorage).filter(key => key.startsWith('graceful_'));
      const localKeys = Object.keys(localStorage).filter(key => key.startsWith('graceful_'));
      
      // Estimate total size (rough calculation)
      let totalSize = 0;
      sessionKeys.forEach(key => {
        const item = sessionStorage.getItem(key);
        if (item) totalSize += item.length;
      });
      localKeys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) totalSize += item.length;
      });

      return {
        memoryItems: this.memoryCache.size,
        sessionItems: sessionKeys.length,
        localItems: localKeys.length,
        totalSize
      };
    } catch (error) {
      console.warn('[GracefulDegradation] Error getting cache stats:', error);
      return {
        memoryItems: 0,
        sessionItems: 0,
        localItems: 0,
        totalSize: 0
      };
    }
  }
}

// Export singleton instance
export const gracefulDegradationService = new GracefulDegradationService();
export type { PartialLoadResult };