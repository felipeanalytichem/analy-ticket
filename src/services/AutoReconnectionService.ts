import { ConnectionMonitor, ConnectionStatus, ConnectionQuality } from './ConnectionMonitor';
export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  qualityThreshold: number;
  jitterEnabled: boolean;
  fallbackStrategies: ('exponential' | 'linear' | 'immediate')[];
  circuitBreakerThreshold: number;
  adaptiveBackoff: boolean;
}

export interface ReconnectionState {
  isReconnecting: boolean;
  currentAttempt: number;
  nextAttemptIn: number;
  lastAttemptTime: Date | null;
  strategy: 'exponential' | 'linear' | 'immediate';
  reason: string;
  circuitBreakerOpen: boolean;
  fallbackModeActive: boolean;
  adaptiveDelayMultiplier: number;
}

export interface ReconnectionMetrics {
  totalAttempts: number;
  successfulReconnections: number;
  failedAttempts: number;
  averageReconnectionTime: number;
  lastSuccessfulReconnection: Date | null;
  connectionUptime: number;
}

/**
 * AutoReconnectionService provides intelligent reconnection logic with exponential backoff,
 * connection quality assessment, and fallback mechanisms
 */
export class AutoReconnectionService {
  private static instance: AutoReconnectionService;
  
  private connectionMonitor: ConnectionMonitor;
  private reconnectionState: ReconnectionState;
  private reconnectionMetrics: ReconnectionMetrics;
  private config: ReconnectionConfig;
  
  private reconnectionTimeout: NodeJS.Timeout | null = null;
  private qualityCheckInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  
  // Event callbacks
  private reconnectionStartCallbacks: ((attempt: number) => void)[] = [];
  private reconnectionSuccessCallbacks: (() => void)[] = [];
  private reconnectionFailureCallbacks: ((attempt: number, error: any) => void)[] = [];
  private maxAttemptsReachedCallbacks: (() => void)[] = [];
  private circuitBreakerOpenCallbacks: (() => void)[] = [];
  private fallbackModeCallbacks: ((active: boolean) => void)[] = [];
  
  // Circuit breaker state
  private consecutiveFailures = 0;
  private circuitBreakerOpenTime: Date | null = null;
  private readonly CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute
  
  // Performance tracking for quality assessment
  private latencyHistory: number[] = [];
  private successHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 10;
  
  private constructor(connectionMonitor: ConnectionMonitor) {
    this.connectionMonitor = connectionMonitor;
    
    this.config = {
      maxAttempts: 10,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      qualityThreshold: 60, // Minimum quality score to consider connection stable
      jitterEnabled: true,
      fallbackStrategies: ['exponential', 'linear', 'immediate'],
      circuitBreakerThreshold: 5, // Open circuit breaker after 5 consecutive failures
      adaptiveBackoff: true
    };
    
    this.reconnectionState = {
      isReconnecting: false,
      currentAttempt: 0,
      nextAttemptIn: 0,
      lastAttemptTime: null,
      strategy: 'exponential',
      reason: '',
      circuitBreakerOpen: false,
      fallbackModeActive: false,
      adaptiveDelayMultiplier: 1.0
    };
    
    this.reconnectionMetrics = {
      totalAttempts: 0,
      successfulReconnections: 0,
      failedAttempts: 0,
      averageReconnectionTime: 0,
      lastSuccessfulReconnection: null,
      connectionUptime: 0
    };
    
    this.setupConnectionMonitoring();
  }
  
  static getInstance(connectionMonitor?: ConnectionMonitor): AutoReconnectionService {
    if (!AutoReconnectionService.instance) {
      if (!connectionMonitor) {
        throw new Error('ConnectionMonitor instance required for first initialization');
      }
      AutoReconnectionService.instance = new AutoReconnectionService(connectionMonitor);
    }
    return AutoReconnectionService.instance;
  }
  
  // For testing purposes
  static createInstance(connectionMonitor: ConnectionMonitor): AutoReconnectionService {
    return new AutoReconnectionService(connectionMonitor);
  }
  
