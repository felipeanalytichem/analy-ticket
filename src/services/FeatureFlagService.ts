/**
 * Feature Flag Service for Notification System
 * Manages feature flags for gradual rollout of notification improvements
 */

import { supabase } from '@/lib/supabase';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  user_groups: string[];
  conditions: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface FeatureFlagEvaluation {
  flagName: string;
  enabled: boolean;
  reason: string;
  metadata?: Record<string, any>;
}

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  traffic_allocation: number;
  start_date: string;
  end_date?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  success_metrics: string[];
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  allocation_percentage: number;
  feature_flags: Record<string, boolean>;
}

export interface UserContext {
  userId: string;
  role: 'user' | 'agent' | 'admin';
  email?: string;
  groups?: string[];
  metadata?: Record<string, any>;
}

class FeatureFlagService {
  private cache: Map<string, FeatureFlag> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize the feature flag service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadFeatureFlags();
      console.log('FeatureFlagService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FeatureFlagService:', error);
    }
  }

  /**
   * Load all feature flags from the database
   */
  private async loadFeatureFlags(): Promise<void> {
    try {
      const { data: flags, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      // Update cache
      this.cache.clear();
      this.cacheExpiry.clear();
      
      flags?.forEach(flag => {
        this.cache.set(flag.name, flag);
        this.cacheExpiry.set(flag.name, Date.now() + this.CACHE_TTL);
      });

    } catch (error) {
      console.error('Error loading feature flags:', error);
      throw error;
    }
  }

  /**
   * Check if a feature flag is enabled for a user
   */
  async isEnabled(flagName: string, userContext: UserContext): Promise<boolean> {
    try {
      const evaluation = await this.evaluateFlag(flagName, userContext);
      return evaluation.enabled;
    } catch (error) {
      console.error(`Error evaluating flag ${flagName}:`, error);
      return false; // Fail closed - disable feature on error
    }
  }

  /**
   * Evaluate a feature flag with detailed reasoning
   */
  async evaluateFlag(flagName: string, userContext: UserContext): Promise<FeatureFlagEvaluation> {
    try {
      // Check cache first
      const cachedFlag = await this.getCachedFlag(flagName);
      
      if (!cachedFlag) {
        return {
          flagName,
          enabled: false,
          reason: 'Flag not found or disabled'
        };
      }

      // Check if flag is globally disabled
      if (!cachedFlag.enabled) {
        return {
          flagName,
          enabled: false,
          reason: 'Flag globally disabled'
        };
      }

      // Check user group conditions
      if (cachedFlag.user_groups.length > 0) {
        const userGroups = userContext.groups || [userContext.role];
        const hasMatchingGroup = cachedFlag.user_groups.some(group => 
          userGroups.includes(group)
        );
        
        if (!hasMatchingGroup) {
          return {
            flagName,
            enabled: false,
            reason: 'User not in target groups',
            metadata: { userGroups, targetGroups: cachedFlag.user_groups }
          };
        }
      }

      // Check rollout percentage
      if (cachedFlag.rollout_percentage < 100) {
        const userHash = this.hashUserId(userContext.userId, flagName);
        const userPercentile = userHash % 100;
        
        if (userPercentile >= cachedFlag.rollout_percentage) {
          return {
            flagName,
            enabled: false,
            reason: 'User outside rollout percentage',
            metadata: { 
              userPercentile, 
              rolloutPercentage: cachedFlag.rollout_percentage 
            }
          };
        }
      }

      // Check additional conditions
      if (cachedFlag.conditions && Object.keys(cachedFlag.conditions).length > 0) {
        const conditionsMet = this.evaluateConditions(cachedFlag.conditions, userContext);
        if (!conditionsMet) {
          return {
            flagName,
            enabled: false,
            reason: 'Additional conditions not met',
            metadata: { conditions: cachedFlag.conditions }
          };
        }
      }

      return {
        flagName,
        enabled: true,
        reason: 'All conditions met'
      };

    } catch (error) {
      console.error(`Error evaluating flag ${flagName}:`, error);
      return {
        flagName,
        enabled: false,
        reason: 'Evaluation error'
      };
    }
  }

  /**
   * Get multiple feature flags at once
   */
  async getFlags(flagNames: string[], userContext: UserContext): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      flagNames.map(async (flagName) => {
        results[flagName] = await this.isEnabled(flagName, userContext);
      })
    );
    
    return results;
  }

  /**
   * Get A/B test variant for a user
   */
  async getABTestVariant(testName: string, userContext: UserContext): Promise<string | null> {
    try {
      const { data: test, error } = await supabase
        .from('ab_tests')
        .select('*')
        .eq('name', testName)
        .eq('status', 'active')
        .single();

      if (error || !test) return null;

      // Check if user is in the test traffic
      const userHash = this.hashUserId(userContext.userId, testName);
      const userPercentile = userHash % 100;
      
      if (userPercentile >= test.traffic_allocation) {
        return null; // User not in test traffic
      }

      // Determine variant based on allocation
      let cumulativeAllocation = 0;
      const variantHash = userHash % 1000; // More granular for variant selection
      
      for (const variant of test.variants) {
        cumulativeAllocation += variant.allocation_percentage * 10; // Convert to per-mille
        if (variantHash < cumulativeAllocation) {
          return variant.name;
        }
      }

      return test.variants[0]?.name || null; // Fallback to first variant

    } catch (error) {
      console.error(`Error getting A/B test variant for ${testName}:`, error);
      return null;
    }
  }

  /**
   * Track feature flag usage for analytics
   */
  async trackUsage(flagName: string, userContext: UserContext, enabled: boolean): Promise<void> {
    try {
      await supabase
        .from('feature_flag_usage')
        .insert({
          flag_name: flagName,
          user_id: userContext.userId,
          enabled,
          user_role: userContext.role,
          timestamp: new Date().toISOString(),
          metadata: userContext.metadata || {}
        });
    } catch (error) {
      console.error(`Error tracking flag usage for ${flagName}:`, error);
      // Don't throw - tracking failures shouldn't break functionality
    }
  }

  /**
   * Get cached flag or load from database
   */
  private async getCachedFlag(flagName: string): Promise<FeatureFlag | null> {
    const expiry = this.cacheExpiry.get(flagName);
    
    // Check if cache is expired
    if (!expiry || Date.now() > expiry) {
      await this.loadFeatureFlags();
    }
    
    return this.cache.get(flagName) || null;
  }

  /**
   * Hash user ID for consistent percentage-based rollouts
   */
  private hashUserId(userId: string, salt: string): number {
    const str = userId + salt;
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  /**
   * Evaluate additional conditions
   */
  private evaluateConditions(conditions: Record<string, any>, userContext: UserContext): boolean {
    try {
      // Example condition evaluations
      for (const [key, value] of Object.entries(conditions)) {
        switch (key) {
          case 'min_account_age_days':
            // Would need account creation date in userContext
            break;
          case 'required_role':
            if (userContext.role !== value) return false;
            break;
          case 'email_domain':
            if (userContext.email && !userContext.email.endsWith(value)) return false;
            break;
          case 'metadata_match':
            if (!this.matchesMetadata(userContext.metadata || {}, value)) return false;
            break;
          default:
            console.warn(`Unknown condition: ${key}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error evaluating conditions:', error);
      return false;
    }
  }

  /**
   * Check if user metadata matches condition
   */
  private matchesMetadata(userMetadata: Record<string, any>, condition: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(condition)) {
      if (userMetadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Invalidate cache (useful for testing or immediate updates)
   */
  invalidateCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get all available flags (for admin interface)
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    try {
      const { data: flags, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('name');

      if (error) throw error;
      return flags || [];
    } catch (error) {
      console.error('Error getting all flags:', error);
      return [];
    }
  }

  /**
   * Create or update a feature flag (admin only)
   */
  async upsertFlag(flag: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .upsert(flag)
        .select()
        .single();

      if (error) throw error;
      
      // Invalidate cache to force reload
      this.invalidateCache();
      
      return data;
    } catch (error) {
      console.error('Error upserting flag:', error);
      return null;
    }
  }
}

// Notification-specific feature flags
export const NOTIFICATION_FEATURE_FLAGS = {
  // Core enhancements
  ENHANCED_REALTIME: 'notifications_enhanced_realtime',
  INTELLIGENT_GROUPING: 'notifications_intelligent_grouping',
  ADVANCED_CACHING: 'notifications_advanced_caching',
  OPTIMISTIC_UPDATES: 'notifications_optimistic_updates',
  
  // UI improvements
  NEW_NOTIFICATION_BELL: 'notifications_new_bell_ui',
  VIRTUAL_SCROLLING: 'notifications_virtual_scrolling',
  ADVANCED_FILTERING: 'notifications_advanced_filtering',
  NOTIFICATION_PREVIEW: 'notifications_preview_mode',
  
  // User preferences
  GRANULAR_PREFERENCES: 'notifications_granular_preferences',
  QUIET_HOURS: 'notifications_quiet_hours',
  SMART_BATCHING: 'notifications_smart_batching',
  
  // Analytics and monitoring
  USAGE_ANALYTICS: 'notifications_usage_analytics',
  PERFORMANCE_MONITORING: 'notifications_performance_monitoring',
  ERROR_TRACKING: 'notifications_error_tracking',
  
  // Security and privacy
  CONTENT_ENCRYPTION: 'notifications_content_encryption',
  ACCESS_LOGGING: 'notifications_access_logging',
  DATA_RETENTION: 'notifications_data_retention',
  
  // Experimental features
  AI_PRIORITIZATION: 'notifications_ai_prioritization',
  CROSS_TAB_SYNC: 'notifications_cross_tab_sync',
  OFFLINE_QUEUE: 'notifications_offline_queue'
} as const;

// Create singleton instance
export const featureFlagService = new FeatureFlagService();

// Initialize on module load
featureFlagService.initialize().catch(console.error);

export default featureFlagService;