/**
 * System integration service for session persistence improvements
 * Coordinates all session management components and provides unified interface
 */

import { SessionManager } from './SessionManager';
import { TokenRefreshService } from './TokenRefreshService';
import { ConnectionMonitor } from './ConnectionMonitor';
import { StateManager } from './StateManager';
import { ErrorRecoveryManager } from './ErrorRecoveryManager';
import { OfflineManager } from './OfflineManager';
import { CrossTabCommunicationService } from './CrossTabCommunicationService';
import { SessionPersistenceFeatureFlags } from './SessionPersistenceFeatureFlags';
import { SessionMigrationService } from '../scripts/migrate-existing-sessions';

export interface SessionPersistenceConfig {
  // Core configuration
  enableEnhancedSession: boolean;
  enableTokenRefresh: boolean;
  enableConnectionMonitoring: boolean;
  enableOfflineMode: boolean;
  enableCrossTabSync: boolean;
  
  // Timing configuration
  sessionCheckInterval: number;
  tokenRefreshThreshold: number;
  connectionCheckInterval: number;
  offlineSyncInterval: number;
  
  // Storage configuration
  maxCacheSize: number;
  statePersistenceTTL: number;
  offlineStorageQuota: number;
  
  // Error handling configuration
  maxRetryAttempts: number;
  retryBackoffMultiplier: number;
  errorReportingEnabled: boolean;
  
  // Performance configuration
  performanceMonitoringEnabled: boolean;
  analyticsEnabled: boolean;
  debugMode: boolean;
}

export interface SessionPersistenceStatus {
  isInitialized: boolean;
  activeFeatures: string[];
  sessionStatus: any;
  connectionStatus: any;
  offlineStatus: any;
  errorCount: number;
  performanceMetrics: any;
}

export class SessionPersistenceIntegration {
  private config: SessionPersistenceConfig;
  private featureFlags: SessionPersistenceFeatureFlags;
  private migrationService: SessionMigrationService;
  
  // Core services
  private sessionManager?: SessionManager;
  private tokenRefreshService?: TokenRefreshService;
  private connectionMonitor?: ConnectionMonitor;
  private stateManager?: StateManager;
  private errorRecoveryManager?: ErrorRecoveryManager;
  private offlineManager?: OfflineManager;
  private crossTabService?: CrossTabCommunicationService;
  
  // State tracking
  private isInitialized = false;
  private activeFeatures: Set<string> = new Set();
  private initializationPromise?: Promise<void>;

  constructor(config: Partial<SessionPersistenceConfig> = {}) {
    this.config = {
      // Default configuration
      enableEnhancedSession: true,
      enableTokenRefresh: true,
      enableConnectionMonitoring: false,
      enableOfflineMode: false,
      enableCrossTabSync: false,
      
      sessionCheckInterval: 30000, // 30 seconds
      tokenRefreshThreshold: 300000, // 5 minutes
      connectionCheckInterval: 30000, // 30 seconds
      offlineSyncInterval: 60000, // 1 minute
      
      maxCacheSize: 100, // MB
      statePersistenceTTL: 86400000, // 24 hours
      offlineStorageQuota: 50, // MB
      
      maxRetryAttempts: 3,
      retryBackoffMultiplier: 2,
      errorReportingEnabled: true,
      
      performanceMonitoringEnabled: true,
      analyticsEnabled: false,
      debugMode: false,
      
      ...config
    };

    this.featureFlags = new SessionPersistenceFeatureFlags();
    this.migrationService = new SessionMigrationService();
  }

