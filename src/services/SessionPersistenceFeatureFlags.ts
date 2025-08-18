/**
 * Feature flags for session persistence improvements
 * Enables gradual rollout and A/B testing of new functionality
 */

import { FeatureFlagService } from './FeatureFlagService';

export interface SessionPersistenceFlags {
  // Core session management features
  enhancedSessionManager: boolean;
  automaticTokenRefresh: boolean;
  crossTabSynchronization: boolean;
  
  // Connection and recovery features
  connectionMonitoring: boolean;
  autoReconnection: boolean;
  offlineMode: boolean;
  backgroundSync: boolean;
  
  // State persistence features
  formAutoSave: boolean;
  navigationStatePersistence: boolean;
  intelligentCaching: boolean;
  
  // Error handling and recovery
  errorRecoveryManager: boolean;
  retryWithBackoff: boolean;
  gracefulDegradation: boolean;
  
  // Performance and monitoring
  performanceMonitoring: boolean;
  sessionAnalytics: boolean;
  diagnosticTools: boolean;
  
  // UI enhancements
  connectionStatusIndicator: boolean;
  sessionExpirationWarning: boolean;
  offlineIndicators: boolean;
}

export class SessionPersistenceFeatureFlags {
  private featureFlagService: FeatureFlagService;
  private defaultFlags: SessionPersistenceFlags = {
    // Core features - enabled by default for existing functionality
    enhancedSessionManager: true,
    automaticTokenRefresh: true,
    crossTabSynchronization: false, // Gradual rollout
    
    // Connection features - gradual rollout
    connectionMonitoring: false,
    autoReconnection: false,
    offlineMode: false,
    backgroundSync: false,
    
    // State persistence - gradual rollout
    formAutoSave: false,
    navigationStatePersistence: false,
    intelligentCaching: false,
    
    // Error handling - enabled for stability
    errorRecoveryManager: true,
    retryWithBackoff: true,
    gracefulDegradation: true,
    
    // Performance monitoring - enabled for insights
    performanceMonitoring: true,
    sessionAnalytics: false, // Privacy considerations
    diagnosticTools: false, // Admin only
    
    // UI enhancements - gradual rollout
    connectionStatusIndicator: false,
    sessionExpirationWarning: true,
    offlineIndicators: false
  };

  constructor() {
    this.featureFlagService = new FeatureFlagService();
  }

  /**
   * Get all session persistence feature flags
   */
  async getFlags(): Promise<SessionPersistenceFlags> {
    try {
      const flags = await this.featureFlagService.getFlags('session-persistence');
      return { ...this.defaultFlags, ...flags };
    } catch (error) {
      console.warn('Failed to load session persistence feature flags, using defaults:', error);
      return this.defaultFlags;
    }
  }

  /**
   * Check if a specific feature is enabled
   */
  async isEnabled(feature: keyof SessionPersistenceFlags): Promise<boolean> {
    const flags = await this.getFlags();
    return flags[feature];
  }

  /**
   * Enable a feature flag
   */
  async enableFeature(feature: keyof SessionPersistenceFlags): Promise<void> {
    await this.featureFlagService.setFlag('session-persistence', feature, true);
  }

  /**
   * Disable a feature flag
   */
  async disableFeature(feature: keyof SessionPersistenceFlags): Promise<void> {
    await this.featureFlagService.setFlag('session-persistence', feature, false);
  }

  /**
   * Get rollout configuration for gradual feature deployment
   */
  getRolloutConfig(): Record<keyof SessionPersistenceFlags, { percentage: number; userGroups?: string[] }> {
    return {
      // Core features - full rollout
      enhancedSessionManager: { percentage: 100 },
      automaticTokenRefresh: { percentage: 100 },
      crossTabSynchronization: { percentage: 25, userGroups: ['beta', 'admin'] },
      
      // Connection features - phased rollout
      connectionMonitoring: { percentage: 10, userGroups: ['beta'] },
      autoReconnection: { percentage: 10, userGroups: ['beta'] },
      offlineMode: { percentage: 5, userGroups: ['beta'] },
      backgroundSync: { percentage: 5, userGroups: ['beta'] },
      
      // State persistence - careful rollout
      formAutoSave: { percentage: 20, userGroups: ['beta', 'power-users'] },
      navigationStatePersistence: { percentage: 15, userGroups: ['beta'] },
      intelligentCaching: { percentage: 30, userGroups: ['beta', 'power-users'] },
      
      // Error handling - wide rollout for stability
      errorRecoveryManager: { percentage: 100 },
      retryWithBackoff: { percentage: 100 },
      gracefulDegradation: { percentage: 100 },
      
      // Performance monitoring - full rollout
      performanceMonitoring: { percentage: 100 },
      sessionAnalytics: { percentage: 0, userGroups: ['admin'] }, // Admin only initially
      diagnosticTools: { percentage: 0, userGroups: ['admin'] },
      
      // UI enhancements - gradual rollout
      connectionStatusIndicator: { percentage: 15, userGroups: ['beta'] },
      sessionExpirationWarning: { percentage: 100 },
      offlineIndicators: { percentage: 10, userGroups: ['beta'] }
    };
  }