  static resetInstance(): void {
    if (AutoReconnectionService.instance) {
      AutoReconnectionService.instance.stop();
      AutoReconnectionService.instance = null as any;
    }
  }
  
  /**
   * Start the automatic reconnection service
   */
  start(): void {
    if (this.isActive) {
      console.log('🔄 [AutoReconnectionService] Already active');
      return;
    }
    
    console.log('🔄 [AutoReconnectionService] Starting automatic reconnection service');
    this.isActive = true;
    
    // Start quality monitoring
    this.startQualityMonitoring();
  }
  
  /**
   * Stop the automatic reconnection service
   */
  stop(): void {
    if (!this.isActive) return;
    
    console.log('🔄 [AutoReconnectionService] Stopping automatic reconnection service');
    this.isActive = false;
    
    this.cancelReconnectionAttempt();
    this.stopQualityMonitoring();
    
    // Reset state
    this.reconnectionState.isReconnecting = false;
    this.reconnectionState.currentAttempt = 0;
  }
  
  /**
   * Update reconnection configuration
   */
  updateConfig(config: Partial<ReconnectionConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔄 [AutoReconnectionService] Configuration updated:', this.config);
  }
  
  /**
   * Get current reconnection state
   */
  getReconnectionState(): ReconnectionState {
    return { ...this.reconnectionState };
  }
  
  /**
   * Get reconnection metrics
   */
  getReconnectionMetrics(): ReconnectionMetrics {
    return { ...this.reconnectionMetrics };
  }
  
  /**
   * Force an immediate reconnection attempt
   */
  async forceReconnection(reason: string = 'Manual trigger'): Promise<boolean> {
    console.log('🔄 [AutoReconnectionService] Forcing reconnection:', reason);
    
    if (!this.isActive) {
      console.log('🔄 [AutoReconnectionService] Service not active, cannot force reconnection');
      return false;
    }
    
    this.cancelReconnectionAttempt();
    this.reconnectionState.reason = reason;
    this.reconnectionState.strategy = 'immediate';
    this.reconnectionState.isReconnecting = true;
    this.reconnectionState.currentAttempt = 1;
    
    return this.attemptReconnection();
  }
  
  /**
   * Check if reconnection is currently in progress
   */
  isReconnecting(): boolean {
    return this.reconnectionState.isReconnecting;
  }
  
  /**
   * Assess connection quality and determine if reconnection is needed
   */
  assessConnectionQuality(): ConnectionQuality {
    const quality = this.connectionMonitor.getConnectionQuality();
    const status = this.connectionMonitor.getConnectionStatus();
    
    // If connection is poor or offline, and we're not already reconnecting, start reconnection
    if (!status.isOnline && !this.reconnectionState.isReconnecting && this.isActive) {
      this.startReconnectionProcess('Connection lost');
    } else if (quality.score < this.config.qualityThreshold && 
               status.isOnline && 
               !this.reconnectionState.isReconnecting && 
               this.isActive) {
      // Connection is online but quality is poor
      console.log(`🔄 [AutoReconnectionService] Poor connection quality detected (${quality.score}), monitoring...`);
      
      // If quality is consistently poor, consider triggering reconnection
      if (this.shouldTriggerQualityBasedReconnection(quality)) {
        this.startReconnectionProcess(`Poor connection quality (score: ${quality.score})`);
      }
    }
    
    return quality;
  }

  /**
   * Determine if poor connection quality should trigger reconnection
   */
  private shouldTriggerQualityBasedReconnection(quality: ConnectionQuality): boolean {
    // Only trigger if quality is very poor (below 30) and has been consistently poor
    if (quality.score > 30) return false;
    
    // Check if we have enough history to make a decision
    if (this.successHistory.length < 5) return false;
    
    // Check if recent success rate is very low
    const recentSuccessRate = this.getRecentSuccessRate(5);
    const recentLatency = this.getRecentAverageLatency(5);
    
    // Trigger reconnection if success rate is below 20% or latency is above 2 seconds
    return recentSuccessRate < 0.2 || recentLatency > 2000;
  }