  /**
   * Initialize the session persistence system
   */
  async initialize(userId?: string, userGroups: string[] = []): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize(userId, userGroups);
    return this.initializationPromise;
  }

  private async _initialize(userId?: string, userGroups: string[] = []): Promise<void> {
    try {
      console.log('🚀 Initializing Session Persistence System...');

      // Load feature flags
      const flags = userId 
        ? await this.featureFlags.getFlagsForUser(userId, userGroups)
        : await this.featureFlags.getFlags();

      // Initialize core services based on feature flags
      await this.initializeCoreServices(flags);
      
      // Run migration if needed
      await this.runMigrationIfNeeded();
      
      // Set up service integrations
      await this.setupServiceIntegrations();
      
      // Start monitoring and analytics
      await this.startMonitoring();

      this.isInitialized = true;
      console.log('✅ Session Persistence System initialized successfully');
      console.log(`📊 Active features: ${Array.from(this.activeFeatures).join(', ')}`);

    } catch (error) {
      console.error('❌ Failed to initialize Session Persistence System:', error);
      
      // Fallback to basic functionality
      await this.initializeBasicFallback();
      throw error;
    }
  }

  /**
   * Initialize core services based on feature flags
   */
  private async initializeCoreServices(flags: any): Promise<void> {
    // Always initialize state manager and error recovery
    this.stateManager = new StateManager();
    this.errorRecoveryManager = new ErrorRecoveryManager();
    this.activeFeatures.add('stateManager');
    this.activeFeatures.add('errorRecovery');

    // Enhanced session manager
    if (flags.enhancedSessionManager) {
      this.sessionManager = new SessionManager({
        checkInterval: this.config.sessionCheckInterval,
        warningThreshold: this.config.tokenRefreshThreshold,
        autoRefresh: flags.automaticTokenRefresh
      });
      await this.sessionManager.initializeSession();
      this.activeFeatures.add('enhancedSession');
    }

    // Token refresh service
    if (flags.automaticTokenRefresh) {
      this.tokenRefreshService = new TokenRefreshService();
      this.activeFeatures.add('tokenRefresh');
    }

    // Connection monitoring
    if (flags.connectionMonitoring) {
      this.connectionMonitor = new ConnectionMonitor();
      this.connectionMonitor.startMonitoring();
      this.activeFeatures.add('connectionMonitoring');
    }

    // Offline mode
    if (flags.offlineMode) {
      this.offlineManager = new OfflineManager();
      await this.offlineManager.initialize();
      this.activeFeatures.add('offlineMode');
    }

    // Cross-tab synchronization
    if (flags.crossTabSynchronization) {
      this.crossTabService = new CrossTabCommunicationService();
      this.activeFeatures.add('crossTabSync');
    }
  }

  /**
   * Set up integrations between services
   */
  private async setupServiceIntegrations(): Promise<void> {
    // Session manager and token refresh integration
    if (this.sessionManager && this.tokenRefreshService) {
      this.sessionManager.onSessionExpiring(async (timeLeft) => {
        if (timeLeft < this.config.tokenRefreshThreshold) {
          await this.tokenRefreshService!.refreshTokens();
        }
      });
    }

    // Connection monitor and offline manager integration
    if (this.connectionMonitor && this.offlineManager) {
      this.connectionMonitor.onConnectionLost(async () => {
        await this.offlineManager!.handleOffline();
      });

      this.connectionMonitor.onReconnected(async () => {
        await this.offlineManager!.handleOnline();
      });
    }

    // Error recovery and all services integration
    if (this.errorRecoveryManager) {
      // Integrate with session manager
      if (this.sessionManager) {
        this.sessionManager.onSessionExpired(() => {
          this.errorRecoveryManager!.recordError(new Error('Session expired'));
        });
      }

      // Integrate with connection monitor
      if (this.connectionMonitor) {
        this.connectionMonitor.onConnectionLost(() => {
          this.errorRecoveryManager!.recordError(new Error('Connection lost'));
        });
      }
    }

    // Cross-tab synchronization integration
    if (this.crossTabService) {
      // Sync session state across tabs
      if (this.sessionManager) {
        this.sessionManager.onSessionRefreshed((session) => {
          this.crossTabService!.sendMessage('session-refreshed', { session });
        });

        this.crossTabService.onMessage('session-refreshed', (data) => {
          // Handle session refresh from other tabs
          console.log('Session refreshed in another tab:', data);
        });
      }

      // Sync offline state across tabs
      if (this.offlineManager) {
        this.crossTabService.onMessage('offline-state-change', async (data) => {
          if (data.isOffline) {
            await this.offlineManager!.handleOffline();
          } else {
            await this.offlineManager!.handleOnline();
          }
        });
      }
    }
  }

  /**
   * Run migration if needed
   */
  private async runMigrationIfNeeded(): Promise<void> {
    try {
      const migrationStatus = await this.migrationService.getMigrationStatus();
      
      if (!migrationStatus.isComplete && migrationStatus.pendingSessions > 0) {
        console.log(`🔄 Running session migration for ${migrationStatus.pendingSessions} sessions...`);
        await this.migrationService.migrateExistingSessions();
      }
    } catch (error) {
      console.warn('⚠️ Session migration failed, continuing with initialization:', error);
    }
  }

  /**
   * Start monitoring and analytics
   */
  private async startMonitoring(): Promise<void> {
    if (!this.config.performanceMonitoringEnabled) {
      return;
    }

    // Set up performance monitoring
    if (this.sessionManager) {
      this.sessionManager.on('validated', (data) => {
        this.recordMetric('session.validation.success', 1);
      });

      this.sessionManager.on('expired', (data) => {
        this.recordMetric('session.expiration', 1);
      });
    }

    if (this.tokenRefreshService) {
      // Monitor token refresh performance
      const originalRefresh = this.tokenRefreshService.refreshTokens.bind(this.tokenRefreshService);
      this.tokenRefreshService.refreshTokens = async () => {
        const startTime = Date.now();
        try {
          const result = await originalRefresh();
          this.recordMetric('token.refresh.success', 1);
          this.recordMetric('token.refresh.duration', Date.now() - startTime);
          return result;
        } catch (error) {
          this.recordMetric('token.refresh.error', 1);
          throw error;
        }
      };
    }

    if (this.connectionMonitor) {
      this.connectionMonitor.onConnectionChange((status) => {
        this.recordMetric('connection.status.change', 1, {
          isOnline: status.isOnline,
          quality: status.quality
        });
      });
    }
  }

  /**
   * Initialize basic fallback functionality
   */
  private async initializeBasicFallback(): Promise<void> {
    console.log('🔧 Initializing basic fallback functionality...');
    
    // Initialize only essential services
    this.stateManager = new StateManager();
    this.errorRecoveryManager = new ErrorRecoveryManager();
    
    // Basic session manager without advanced features
    this.sessionManager = new SessionManager({
      checkInterval: 60000, // Longer interval for fallback
      warningThreshold: 600000, // 10 minutes
      autoRefresh: true
    });

    this.activeFeatures.add('basicFallback');
    this.isInitialized = true;
  }

  /**
   * Get current system status
   */
  getStatus(): SessionPersistenceStatus {
    return {
      isInitialized: this.isInitialized,
      activeFeatures: Array.from(this.activeFeatures),
      sessionStatus: this.sessionManager?.getSessionStatus() || null,
      connectionStatus: this.connectionMonitor?.getConnectionStatus() || null,
      offlineStatus: this.offlineManager?.isOffline() || null,
      errorCount: this.errorRecoveryManager?.getErrorMetrics().totalErrors || 0,
      performanceMetrics: this.getPerformanceMetrics()
    };
  }

  /**
   * Get performance metrics
   */
  private getPerformanceMetrics(): any {
    // This would integrate with your monitoring system
    return {
      sessionInitTime: 0,
      tokenRefreshTime: 0,
      connectionRecoveryTime: 0,
      cacheHitRate: 0,
      errorRate: 0
    };
  }

  /**
   * Record a metric
   */
  private recordMetric(name: string, value: number, tags: any = {}): void {
    if (!this.config.performanceMonitoringEnabled) {
      return;
    }

    // This would integrate with your metrics system (e.g., DataDog, New Relic)
    console.log(`📊 Metric: ${name} = ${value}`, tags);
  }

  /**
   * Enable a feature dynamically
   */
  async enableFeature(feature: string, userId?: string): Promise<void> {
    try {
      await this.featureFlags.enableFeature(feature as any);
      
      // Reinitialize if needed
      if (!this.activeFeatures.has(feature)) {
        await this.reinitializeWithFeature(feature);
      }
      
      console.log(`✅ Feature ${feature} enabled`);
    } catch (error) {
      console.error(`❌ Failed to enable feature ${feature}:`, error);
      throw error;
    }
  }

  /**
   * Disable a feature dynamically
   */
  async disableFeature(feature: string): Promise<void> {
    try {
      await this.featureFlags.disableFeature(feature as any);
      
      // Clean up feature if active
      if (this.activeFeatures.has(feature)) {
        await this.cleanupFeature(feature);
      }
      
      console.log(`⏹️ Feature ${feature} disabled`);
    } catch (error) {
      console.error(`❌ Failed to disable feature ${feature}:`, error);
      throw error;
    }
  }

  /**
   * Reinitialize with a new feature
   */
  private async reinitializeWithFeature(feature: string): Promise<void> {
    // This would selectively initialize the new feature
    // without disrupting existing functionality
    console.log(`🔄 Reinitializing with feature: ${feature}`);
  }

  /**
   * Clean up a disabled feature
   */
  private async cleanupFeature(feature: string): Promise<void> {
    // Clean up resources for the disabled feature
    console.log(`🧹 Cleaning up feature: ${feature}`);
    this.activeFeatures.delete(feature);
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Session Persistence System...');

    // Cleanup all services
    await this.sessionManager?.destroy();
    await this.tokenRefreshService?.cleanup?.();
    await this.connectionMonitor?.cleanup?.();
    await this.stateManager?.cleanup?.();
    await this.errorRecoveryManager?.cleanup?.();
    await this.offlineManager?.cleanup?.();
    await this.crossTabService?.cleanup?.();

    this.isInitialized = false;
    this.activeFeatures.clear();
    
    console.log('✅ Session Persistence System cleanup completed');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    errors: string[];
  }> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    try {
      // Check session manager
      if (this.sessionManager) {
        checks.sessionManager = await this.sessionManager.validateSession();
      }

      // Check connection monitor
      if (this.connectionMonitor) {
        checks.connectionMonitor = this.connectionMonitor.getConnectionStatus().isOnline;
      }

      // Check state manager
      if (this.stateManager) {
        try {
          await this.stateManager.saveState('health-check', { timestamp: Date.now() });
          const restored = await this.stateManager.restoreState('health-check');
          checks.stateManager = restored !== null;
        } catch (error) {
          checks.stateManager = false;
          errors.push(`State manager error: ${error.message}`);
        }
      }

      // Check offline manager
      if (this.offlineManager) {
        checks.offlineManager = true; // Basic check
      }

      // Determine overall status
      const failedChecks = Object.values(checks).filter(check => !check).length;
      const totalChecks = Object.keys(checks).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (failedChecks === 0) {
        status = 'healthy';
      } else if (failedChecks < totalChecks / 2) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return { status, checks, errors };
    } catch (error) {
      return {
        status: 'unhealthy',
        checks,
        errors: [...errors, `Health check failed: ${error.message}`]
      };
    }
  }
}

// Export singleton instance
export const sessionPersistenceIntegration = new SessionPersistenceIntegration();