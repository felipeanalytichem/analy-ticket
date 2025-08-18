/**
 * React Hook for Feature Flags
 * Provides easy access to feature flags in React components
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { featureFlagService, NOTIFICATION_FEATURE_FLAGS, type UserContext } from '@/services/FeatureFlagService';

export interface UseFeatureFlagsOptions {
  trackUsage?: boolean;
  refreshInterval?: number;
}

export interface FeatureFlagHookResult {
  flags: Record<string, boolean>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isEnabled: (flagName: string) => boolean;
  getVariant: (testName: string) => Promise<string | null>;
}

/**
 * Hook to access multiple feature flags
 */
export function useFeatureFlags(
  flagNames: string[] = Object.values(NOTIFICATION_FEATURE_FLAGS),
  options: UseFeatureFlagsOptions = {}
): FeatureFlagHookResult {
  const { user } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { trackUsage = true, refreshInterval } = options;

  // Create user context
  const userContext = useMemo((): UserContext | null => {
    if (!user) return null;
    
    return {
      userId: user.id,
      role: user.role || 'user',
      email: user.email,
      groups: [user.role || 'user'],
      metadata: {
        createdAt: user.created_at,
        lastLogin: new Date().toISOString()
      }
    };
  }, [user]);

  // Load feature flags
  const loadFlags = useCallback(async () => {
    if (!userContext) {
      setFlags({});
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const flagResults = await featureFlagService.getFlags(flagNames, userContext);
      
      // Track usage if enabled
      if (trackUsage) {
        await Promise.all(
          Object.entries(flagResults).map(([flagName, enabled]) =>
            featureFlagService.trackUsage(flagName, userContext, enabled)
          )
        );
      }
      
      setFlags(flagResults);
    } catch (err) {
      console.error('Error loading feature flags:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
      
      // Set all flags to false on error (fail closed)
      const fallbackFlags = flagNames.reduce((acc, flagName) => {
        acc[flagName] = false;
        return acc;
      }, {} as Record<string, boolean>);
      
      setFlags(fallbackFlags);
    } finally {
      setIsLoading(false);
    }
  }, [userContext, flagNames, trackUsage]);

  // Refresh flags
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadFlags();
  }, [loadFlags]);

  // Check if a specific flag is enabled
  const isEnabled = useCallback((flagName: string): boolean => {
    return flags[flagName] || false;
  }, [flags]);

  // Get A/B test variant
  const getVariant = useCallback(async (testName: string): Promise<string | null> => {
    if (!userContext) return null;
    
    try {
      return await featureFlagService.getABTestVariant(testName, userContext);
    } catch (error) {
      console.error(`Error getting A/B test variant for ${testName}:`, error);
      return null;
    }
  }, [userContext]);

  // Load flags on mount and when dependencies change
  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Set up refresh interval if specified
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  return {
    flags,
    isLoading,
    error,
    refresh,
    isEnabled,
    getVariant
  };
}

/**
 * Hook to access a single feature flag
 */
export function useFeatureFlag(
  flagName: string,
  options: UseFeatureFlagsOptions = {}
): {
  enabled: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { flags, isLoading, error, refresh } = useFeatureFlags([flagName], options);
  
  return {
    enabled: flags[flagName] || false,
    isLoading,
    error,
    refresh
  };
}

/**
 * Hook for notification-specific feature flags
 */
export function useNotificationFeatureFlags(): FeatureFlagHookResult & {
  // Convenience methods for common notification flags
  hasEnhancedRealtime: boolean;
  hasIntelligentGrouping: boolean;
  hasAdvancedCaching: boolean;
  hasOptimisticUpdates: boolean;
  hasNewBellUI: boolean;
  hasVirtualScrolling: boolean;
  hasAdvancedFiltering: boolean;
  hasPreviewMode: boolean;
  hasGranularPreferences: boolean;
  hasQuietHours: boolean;
  hasSmartBatching: boolean;
  hasUsageAnalytics: boolean;
  hasPerformanceMonitoring: boolean;
  hasErrorTracking: boolean;
  hasContentEncryption: boolean;
  hasAccessLogging: boolean;
  hasDataRetention: boolean;
  hasAIPrioritization: boolean;
  hasCrossTabSync: boolean;
  hasOfflineQueue: boolean;
} {
  const flagNames = Object.values(NOTIFICATION_FEATURE_FLAGS);
  const result = useFeatureFlags(flagNames, { trackUsage: true });

  return {
    ...result,
    // Convenience getters
    hasEnhancedRealtime: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.ENHANCED_REALTIME),
    hasIntelligentGrouping: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.INTELLIGENT_GROUPING),
    hasAdvancedCaching: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.ADVANCED_CACHING),
    hasOptimisticUpdates: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.OPTIMISTIC_UPDATES),
    hasNewBellUI: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.NEW_NOTIFICATION_BELL),
    hasVirtualScrolling: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.VIRTUAL_SCROLLING),
    hasAdvancedFiltering: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.ADVANCED_FILTERING),
    hasPreviewMode: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.NOTIFICATION_PREVIEW),
    hasGranularPreferences: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.GRANULAR_PREFERENCES),
    hasQuietHours: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.QUIET_HOURS),
    hasSmartBatching: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.SMART_BATCHING),
    hasUsageAnalytics: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.USAGE_ANALYTICS),
    hasPerformanceMonitoring: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.PERFORMANCE_MONITORING),
    hasErrorTracking: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.ERROR_TRACKING),
    hasContentEncryption: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.CONTENT_ENCRYPTION),
    hasAccessLogging: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.ACCESS_LOGGING),
    hasDataRetention: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.DATA_RETENTION),
    hasAIPrioritization: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.AI_PRIORITIZATION),
    hasCrossTabSync: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.CROSS_TAB_SYNC),
    hasOfflineQueue: result.isEnabled(NOTIFICATION_FEATURE_FLAGS.OFFLINE_QUEUE)
  };
}

/**
 * Hook for A/B testing
 */
export function useABTest(testName: string): {
  variant: string | null;
  isLoading: boolean;
  error: string | null;
  isInTest: boolean;
} {
  const { user } = useAuth();
  const [variant, setVariant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userContext = useMemo((): UserContext | null => {
    if (!user) return null;
    
    return {
      userId: user.id,
      role: user.role || 'user',
      email: user.email,
      groups: [user.role || 'user']
    };
  }, [user]);

  useEffect(() => {
    if (!userContext) {
      setVariant(null);
      setIsLoading(false);
      return;
    }

    const loadVariant = async () => {
      try {
        setError(null);
        const testVariant = await featureFlagService.getABTestVariant(testName, userContext);
        setVariant(testVariant);
      } catch (err) {
        console.error(`Error loading A/B test variant for ${testName}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load A/B test variant');
        setVariant(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadVariant();
  }, [testName, userContext]);

  return {
    variant,
    isLoading,
    error,
    isInTest: variant !== null
  };
}

export default useFeatureFlags;