  /**
   * Get recent success rate from the last N attempts
   */
  private getRecentSuccessRate(count: number): number {
    if (this.successHistory.length === 0) return 0;
    
    const recentHistory = this.successHistory.slice(-count);
    const successes = recentHistory.filter(success => success).length;
    return successes / recentHistory.length;
  }

  /**
   * Get recent average latency from the last N attempts
   */
  private getRecentAverageLatency(count: number): number {
    if (this.latencyHistory.length === 0) return -1;
    
    const recentLatency = this.latencyHistory.slice(-count);
    const sum = recentLatency.reduce((acc, latency) => acc + latency, 0);
    return sum / recentLatency.length;
  }
  
  // Event handlers
  onReconnectionStart(callback: (attempt: number) => void): void {
    this.reconnectionStartCallbacks.push(callback);
  }
  
  onReconnectionSuccess(callback: () => void): void {
    this.reconnectionSuccessCallbacks.push(callback);
  }
  
  onReconnectionFailure(callback: (attempt: number, error: any) => void): void {
    this.reconnectionFailureCallbacks.push(callback);
  }
  
  onMaxAttemptsReached(callback: () => void): void {
    this.maxAttemptsReachedCallbacks.push(callback);
  }
  
  onCircuitBreakerOpen(callback: () => void): void {
    this.circuitBreakerOpenCallbacks.push(callback);
  }
  
  onFallbackMode(callback: (active: boolean) => void): void {
    this.fallbackModeCallbacks.push(callback);
  }
  
  // Private methods
  
  private setupConnectionMonitoring(): void {
    this.connectionMonitor.onConnectionLost(() => {
      if (this.isActive && !this.reconnectionState.isReconnecting) {
        this.startReconnectionProcess('Connection lost');
      }
    });
    
    this.connectionMonitor.onReconnected(() => {
      if (this.reconnectionState.isReconnecting) {
        this.handleReconnectionSuccess();
      }
    });
    
    this.connectionMonitor.onConnectionChange((status: ConnectionStatus) => {
      if (status.isOnline && this.reconnectionState.isReconnecting) {
        // Connection restored during reconnection process
        this.handleReconnectionSuccess();
      }
    });
  }
  
  private startReconnectionProcess(reason: string): void {
    if (this.reconnectionState.isReconnecting) {
      console.log('🔄 [AutoReconnectionService] Reconnection already in progress');
      return;
    }
    
    console.log('🔄 [AutoReconnectionService] Starting reconnection process:', reason);
    
    this.reconnectionState.isReconnecting = true;
    this.reconnectionState.currentAttempt = 0;
    this.reconnectionState.reason = reason;
    this.reconnectionState.strategy = 'exponential';
    
    this.scheduleReconnectionAttempt();
  }
  
  private scheduleReconnectionAttempt(): void {
    if (!this.isActive || !this.reconnectionState.isReconnecting) return;
    
    this.reconnectionState.currentAttempt++;
    
    if (this.reconnectionState.currentAttempt > this.config.maxAttempts) {
      this.handleMaxAttemptsReached();
      return;
    }
    
    const delay = this.calculateDelay();
    this.reconnectionState.nextAttemptIn = delay;
    
    console.log(`🔄 [AutoReconnectionService] Scheduling reconnection attempt ${this.reconnectionState.currentAttempt}/${this.config.maxAttempts} in ${delay}ms`);
    
    this.reconnectionTimeout = setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }
  