  /**
   * Check if user is eligible for a feature based on rollout configuration
   */
  async isUserEligible(
    feature: keyof SessionPersistenceFlags, 
    userId: string, 
    userGroups: string[] = []
  ): Promise<boolean> {
    const rolloutConfig = this.getRolloutConfig()[feature];
    
    // Check if user is in eligible groups
    if (rolloutConfig.userGroups) {
      const hasEligibleGroup = rolloutConfig.userGroups.some(group => 
        userGroups.includes(group)
      );
      if (hasEligibleGroup) {
        return true;
      }
    }
    
    // Check percentage rollout
    const userHash = this.hashUserId(userId);
    const userPercentile = userHash % 100;
    
    return userPercentile < rolloutConfig.percentage;
  }

  /**
   * Get feature flags for a specific user
   */
  async getFlagsForUser(
    userId: string, 
    userGroups: string[] = []
  ): Promise<SessionPersistenceFlags> {
    const baseFlags = await this.getFlags();
    const userFlags = { ...baseFlags };
    
    // Apply user-specific rollout logic
    for (const [feature, enabled] of Object.entries(baseFlags)) {
      if (enabled) {
        // If feature is enabled globally, check user eligibility
        const isEligible = await this.isUserEligible(
          feature as keyof SessionPersistenceFlags,
          userId,
          userGroups
        );
        userFlags[feature as keyof SessionPersistenceFlags] = isEligible;
      }
    }
    
    return userFlags;
  }

  /**
   * Update rollout percentage for a feature
   */
  async updateRolloutPercentage(
    feature: keyof SessionPersistenceFlags,
    percentage: number
  ): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    
    await this.featureFlagService.setFlag(
      'session-persistence-rollout',
      `${feature}-percentage`,
      percentage
    );
  }

  /**
   * Get feature usage analytics
   */
  async getFeatureUsageAnalytics(): Promise<Record<keyof SessionPersistenceFlags, {
    enabled: boolean;
    rolloutPercentage: number;
    estimatedUsers: number;
    errorRate?: number;
    performanceImpact?: number;
  }>> {
    const flags = await this.getFlags();
    const rolloutConfig = this.getRolloutConfig();
    
    const analytics: any = {};
    
    for (const [feature, enabled] of Object.entries(flags)) {
      const config = rolloutConfig[feature as keyof SessionPersistenceFlags];
      
      analytics[feature] = {
        enabled,
        rolloutPercentage: config.percentage,
        estimatedUsers: Math.floor((config.percentage / 100) * 1000), // Estimate based on 1000 users
        errorRate: await this.getFeatureErrorRate(feature as keyof SessionPersistenceFlags),
        performanceImpact: await this.getFeaturePerformanceImpact(feature as keyof SessionPersistenceFlags)
      };
    }
    
    return analytics;
  }

  /**
   * Emergency disable feature
   */
  async emergencyDisable(feature: keyof SessionPersistenceFlags, reason: string): Promise<void> {
    console.warn(`Emergency disabling feature ${feature}: ${reason}`);
    
    await this.disableFeature(feature);
    await this.updateRolloutPercentage(feature, 0);
    
    // Log the emergency disable
    await this.featureFlagService.setFlag(
      'session-persistence-emergency',
      `${feature}-disabled`,
      {
        timestamp: new Date().toISOString(),
        reason,
        disabledBy: 'system'
      }
    );
  }

  /**
   * Gradual rollout increase
   */
  async gradualRolloutIncrease(
    feature: keyof SessionPersistenceFlags,
    targetPercentage: number,
    incrementPercentage: number = 5,
    intervalHours: number = 24
  ): Promise<void> {
    const currentConfig = this.getRolloutConfig()[feature];
    let currentPercentage = currentConfig.percentage;
    
    const rolloutInterval = setInterval(async () => {
      if (currentPercentage >= targetPercentage) {
        clearInterval(rolloutInterval);
        return;
      }
      
      // Check for any issues before increasing rollout
      const errorRate = await this.getFeatureErrorRate(feature);
      if (errorRate && errorRate > 0.05) { // 5% error rate threshold
        console.warn(`Pausing rollout for ${feature} due to high error rate: ${errorRate}`);
        clearInterval(rolloutInterval);
        return;
      }
      
      currentPercentage = Math.min(currentPercentage + incrementPercentage, targetPercentage);
      await this.updateRolloutPercentage(feature, currentPercentage);
      
      console.log(`Increased rollout for ${feature} to ${currentPercentage}%`);
    }, intervalHours * 60 * 60 * 1000);
  }

  /**
   * Private helper methods
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async getFeatureErrorRate(feature: keyof SessionPersistenceFlags): Promise<number | undefined> {
    try {
      // This would integrate with your monitoring system
      // For now, return a mock value
      return Math.random() * 0.02; // 0-2% error rate
    } catch (error) {
      console.warn(`Failed to get error rate for ${feature}:`, error);
      return undefined;
    }
  }

  private async getFeaturePerformanceImpact(feature: keyof SessionPersistenceFlags): Promise<number | undefined> {
    try {
      // This would integrate with your performance monitoring
      // For now, return a mock value
      return Math.random() * 10; // 0-10ms performance impact
    } catch (error) {
      console.warn(`Failed to get performance impact for ${feature}:`, error);
      return undefined;
    }
  }
}

// Export singleton instance
export const sessionPersistenceFeatureFlags = new SessionPersistenceFeatureFlags();