  private calculateDelay(): number {
    // Check circuit breaker
    if (this.reconnectionState.circuitBreakerOpen) {
      if (this.circuitBreakerOpenTime && 
          Date.now() - this.circuitBreakerOpenTime.getTime() < this.CIRCUIT_BREAKER_RESET_TIME) {
        return this.CIRCUIT_BREAKER_RESET_TIME; // Wait for circuit breaker reset
      } else {
        // Reset circuit breaker
        this.resetCircuitBreaker();
      }
    }
    
    const attempt = this.reconnectionState.currentAttempt;
    let delay: number;
    
    switch (this.reconnectionState.strategy) {
      case 'immediate':
        delay = 0;
        break;
      case 'linear':
        delay = this.config.baseDelay * attempt;
        break;
      case 'exponential':
      default:
        delay = Math.min(
          this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
          this.config.maxDelay
        );
        break;
    }
    
    // Apply adaptive backoff multiplier
    if (this.config.adaptiveBackoff) {
      delay *= this.reconnectionState.adaptiveDelayMultiplier;
    }
    
    // Add jitter to prevent thundering herd
    if (this.config.jitterEnabled && delay > 0) {
      const jitter = Math.random() * 0.1 * delay; // Up to 10% jitter
      delay += jitter;
    }
    
    return Math.round(Math.min(delay, this.config.maxDelay));
  }
  
  private async attemptReconnection(): Promise<boolean> {
    if (!this.isActive || !this.reconnectionState.isReconnecting) {
      return false;
    }
    
    const startTime = Date.now();
    this.reconnectionState.lastAttemptTime = new Date();
    this.reconnectionMetrics.totalAttempts++;
    
    console.log(`🔄 [AutoReconnectionService] Attempting reconnection ${this.reconnectionState.currentAttempt}/${this.config.maxAttempts}`);
    
    // Notify callbacks
    this.notifyReconnectionStart(this.reconnectionState.currentAttempt);
    
    try {
      // Perform health check to test connection
      const isHealthy = await this.connectionMonitor.performHealthCheck();
      
      if (isHealthy) {
        const reconnectionTime = Date.now() - startTime;
        this.updateReconnectionMetrics(true, reconnectionTime);
        this.handleReconnectionSuccess();
        return true;
      } else {
        throw new Error('Health check failed');
      }
      
    } catch (error) {
      console.warn(`🔄 [AutoReconnectionService] Reconnection attempt ${this.reconnectionState.currentAttempt} failed:`, error);
      
      this.reconnectionMetrics.failedAttempts++;
      this.updateReconnectionMetrics(false);
      this.notifyReconnectionFailure(this.reconnectionState.currentAttempt, error);
      
      // For immediate strategy (force reconnection), don't schedule next attempt
      if (this.reconnectionState.strategy === 'immediate') {
        this.reconnectionState.isReconnecting = false;
        this.reconnectionState.currentAttempt = 0;
        return false;
      }
      
      // Schedule next attempt for other strategies
      this.scheduleReconnectionAttempt();
      return false;
    }
  }
  
  private handleReconnectionSuccess(): void {
    console.log('✅ [AutoReconnectionService] Reconnection successful');
    
    this.reconnectionState.isReconnecting = false;
    this.reconnectionState.currentAttempt = 0;
    this.reconnectionMetrics.successfulReconnections++;
    this.reconnectionMetrics.lastSuccessfulReconnection = new Date();
    
    this.cancelReconnectionAttempt();
    this.notifyReconnectionSuccess();
  }
  
  private handleMaxAttemptsReached(): void {
    console.error('❌ [AutoReconnectionService] Maximum reconnection attempts reached');
    
    this.reconnectionState.isReconnecting = false;
    this.reconnectionState.currentAttempt = 0;
    
    this.cancelReconnectionAttempt();
    
    // Activate fallback mechanisms when max attempts reached
    this.activateFallbackMode();
    
    // Schedule a final attempt with fallback strategy after a longer delay
    this.scheduleFallbackAttempt();
    
    this.notifyMaxAttemptsReached();
  }

  /**
   * Schedule a fallback reconnection attempt after max attempts reached
   */
  private scheduleFallbackAttempt(): void {
    if (!this.isActive) return;
    
    const fallbackDelay = this.config.maxDelay * 2; // Double the max delay for fallback
    
    console.log(`🔄 [AutoReconnectionService] Scheduling fallback attempt in ${fallbackDelay}ms`);
    
    setTimeout(() => {
      if (this.isActive && !this.reconnectionState.isReconnecting) {
        console.log('🔄 [AutoReconnectionService] Attempting fallback reconnection');
        this.forceReconnection('Fallback attempt after max attempts reached');
      }
    }, fallbackDelay);
  }
  
  private cancelReconnectionAttempt(): void {
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }
  }
  
  private startQualityMonitoring(): void {
    this.stopQualityMonitoring();
    
    // Monitor connection quality every 30 seconds
    this.qualityCheckInterval = setInterval(() => {
      if (this.isActive) {
        this.performQualityAssessment();
      }
    }, 30000);
  }

  /**
   * Perform comprehensive connection quality assessment
   */
  private performQualityAssessment(): void {
    if (!this.isActive) return;
    
    const quality = this.assessConnectionQuality();
    const status = this.connectionMonitor.getConnectionStatus();
    
    // Log quality metrics for debugging
    console.log(`🔄 [AutoReconnectionService] Quality assessment - Score: ${quality.score}, Rating: ${quality.rating}, Online: ${status.isOnline}`);
    
    // Update connection uptime metrics
    if (status.isOnline) {
      this.reconnectionMetrics.connectionUptime += 30000; // 30 seconds
    }
    
    // Perform adaptive configuration based on quality trends
    this.adaptConfigurationBasedOnQuality(quality);
  }

  /**
   * Adapt reconnection configuration based on connection quality trends
   */
  private adaptConfigurationBasedOnQuality(quality: ConnectionQuality): void {
    if (!this.config.adaptiveBackoff) return;
    
    // If quality is consistently poor, be more aggressive with reconnection
    if (quality.score < 40 && this.getRecentSuccessRate(5) < 0.5) {
      // Reduce base delay for faster reconnection attempts
      const adaptedConfig = {
        baseDelay: Math.max(500, this.config.baseDelay * 0.8),
        maxAttempts: Math.min(15, this.config.maxAttempts + 2)
      };
      
      console.log('🔄 [AutoReconnectionService] Adapting configuration for poor quality:', adaptedConfig);
      this.updateConfig(adaptedConfig);
    } else if (quality.score > 80 && this.getRecentSuccessRate(5) > 0.9) {
      // If quality is excellent, be more conservative
      const adaptedConfig = {
        baseDelay: Math.min(2000, this.config.baseDelay * 1.2),
        maxAttempts: Math.max(5, this.config.maxAttempts - 1)
      };
      
      console.log('🔄 [AutoReconnectionService] Adapting configuration for excellent quality:', adaptedConfig);
      this.updateConfig(adaptedConfig);
    }
  }
  
  private stopQualityMonitoring(): void {
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }
  }
  
  private updateReconnectionMetrics(success: boolean, reconnectionTime?: number): void {
    // Record performance data for quality assessment
    this.recordPerformanceData(success, reconnectionTime || -1);
    
    if (success && reconnectionTime) {
      // Update average reconnection time
      const totalTime = this.reconnectionMetrics.averageReconnectionTime * this.reconnectionMetrics.successfulReconnections;
      this.reconnectionMetrics.averageReconnectionTime = 
        (totalTime + reconnectionTime) / (this.reconnectionMetrics.successfulReconnections + 1);
      
      // Reset consecutive failures on success
      this.consecutiveFailures = 0;
      this.resetCircuitBreaker();
      
      // Improve adaptive delay multiplier on success
      if (this.config.adaptiveBackoff) {
        this.reconnectionState.adaptiveDelayMultiplier = Math.max(0.5, 
          this.reconnectionState.adaptiveDelayMultiplier * 0.9);
      }
    } else {
      // Track consecutive failures
      this.consecutiveFailures++;
      
      // Check if circuit breaker should open
      if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
        this.openCircuitBreaker();
      }
      
      // Increase adaptive delay multiplier on failure
      if (this.config.adaptiveBackoff) {
        this.reconnectionState.adaptiveDelayMultiplier = Math.min(3.0,
          this.reconnectionState.adaptiveDelayMultiplier * 1.2);
      }
    }
  }

  /**
   * Record performance data for connection quality assessment
   */
  private recordPerformanceData(success: boolean, latency: number): void {
    this.successHistory.push(success);
    if (this.successHistory.length > this.HISTORY_SIZE) {
      this.successHistory.shift();
    }
    
    if (latency > 0) {
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > this.HISTORY_SIZE) {
        this.latencyHistory.shift();
      }
    }
  }
  
  private openCircuitBreaker(): void {
    if (!this.reconnectionState.circuitBreakerOpen) {
      console.warn('🔄 [AutoReconnectionService] Circuit breaker opened due to consecutive failures');
      
      this.reconnectionState.circuitBreakerOpen = true;
      this.circuitBreakerOpenTime = new Date();
      
      this.notifyCircuitBreakerOpen();
      this.activateFallbackMode();
    }
  }
  
  private resetCircuitBreaker(): void {
    if (this.reconnectionState.circuitBreakerOpen) {
      console.log('🔄 [AutoReconnectionService] Circuit breaker reset');
      
      this.reconnectionState.circuitBreakerOpen = false;
      this.circuitBreakerOpenTime = null;
      this.consecutiveFailures = 0;
      
      this.deactivateFallbackMode();
    }
  }
  
  private activateFallbackMode(): void {
    if (!this.reconnectionState.fallbackModeActive) {
      console.log('🔄 [AutoReconnectionService] Activating fallback mode');
      
      this.reconnectionState.fallbackModeActive = true;
      
      // Switch to next fallback strategy
      const currentIndex = this.config.fallbackStrategies.indexOf(this.reconnectionState.strategy);
      const nextIndex = (currentIndex + 1) % this.config.fallbackStrategies.length;
      this.reconnectionState.strategy = this.config.fallbackStrategies[nextIndex];
      
      this.notifyFallbackMode(true);
    }
  }
  
  private deactivateFallbackMode(): void {
    if (this.reconnectionState.fallbackModeActive) {
      console.log('🔄 [AutoReconnectionService] Deactivating fallback mode');
      
      this.reconnectionState.fallbackModeActive = false;
      this.reconnectionState.strategy = 'exponential'; // Reset to default
      
      this.notifyFallbackMode(false);
    }
  }
  
  // Notification methods
  private notifyReconnectionStart(attempt: number): void {
    this.reconnectionStartCallbacks.forEach(callback => {
      try {
        callback(attempt);
      } catch (error) {
        console.error('Error in reconnection start callback:', error);
      }
    });
  }
  
  private notifyReconnectionSuccess(): void {
    this.reconnectionSuccessCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in reconnection success callback:', error);
      }
    });
  }
  
  private notifyReconnectionFailure(attempt: number, error: any): void {
    this.reconnectionFailureCallbacks.forEach(callback => {
      try {
        callback(attempt, error);
      } catch (error) {
        console.error('Error in reconnection failure callback:', error);
      }
    });
  }
  
  private notifyMaxAttemptsReached(): void {
    this.maxAttemptsReachedCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in max attempts reached callback:', error);
      }
    });
  }
  
  private notifyCircuitBreakerOpen(): void {
    this.circuitBreakerOpenCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in circuit breaker open callback:', error);
      }
    });
  }
  
  private notifyFallbackMode(active: boolean): void {
    this.fallbackModeCallbacks.forEach(callback => {
      try {
        callback(active);
      } catch (error) {
        console.error('Error in fallback mode callback:', error);
      }
    });
  }
  
  /**
   * Cleanup method
   */
  cleanup(): void {
    console.log('🧹 [AutoReconnectionService] Cleaning up');
    
    this.stop();
    this.reconnectionStartCallbacks = [];
    this.reconnectionSuccessCallbacks = [];
    this.reconnectionFailureCallbacks = [];
    this.maxAttemptsReachedCallbacks = [];
    this.circuitBreakerOpenCallbacks = [];
    this.fallbackModeCallbacks = [];
    
    // Reset circuit breaker state
    this.consecutiveFailures = 0;
    this.circuitBreakerOpenTime = null;
    
    // Clear performance tracking data
    this.latencyHistory = [];
    this.successHistory = [];
  }
}

// Export singleton instance factory
export const createAutoReconnectionService = (connectionMonitor: ConnectionMonitor) => {
  return AutoReconnectionService.getInstance(connectionMonitor);
};